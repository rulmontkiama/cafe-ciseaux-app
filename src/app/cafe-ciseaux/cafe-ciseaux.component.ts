import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { cafeCiseau } from '../models/cafe-ciseaux.model';
import { ScheduleService } from '../services/schedule.service';
import {
  EMPTY_COMMUNICATION,
  SalonCommunication,
  SalonCommunicationService
} from '../services/salon-communication.service';
import { WEEK_DAYS, defaultSchedule, readDay } from '../services/schedule-utils';

const FRENCH_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

@Component({
  selector: 'app-cafe-ciseaux',
  templateUrl: './cafe-ciseaux.component.html',
  styleUrls: ['./cafe-ciseaux.component.scss']
})
export class CafeCiseauxComponent implements OnInit, OnDestroy {
  @Input() cafeCiseau!: cafeCiseau;

  todayStatusLabel = '';
  isOpenToday = false;
  communication: SalonCommunication = { ...EMPTY_COMMUNICATION };
  readonly mapsUrl = 'https://www.google.com/maps/search/?api=1&query=Ruelle+Grognet+8+4960+Malmedy+Belgium';

  private subs = new Subscription();

  constructor(
    private scheduleService: ScheduleService,
    private commService: SalonCommunicationService
  ) {}

  ngOnInit(): void {
    this.subs.add(
      this.scheduleService.getSchedule().subscribe({
        next: (schedules) => {
          const week = schedules?.[0] || defaultSchedule();
          this.updateTodayStatus(week);
        },
        error: () => {
          this.updateTodayStatus(defaultSchedule());
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

  private updateTodayStatus(week: any): void {
    const todayKey = FRENCH_DAYS[new Date().getDay()];
    const slot = readDay(week?.[todayKey]);
    if (!slot.start1 && !slot.start2) {
      this.isOpenToday = false;
      const todayIdx = WEEK_DAYS.indexOf(todayKey as any);
      let nextHint = '';
      if (todayIdx >= 0) {
        for (let offset = 1; offset <= 7; offset++) {
          const nextDay = WEEK_DAYS[(todayIdx + offset) % 7];
          const nextSlot = readDay(week?.[nextDay]);
          const firstHour = nextSlot.start1 || nextSlot.start2;
          if (firstHour) {
            nextHint = offset === 1 ? ` · Réouverture demain ${firstHour}` : ` · Réouverture ${nextDay} ${firstHour}`;
            break;
          }
        }
      }
      this.todayStatusLabel = `Fermé aujourd'hui${nextHint}`;
      return;
    }
    const firstRange = slot.start1 && slot.end1 ? `${slot.start1} – ${slot.end1}` : '';
    const secondRange = slot.start2 && slot.end2 ? `${slot.start2} – ${slot.end2}` : '';
    this.isOpenToday = true;
    this.todayStatusLabel = `Ouvert aujourd'hui · ${[firstRange, secondRange].filter(Boolean).join(' · ')}`;
  }
}
