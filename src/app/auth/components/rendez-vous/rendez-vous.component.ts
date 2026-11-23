import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { animate, AUTO_STYLE, state, style, transition, trigger } from '@angular/animations';
import { DateTime } from 'luxon';
import { Subscription, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { DEFAULT_PRESTATIONS, Prestation } from 'src/app/models/types';
import { SalonCatalogService } from 'src/app/services/salon-catalog.service';
import { dayNames } from 'src/app/interface/day-names';
import { AlertService } from 'src/app/services/alert.service';
import { RendezVousService } from 'src/app/services/rendez-vous.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { ScheduleService } from 'src/app/services/schedule.service';
import { MyHammerConfig } from 'src/app/config/my-hammer-config';
import { defaultSchedule, readDay } from 'src/app/services/schedule-utils';

export interface OpenDayCard {
  day: number;
  dayName: string;
  shortName: string;
  badge: string;
}

const FRENCH_MONTHS = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

@Component({
  selector: 'app-rendez-vous',
  templateUrl: './rendez-vous.component.html',
  styleUrls: ['./rendez-vous.component.scss'],
  animations: [
    trigger('collapse', [
      state('false', style({ height: AUTO_STYLE, visibility: AUTO_STYLE })),
      state('true', style({ visibility: 'hidden', height: '0px' })),
      transition('false => true', animate('240ms ease-in')),
      transition('true => false', animate('240ms ease-out'))
    ])
  ],
  providers: [MyHammerConfig]
})
export class RendezVousComponent implements OnInit, OnDestroy {
  types: Prestation[] = DEFAULT_PRESTATIONS;
  selectedPrestation: Prestation | null = null;
  readonly monthNames = FRENCH_MONTHS;
  readonly dayNames = dayNames;

  @ViewChild('daysScroll') daysScroll?: ElementRef<HTMLElement>;

  public rdvForm!: FormGroup;
  collapsed = true;
  submitted = false;
  sending = false;
  loadingSchedule = true;
  loadingHours = false;
  usingFallbackSchedule = false;

  readonly now = new Date();
  readonly currentYear = this.now.getFullYear();
  readonly currentMonthNum = this.now.getMonth();

  year = this.currentYear;
  monthNum = this.currentMonthNum;

  openDays: OpenDayCard[] = [];
  selectedDay: OpenDayCard | null = null;

  scheduleArray: string[] = [];
  unavailableSlots: boolean[] = [];
  selectedHour = '';

  schedule: any = null;
  userDetails: any = null;
  avatar: any = 'assets/AVATAR.svg';
  scissor = 0;

  private blockedKeys = new Set<string>();
  private hoursSubscription?: Subscription;
  private catalogSub?: Subscription;

  constructor(
    public formBuilder: FormBuilder,
    private _toast: AlertService,
    private rendez_vous: RendezVousService,
    private authService: AuthenticationService,
    public router: Router,
    private scheduleService: ScheduleService,
    private catalogService: SalonCatalogService,
    private db: AngularFirestore
  ) {}

  async ngOnInit(): Promise<void> {
    window.scrollTo(0, 0);
    this.userDetails = this.authService.getUserInfos();
    this.avatar = this.userDetails?.avatar || 'assets/AVATAR.svg';

    this.rdvForm = this.formBuilder.group({
      month: [this.monthNum, Validators.required],
      day: [null, Validators.required],
      hours: ['', Validators.required],
      type: ['', Validators.required],
      date: [null],
      user_id: [this.userDetails?.uid || null]
    });

    this.catalogSub = this.catalogService.getPrestations().subscribe({
      next: (list) => {
        this.types = list;
      }
    });

    await this.loadBlockedDays();
    try {
      const schedules = await firstValueFrom(this.scheduleService.getSchedule().pipe(take(1)));
      if (schedules?.[0]) {
        this.schedule = schedules[0];
        this.usingFallbackSchedule = false;
      } else {
        this.schedule = defaultSchedule();
        this.usingFallbackSchedule = true;
      }
    } catch (error) {
      console.error('Impossible de charger les horaires, utilisation des horaires par défaut', error);
      this.schedule = defaultSchedule();
      this.usingFallbackSchedule = true;
    } finally {
      this.loadingSchedule = false;
    }

    this.rebuildMonthDays();
  }

  ngOnDestroy(): void {
    this.hoursSubscription?.unsubscribe();
    this.catalogSub?.unsubscribe();
  }

  get f() {
    return this.rdvForm.controls;
  }

  get monthName(): string {
    return this.monthNames[this.monthNum];
  }

  get canGoPrevMonth(): boolean {
    return this.year > this.currentYear || this.monthNum > this.currentMonthNum;
  }

  isMonthInPast(monthIndex: number): boolean {
    return this.year === this.currentYear && monthIndex < this.currentMonthNum;
  }

  selectType(prestation: Prestation): void {
    this.selectedPrestation = prestation;
    this.rdvForm.patchValue({ type: prestation.name.toLowerCase() });
  }

  previousMonth(): void {
    if (!this.canGoPrevMonth) return;
    if (this.monthNum === 0) {
      this.year--;
      this.monthNum = 11;
    } else {
      this.monthNum--;
    }
    this.collapsed = true;
    this.rebuildMonthDays();
  }

  nextMonth(): void {
    if (this.monthNum === 11) {
      this.year++;
      this.monthNum = 0;
    } else {
      this.monthNum++;
    }
    this.collapsed = true;
    this.rebuildMonthDays();
  }

  selectMonth(monthIndex: number): void {
    if (this.isMonthInPast(monthIndex)) return;
    this.monthNum = monthIndex;
    this.collapsed = true;
    this.rebuildMonthDays();
  }

  scrollDays(direction: -1 | 1): void {
    const el = this.daysScroll?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * 240, behavior: 'smooth' });
  }

  private blockKey(year: number, month1to12: number, day: number): string {
    return `${year}-${month1to12}-${day}`;
  }

  async loadBlockedDays(): Promise<void> {
    try {
      const blocked: any[] = await firstValueFrom(this.scheduleService.getAllBlocked().pipe(take(1)));
      this.blockedKeys = new Set(
        (blocked || [])
          .filter((b) => b?.date?.seconds != null)
          .map((b) => {
            const d = DateTime.fromSeconds(b.date.seconds, { zone: 'Europe/Paris' });
            return this.blockKey(d.year, d.month, d.day);
          })
      );
    } catch (error) {
      console.error('Impossible de charger les jours bloqués', error);
    }
  }

  isBlockedDay(year: number, monthIndex: number, day: number): boolean {
    return this.blockedKeys.has(this.blockKey(year, monthIndex + 1, day));
  }

  isBlockedDate(date: Date): boolean {
    const d = DateTime.fromJSDate(date, { zone: 'Europe/Paris' });
    return this.blockedKeys.has(this.blockKey(d.year, d.month, d.day));
  }

  private rebuildMonthDays(): void {
    this.hoursSubscription?.unsubscribe();
    this.selectedDay = null;
    this.selectedHour = '';
    this.scheduleArray = [];
    this.unavailableSlots = [];
    this.rdvForm.patchValue({ month: this.monthNum, day: null, hours: '' });

    const totalDays = new Date(this.year, this.monthNum + 1, 0).getDate();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const days: OpenDayCard[] = [];
    for (let d = 1; d <= totalDays; d++) {
      const candidate = new Date(this.year, this.monthNum, d);
      candidate.setHours(0, 0, 0, 0);
      if (candidate < todayStart) continue;

      const dayName = this.dayNames[candidate.getDay()];
      const daySchedule = readDay(this.schedule?.[dayName]);
      const hasHours = Boolean((daySchedule.start1 && daySchedule.end1) || (daySchedule.start2 && daySchedule.end2));
      if (!daySchedule.isBook || !hasHours) continue;
      if (this.isBlockedDay(this.year, this.monthNum, d)) continue;

      let badge = '';
      if (candidate.getTime() === todayStart.getTime()) badge = 'Auj.';
      else if (candidate.getTime() === tomorrowStart.getTime()) badge = 'Dem.';

      days.push({
        day: d,
        dayName,
        shortName: dayName.slice(0, 3),
        badge
      });
    }

    this.openDays = days;

    // Pré-sélectionne automatiquement le 1er jour disponible du mois pour afficher les créneaux directement
    if (this.openDays.length > 0) {
      this.selectDay(this.openDays[0]);
    }
  }

  selectDay(dayCard: OpenDayCard): void {
    if (this.selectedDay?.day === dayCard.day) {
      return;
    }
    this.selectedDay = dayCard;
    this.selectedHour = '';
    this.rdvForm.patchValue({ day: dayCard.day, hours: '' });
    this.loadAvailableHours(dayCard);
  }

  private generateTimeIntervals(start: string, end: string): string[] {
    const intervals: string[] = [];
    if (!start || !end) return intervals;

    const [startHour, startMinute] = start.split(':').map(Number);
    const [endHour, endMinute] = end.split(':').map(Number);
    if (Number.isNaN(startHour) || Number.isNaN(endHour)) return intervals;

    const startTotal = startHour * 60 + startMinute;
    const endTotal = endHour * 60 + endMinute;

    // Dernier créneau réservable 20 min avant la fermeture (ex. 11:40 pour 12:00, 17:40 pour 18:00)
    for (let t = startTotal; t + 20 <= endTotal; t += 20) {
      const h = Math.floor(t / 60);
      const m = t % 60;
      intervals.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
    }
    return intervals;
  }

  private loadAvailableHours(dayCard: OpenDayCard): void {
    const daySchedule = readDay(this.schedule?.[dayCard.dayName]);
    const slots: string[] = [
      ...this.generateTimeIntervals(daySchedule.start1, daySchedule.end1),
      ...this.generateTimeIntervals(daySchedule.start2, daySchedule.end2)
    ];

    this.scheduleArray = slots;
    this.unavailableSlots = slots.map((slot) => this.isSlotInPast(dayCard.day, slot));

    const monthPadded = String(this.monthNum + 1).padStart(2, '0');
    const dayPadded = String(dayCard.day).padStart(2, '0');
    const currentDateKey = `${this.year}-${monthPadded}-${dayPadded}`;

    this.hoursSubscription?.unsubscribe();
    this.loadingHours = true;
    this.hoursSubscription = this.rendez_vous.available_date(currentDateKey).subscribe({
      next: (takenDocs: any[]) => {
        const taken = new Set<string>(
          (takenDocs || [])
            .filter((rdv: any) => rdv?.date?.seconds != null)
            .map((rdv: any) =>
              DateTime.fromSeconds(rdv.date.seconds, { zone: 'Europe/Paris' }).toFormat('HH:mm')
            )
        );
        this.unavailableSlots = slots.map((hour) => taken.has(hour) || this.isSlotInPast(dayCard.day, hour));
        // Si l'heure déjà choisie vient d'être prise par quelqu'un d'autre, on la désélectionne
        const idx = slots.indexOf(this.selectedHour);
        if (idx >= 0 && this.unavailableSlots[idx]) {
          this.selectedHour = '';
          this.rdvForm.patchValue({ hours: '' });
        }
        this.loadingHours = false;
      },
      error: (err) => {
        console.error('Erreur chargement créneaux:', err);
        this.loadingHours = false;
      }
    });
  }

  private isSlotInPast(day: number, hourStr: string): boolean {
    const [h, m] = hourStr.split(':').map(Number);
    const slotParis = DateTime.fromObject(
      { year: this.year, month: this.monthNum + 1, day, hour: h, minute: m },
      { zone: 'Europe/Paris' }
    );
    return slotParis <= DateTime.now().setZone('Europe/Paris');
  }

  toggleHour(index: number): void {
    if (this.unavailableSlots[index]) {
      this._toast.showWarning('INDISPONIBLE', 'Ce créneau est indisponible');
      return;
    }
    const chosen = this.scheduleArray[index];
    if (this.selectedHour === chosen) {
      this.selectedHour = '';
      this.rdvForm.patchValue({ hours: '' });
    } else {
      this.selectedHour = chosen;
      this.rdvForm.patchValue({ hours: chosen });
    }
  }

  constructDate(): Date {
    const year = this.year;
    const month = this.monthNum + 1;
    const day = Number(this.rdvForm.value.day);
    const [hours, minutes] = String(this.rdvForm.value.hours).split(':').map(Number);

    const parisDateTime = DateTime.fromObject(
      { year, month, day, hour: hours, minute: minutes },
      { zone: 'Europe/Paris' }
    );
    return parisDateTime.toUTC().toJSDate();
  }

  async onSubmit(): Promise<boolean> {
    this.submitted = true;
    setTimeout(() => {
      this.submitted = false;
    }, 7000);

    if (!this.rdvForm.valid) {
      this._toast.showWarning('INCOMPLET', 'Choisissez une prestation, une date et un créneau');
      return false;
    }
    if (this.sending) {
      return false;
    }
    if (!this.userDetails?.uid) {
      this._toast.showWarning('PAGE PRIVÉE', "Vous n'êtes pas connecté");
      this.router.navigate(['login']);
      return false;
    }

    this.sending = true;
    try {
      const targetDate = this.constructDate();
      await this.loadBlockedDays();
      if (this.isBlockedDate(targetDate)) {
        this._toast.showWarning('INDISPONIBLE', "Ce jour n'est plus disponible, choisissez une autre date");
        this.rebuildMonthDays();
        return false;
      }

      if (await this.rendez_vous.isSlotTaken(targetDate)) {
        this._toast.showWarning('INDISPONIBLE', "Ce créneau vient d'être pris, choisissez-en un autre");
        if (this.selectedDay) {
          this.loadAvailableHours(this.selectedDay);
        }
        return false;
      }

      const payload: any = {
        ...this.rdvForm.value,
        user_id: this.userDetails.uid,
        date: targetDate,
        avatar: this.avatar,
        nom: this.userDetails.nom,
        prenom: this.userDetails.prenom,
        scissor: 0
      };

      // Réservation atomique (rendez_vous + slots)
      await this.rendez_vous.addRDV(payload);

      this.router.navigate(['profile']);
      this._toast.showSucces('CONFIRMATION', 'Votre rendez-vous a bien été validé');
      return true;
    } catch (error) {
      console.error(error);
      if ((error as any)?.code === 'permission-denied') {
        this._toast.showWarning('INDISPONIBLE', "Ce créneau vient d'être pris ou n'est plus disponible");
        if (this.selectedDay) {
          this.loadAvailableHours(this.selectedDay);
        }
      } else {
        this._toast.showError('ERREUR', "Le rendez-vous n'a pas pu être enregistré, réessayez");
      }
      return false;
    } finally {
      this.sending = false;
    }
  }
}
