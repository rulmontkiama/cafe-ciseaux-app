import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ScheduleService } from '../services/schedule.service';
import { cafeCiseauxService } from '../services/cafe-ciseaux.service';
import {
  EMPTY_COMMUNICATION,
  SalonCommunication,
  SalonCommunicationService
} from '../services/salon-communication.service';
import { DayHours, WEEK_DAYS, defaultSchedule, readDay } from '../services/schedule-utils';
import { DEFAULT_PRESTATIONS, Prestation } from '../models/types';
import { SalonCatalogService } from '../services/salon-catalog.service';

const FRENCH_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export interface ScheduleDayRow {
  day: string;
  isToday: boolean;
  hours: DayHours;
  isOpen: boolean;
}

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss']
})
export class ScheduleComponent implements OnInit, OnDestroy {
  @Output() closed = new EventEmitter<void>();

  readonly todayName = FRENCH_DAYS[new Date().getDay()];
  prestations: Prestation[] = DEFAULT_PRESTATIONS;
  readonly mapsUrl = 'https://www.google.com/maps/search/?api=1&query=Ruelle+Grognet+8+4960+Malmedy+Belgium';

  days: ScheduleDayRow[] = [];
  communication: SalonCommunication = { ...EMPTY_COMMUNICATION };
  contact: any = null;
  isLoading = true;
  isOpenToday = false;
  todaySummary = '';
  nextOpenHint = '';

  private subs = new Subscription();

  constructor(
    private scheduleService: ScheduleService,
    private commService: SalonCommunicationService,
    private catalogService: SalonCatalogService,
    private salonService: cafeCiseauxService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.contact = this.salonService.getContactDetails()?.[0] || null;

    this.subs.add(
      this.catalogService.getPrestations().subscribe({
        next: (list) => {
          this.prestations = list;
        }
      })
    );

    this.subs.add(
      this.scheduleService.getSchedule().subscribe({
        next: (schedules: any[]) => {
          const source = schedules?.[0] || defaultSchedule();
          this.buildDays(source);
          this.isLoading = false;
        },
        error: () => {
          this.buildDays(defaultSchedule());
          this.isLoading = false;
        }
      })
    );

    this.subs.add(
      this.commService.getCommunication().subscribe({
        next: (c) => {
          this.communication = c;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  get hasActiveCommunication(): boolean {
    return Boolean(this.communication.active && (this.communication.title || this.communication.message));
  }

  get communicationDateLabel(): string {
    if (!this.communication.updatedAt) return '';
    const d = new Date(this.communication.updatedAt);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
  }

  get phoneHref(): string {
    const raw = (this.contact?.phone_n || '').replace(/\s+/g, '');
    if (!raw) return 'tel:+32497991226';
    return raw.startsWith('0') ? `tel:+32${raw.slice(1)}` : `tel:${raw}`;
  }

  private buildDays(source: any): void {
    this.days = WEEK_DAYS.map((day) => {
      const hours = readDay(source[day]);
      const isOpen = Boolean((hours.start1 && hours.end1) || (hours.start2 && hours.end2));
      return {
        day,
        isToday: day === this.todayName,
        hours,
        isOpen
      };
    });

    const todayRow = this.days.find((d) => d.isToday);
    if (todayRow?.isOpen) {
      this.isOpenToday = true;
      const r1 = todayRow.hours.start1 && todayRow.hours.end1 ? `${todayRow.hours.start1} – ${todayRow.hours.end1}` : '';
      const r2 = todayRow.hours.start2 && todayRow.hours.end2 ? `${todayRow.hours.start2} – ${todayRow.hours.end2}` : '';
      this.todaySummary = `Ouvert aujourd'hui · ${[r1, r2].filter(Boolean).join('  /  ')}`;
      this.nextOpenHint = '';
    } else {
      this.isOpenToday = false;
      this.todaySummary = "Fermé aujourd'hui";
      this.nextOpenHint = this.computeNextOpenHint();
    }
  }

  private computeNextOpenHint(): string {
    const todayIdx = WEEK_DAYS.indexOf(this.todayName as any);
    if (todayIdx < 0) return '';
    for (let offset = 1; offset <= 7; offset++) {
      const candidate = this.days[(todayIdx + offset) % 7];
      if (candidate?.isOpen) {
        const firstHour = candidate.hours.start1 || candidate.hours.start2;
        const when = offset === 1 ? 'demain' : candidate.day;
        return firstHour ? `Réouverture ${when} dès ${firstHour}` : `Réouverture ${when}`;
      }
    }
    return '';
  }

  closeModal(): void {
    this.closed.emit();
  }

  goToBooking(): void {
    this.closed.emit();
    this.router.navigate(['/rendez-vous']);
  }

  goToMessages(): void {
    this.closed.emit();
    this.router.navigate(['/user-message']);
  }
}
