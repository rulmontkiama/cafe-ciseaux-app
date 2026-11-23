import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { dayNames } from 'src/app/interface/day-names';
import { RendezVousService } from '../services/rendez-vous.service';
import { DateService } from '../services/date.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { AlertService } from '../services/alert.service';
import { UsersService } from '../services/users.service';

@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss'],
})
export class CalendarViewComponent implements OnInit {
  currentYear: number;
  currentMonth: number;
  daysInMonth: any[] = [];
  selectedDay: any = null;
  dayNames: any;
  monthCount = 0;
  isCalendarVisible = true;
  isDeleteDisabled = false;
  isLoading = true;
  onlyWithRdv = false;

  readonly todayYear: number;
  readonly todayMonth: number;
  readonly todayDate: number;

  monthNames = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
  ];

  public RDVData: any[] = [];
  private phoneCache = new Map<string, string>();

  constructor(
    private rendez_vous: RendezVousService,
    private dateService: DateService,
    private route: ActivatedRoute,
    private authService: AuthenticationService,
    private usersService: UsersService,
    private cdRef: ChangeDetectorRef,
    private _toast: AlertService
  ) {
    const today = new Date();
    this.todayYear = today.getFullYear();
    this.todayMonth = today.getMonth();
    this.todayDate = today.getDate();
    this.currentYear = this.todayYear;
    this.currentMonth = this.todayMonth;
    this.dayNames = dayNames;
  }

  ngOnInit(): void {
    this.loadAppointments();
  }

  get visibleDays(): any[] {
    return this.onlyWithRdv
      ? this.daysInMonth.filter((d) => d.rdvCount > 0)
      : this.daysInMonth;
  }

  async loadAppointments(): Promise<void> {
    this.isLoading = true;
    const currentRoute = this.route.snapshot.url.join('/');
    const fullPath = this.route.snapshot.pathFromRoot.map((r) => r.url.map((u) => u.path).join('/')).join('/');
    const isAdminView = currentRoute.includes('admin') || fullPath.includes('admin');
    const userId: any = this.authService.getId();

    try {
      const appointmentsData = isAdminView
        ? await this.rendez_vous.getRDVForCurrentMonthOnce(this.currentYear, this.currentMonth)
        : await this.rendez_vous.getRDVForCurrentUserMonthOnce(userId, this.currentYear, this.currentMonth);

      this.RDVData = (appointmentsData || []).map((rdv: any) => {
        const timestampInMs = rdv.date && typeof rdv.date.seconds === 'number' ? rdv.date.seconds * 1000 : Number(rdv.date);
        const formattedDate = this.dateService.formatDate(timestampInMs);
        return {
          ...rdv,
          timestampInMs,
          date: formattedDate.dateString,
          hours: formattedDate.hours,
          passed: formattedDate.passed,
        };
      });

      this.monthCount = this.RDVData.length;
      this.updateDaysInMonth();

      if (isAdminView) {
        this.hydratePhones(this.RDVData);
      }
    } catch (error) {
      console.error('Error handling appointments:', error);
    } finally {
      this.isLoading = false;
      this.cdRef.detectChanges();
    }
  }

  private async hydratePhones(items: any[]): Promise<void> {
    const missingUids = Array.from(
      new Set(
        items
          .filter((r) => !r.phone && r.user_id && r.user_id !== 'walk-in' && !this.phoneCache.has(r.user_id))
          .map((r) => String(r.user_id))
      )
    );

    if (missingUids.length > 0) {
      await Promise.all(
        missingUids.map(async (uid) => {
          try {
            const list = await this.usersService.getUser(uid);
            this.phoneCache.set(uid, (list?.[0]?.phone || '').trim());
          } catch {
            this.phoneCache.set(uid, '');
          }
        })
      );
    }

    let updated = false;
    for (const r of items) {
      if (!r.phone && r.user_id && this.phoneCache.get(r.user_id)) {
        r.phone = this.phoneCache.get(r.user_id);
        updated = true;
      }
    }
    if (updated) {
      this.cdRef.detectChanges();
    }
  }

  updateDaysInMonth(): void {
    const lastDayOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);
    const numberOfDays = lastDayOfMonth.getDate();
    this.daysInMonth = [];

    for (let day = 1; day <= numberOfDays; day++) {
      const dayDate = new Date(this.currentYear, this.currentMonth, day);
      const formattedDay = day.toString().padStart(2, '0');
      const formattedMonth = (this.currentMonth + 1).toString().padStart(2, '0');
      const expectedStr = `${formattedDay}/${formattedMonth}/${this.currentYear}`;

      const rendezVousForDay = this.RDVData
        .filter((rdv: any) => rdv.date === expectedStr)
        .sort((a: any, b: any) => a.timestampInMs - b.timestampInMs);

      const isToday =
        this.currentYear === this.todayYear &&
        this.currentMonth === this.todayMonth &&
        day === this.todayDate;

      this.daysInMonth.push({
        date: day,
        dayName: this.dayNames[dayDate.getDay()].slice(0, 3),
        rdvCount: rendezVousForDay.length,
        rendezVous: rendezVousForDay,
        isToday,
      });
    }
    if (this.selectedDay) {
      this.selectedDay = this.daysInMonth.find((d) => d.date === this.selectedDay.date) || null;
    }
    this.cdRef.detectChanges();
  }

  goToToday(): void {
    this.currentYear = this.todayYear;
    this.currentMonth = this.todayMonth;
    this.isCalendarVisible = true;
    this.loadAppointments();
  }

  previousMonth(): void {
    if (this.currentMonth === 0) {
      this.currentYear--;
      this.currentMonth = 11;
    } else {
      this.currentMonth--;
    }
    this.loadAppointments();
  }

  nextMonth(): void {
    if (this.currentMonth === 11) {
      this.currentYear++;
      this.currentMonth = 0;
    } else {
      this.currentMonth++;
    }
    this.loadAppointments();
  }

  selectDay(day: any): void {
    this.selectedDay = day;
    this.isCalendarVisible = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async removeRDV(event: Event, explicitId?: string): Promise<void> {
    event.stopPropagation();

    if (this.isDeleteDisabled) {
      return;
    }

    const target = event.target as HTMLElement;
    const rdvId = explicitId || target.getAttribute('data-id') || target.id || target.closest('[id]')?.id || '';
    if (!rdvId) {
      return;
    }

    if (!window.confirm('Supprimer ce rendez-vous ?')) {
      return;
    }

    this.isDeleteDisabled = true;
    try {
      await this.rendez_vous.deleteAndUpdate(rdvId);
      if (this.selectedDay?.rendezVous) {
        this.selectedDay.rendezVous = this.selectedDay.rendezVous.filter((r: any) => r.id !== rdvId);
        this.selectedDay.rdvCount = this.selectedDay.rendezVous.length;
      }
      this.RDVData = this.RDVData.filter((r: any) => r.id !== rdvId);
      this.monthCount = this.RDVData.length;
      this._toast.showSucces('SUPPRESSION', 'Rendez-vous supprimé');
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', 'Impossible de supprimer ce rendez-vous');
    } finally {
      setTimeout(() => {
        this.isDeleteDisabled = false;
      }, 1500);
      this.cdRef.detectChanges();
    }
  }

  showCalendar(): void {
    this.isCalendarVisible = true;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
