import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ScheduleService, ScheduleValidationError } from '../services/schedule.service';
import { SalonCatalogService } from '../services/salon-catalog.service';
import { Leave } from '../models/leave';
import { Prestation } from '../models/types';
import { weekdays } from 'src/app/models/weekdays.model';
import { AlertService } from '../services/alert.service';

@Component({
  selector: 'app-admin-schedule',
  templateUrl: './admin-schedule.component.html',
  styleUrls: ['./admin-schedule.component.scss']
})
export class AdminScheduleComponent implements OnInit, OnDestroy {
  readonly weekdays = weekdays;
  leaves: Leave[] = [];
  daysWithIsBook: { dayName: string; isBook: boolean }[] = [];
  schedule: any = null;
  scheduleKeys: string[] = [];
  isLoading = true;
  initializing = false;
  resetting = false;
  copyingDay: string | null = null;

  // Formulaire de congé / fermeture (1 jour ou période)
  leaveStart = '';
  leaveEnd = '';
  leaveLabel = '';
  savingLeave = false;

  // Éditeur Prestations & Tarifs
  prestations: Prestation[] = [];
  savingPrestations = false;

  private leavesSub?: Subscription;
  private scheduleSub?: Subscription;
  private prestationsSub?: Subscription;

  constructor(
    private scheduleService: ScheduleService,
    private catalogService: SalonCatalogService,
    private _toast: AlertService
  ) {}

  ngOnInit(): void {
    this.leavesSub = this.scheduleService.getLeaves().subscribe({
      next: (leaves) => {
        this.leaves = leaves || [];
      },
      error: (err) => console.error(err)
    });

    this.prestationsSub = this.catalogService.getPrestations().subscribe({
      next: (list) => {
        this.prestations = list.map((p) => ({ ...p }));
      },
      error: (err) => console.error(err)
    });

    this.scheduleSub = this.scheduleService.getSchedule().subscribe({
      next: (schedules: any[]) => {
        this.isLoading = false;
        const first = schedules?.[0];
        if (!first) {
          this.schedule = null;
          this.scheduleKeys = [];
          this.daysWithIsBook = [];
          return;
        }
        this.schedule = first;
        this.scheduleKeys = Object.keys(this.schedule)
          .filter((k) => this.weekdays.includes(k))
          .sort((a, b) => this.weekdays.indexOf(a) - this.weekdays.indexOf(b));

        this.daysWithIsBook = this.scheduleKeys.map((day) => ({
          dayName: day,
          isBook: Boolean(this.schedule[day]?.[0]?.isBook)
        }));
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  ngOnDestroy(): void {
    this.leavesSub?.unsubscribe();
    this.scheduleSub?.unsubscribe();
    this.prestationsSub?.unsubscribe();
  }

  async initDefaultSchedule(): Promise<void> {
    if (this.initializing) return;
    this.initializing = true;
    try {
      await this.scheduleService.ensureScheduleDoc();
      this._toast.showSucces('HORAIRES', 'Horaires par défaut créés');
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', "Impossible de créer les horaires par défaut");
    } finally {
      this.initializing = false;
    }
  }

  async setReservationDay(day: { dayName: string; isBook: boolean }): Promise<void> {
    const nextState = !day.isBook;
    try {
      await this.scheduleService.setDayOpen(day.dayName, nextState);
      day.isBook = nextState;
      this._toast.showSucces(
        'HORAIRES',
        nextState ? `RDV ouverts le ${day.dayName}` : `RDV fermés le ${day.dayName}`
      );
    } catch (error: any) {
      if (error instanceof ScheduleValidationError) {
        this._toast.showWarning('HORAIRES', error.errors[0]);
      } else {
        console.error(error);
        this._toast.showError('ERREUR', 'Mise à jour impossible');
      }
    }
  }

  async addLeavePeriod(): Promise<void> {
    if (this.savingLeave) return;
    if (!this.leaveStart) {
      this._toast.showWarning('DATE REQUISE', 'Choisissez au moins une date de début');
      return;
    }
    const startKey = this.leaveStart;
    const endKey = this.leaveEnd || this.leaveStart;

    this.savingLeave = true;
    try {
      // Vérifie s'il existe déjà des RDV clients sur cette période pour avertir l'admin
      const existingRdvs = await this.scheduleService.getAppointmentsBetween(startKey, endKey);
      if (existingRdvs.length > 0) {
        const proceed = window.confirm(
          `Attention : ${existingRdvs.length} rendez-vous client(s) existent déjà sur cette période. Ils ne seront pas annulés automatiquement. Bloquer quand même ces dates ?`
        );
        if (!proceed) {
          return;
        }
      }

      await this.scheduleService.addLeave(startKey, endKey, this.leaveLabel);
      this.leaveStart = '';
      this.leaveEnd = '';
      this.leaveLabel = '';
      this._toast.showSucces('CONGÉ ENREGISTRÉ', 'La période est bloquée à la réservation');
    } catch (error: any) {
      if (error instanceof ScheduleValidationError) {
        this._toast.showWarning('DATE INVALIDE', error.errors[0]);
      } else {
        console.error(error);
        this._toast.showError('ERREUR', "Impossible d'enregistrer ce congé");
      }
    } finally {
      this.savingLeave = false;
    }
  }

  async removeLeave(leave: Leave): Promise<void> {
    try {
      await this.scheduleService.removeLeave(leave.id);
      this._toast.showSucces('PÉRIODE DÉBLOQUÉE', 'Les dates sont à nouveau ouvertes');
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', 'Impossible de supprimer cette période');
    }
  }

  formatLeaveRange(leave: Leave): string {
    const fmt = (d: Date) =>
      d.toLocaleDateString('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' });
    if (leave.startKey === leave.endKey) {
      return fmt(leave.start);
    }
    return `${fmt(leave.start)} → ${fmt(leave.end)} (${leave.days} j)`;
  }

  async onTimeChange(day: string, key: 'start1' | 'end1' | 'start2' | 'end2', value: string): Promise<void> {
    const clean = (value || '').trim();
    try {
      await this.scheduleService.saveDayHours(day, { [key]: clean });
      this._toast.showSucces('HORAIRES', `Horaires du ${day} mis à jour`);
    } catch (error: any) {
      if (error instanceof ScheduleValidationError) {
        this._toast.showWarning('HORAIRE INVALIDE', error.errors[0]);
      } else {
        console.error(error);
        this._toast.showError('ERREUR', 'Mise à jour impossible');
      }
    }
  }

  async toggleHalfDay(day: string, part: 'morning' | 'afternoon'): Promise<void> {
    const slot = this.schedule?.[day]?.[0];
    if (!slot) return;

    const startKey = part === 'morning' ? 'start1' : 'start2';
    const endKey = part === 'morning' ? 'end1' : 'end2';
    const isCurrentlyOpen = Boolean(slot[startKey] || slot[endKey]);

    try {
      await this.scheduleService.setHalfDay(day, part, isCurrentlyOpen ? null : undefined);
      this._toast.showSucces(
        'HORAIRES',
        `${part === 'morning' ? 'Matin' : 'Après-midi'} ${isCurrentlyOpen ? 'fermé' : 'ouvert'} le ${day}`
      );
    } catch (error: any) {
      if (error instanceof ScheduleValidationError) {
        this._toast.showWarning('HORAIRES', error.errors[0]);
      } else {
        console.error(error);
        this._toast.showError('ERREUR', 'Modification impossible');
      }
    }
  }

  async copyToWeekdays(day: string): Promise<void> {
    if (this.copyingDay) return;
    this.copyingDay = day;
    try {
      await this.scheduleService.copyDayHours(day, ['mardi', 'mercredi', 'jeudi', 'vendredi']);
      this._toast.showSucces('HORAIRES COPIÉS', `Horaires du ${day} appliqués du mardi au vendredi`);
    } catch (error: any) {
      if (error instanceof ScheduleValidationError) {
        this._toast.showWarning('HORAIRES', error.errors[0]);
      } else {
        console.error(error);
        this._toast.showError('ERREUR', 'Copie impossible');
      }
    } finally {
      this.copyingDay = null;
    }
  }

  async resetDefaultSchedule(): Promise<void> {
    if (this.resetting) return;
    const confirmed = window.confirm(
      'Réinitialiser tous les horaires de la semaine aux valeurs par défaut (mardi–vendredi 09h–12h / 13h–18h, samedi 09h–16h) ? Vos tarifs et annonces seront conservés.'
    );
    if (!confirmed) return;

    this.resetting = true;
    try {
      await this.scheduleService.resetSchedule();
      this._toast.showSucces('HORAIRES RÉINITIALISÉS', 'Semaine type restaurée');
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', 'Réinitialisation impossible');
    } finally {
      this.resetting = false;
    }
  }

  addPrestationRow(): void {
    const nextId = this.prestations.reduce((max, p) => Math.max(max, p.id || 0), 0) + 1;
    this.prestations.push({ id: nextId, name: '', durationMin: 20, price: '' });
  }

  removePrestationRow(index: number): void {
    if (this.prestations.length <= 1) {
      this._toast.showWarning('PRESTATIONS', 'Gardez au moins une prestation active');
      return;
    }
    this.prestations.splice(index, 1);
  }

  async savePrestations(): Promise<void> {
    if (this.savingPrestations) return;
    const valid = this.prestations.filter((p) => p.name && p.name.trim().length > 0);
    if (valid.length === 0) {
      this._toast.showWarning('PRESTATIONS', 'Renseignez au moins un nom de prestation');
      return;
    }

    this.savingPrestations = true;
    try {
      await this.catalogService.savePrestations(valid);
      this._toast.showSucces('TARIFS ENREGISTRÉS', 'La carte des prestations est à jour');
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', "Impossible d'enregistrer les prestations");
    } finally {
      this.savingPrestations = false;
    }
  }

  trackByIndex(index: number): number {
    return index;
  }
}
