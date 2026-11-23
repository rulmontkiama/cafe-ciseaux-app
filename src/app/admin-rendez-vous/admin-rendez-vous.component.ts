import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Subscription } from 'rxjs';
import { DateTime } from 'luxon';
import { RendezVousService } from '../services/rendez-vous.service';
import { AlertService } from '../services/alert.service';
import { SalonCatalogService } from '../services/salon-catalog.service';
import { DEFAULT_PRESTATIONS, Prestation } from '../models/types';
import { CalendarViewComponent } from '../calendar-view/calendar-view.component';

@Component({
  selector: 'app-admin-rendez-vous',
  templateUrl: './admin-rendez-vous.component.html',
  styleUrls: ['./admin-rendez-vous.component.scss']
})
export class AdminRendezVousComponent implements OnInit, OnDestroy {
  @ViewChild(CalendarViewComponent) calendarView?: CalendarViewComponent;

  showManualForm = false;
  savingManual = false;
  prestations: Prestation[] = DEFAULT_PRESTATIONS;

  clientPrenom = '';
  clientNom = '';
  clientPhone = '';
  selectedType = DEFAULT_PRESTATIONS[0].name.toLowerCase();
  manualDate = '';
  manualTime = '10:00';

  private subs = new Subscription();

  constructor(
    private rdvService: RendezVousService,
    private catalogService: SalonCatalogService,
    private db: AngularFirestore,
    private route: ActivatedRoute,
    private _toast: AlertService
  ) {}

  ngOnInit(): void {
    const today = DateTime.now().setZone('Europe/Paris');
    this.manualDate = today.toFormat('yyyy-MM-dd');

    this.subs.add(
      this.catalogService.getPrestations().subscribe({
        next: (list) => {
          this.prestations = list;
          if (!this.selectedType && list.length > 0) {
            this.selectedType = list[0].name.toLowerCase();
          }
        }
      })
    );

    this.subs.add(
      this.route.queryParamMap.subscribe((params) => {
        if (params.get('new') === '1') {
          this.showManualForm = true;
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  async createManualRdv(): Promise<void> {
    if (this.savingManual) return;

    const prenom = this.clientPrenom.trim().toLowerCase();
    const nom = this.clientNom.trim().toLowerCase();
    if (!prenom && !nom) {
      this._toast.showWarning('CLIENT REQUIS', 'Indiquez au moins le prénom ou le nom du client');
      return;
    }
    if (!this.manualDate || !this.manualTime) {
      this._toast.showWarning('DATE / HEURE', 'Choisissez une date et une heure');
      return;
    }

    const [y, m, d] = this.manualDate.split('-').map(Number);
    const [hh, mm] = this.manualTime.split(':').map(Number);
    const dt = DateTime.fromObject({ year: y, month: m, day: d, hour: hh, minute: mm }, { zone: 'Europe/Paris' });
    if (!dt.isValid) {
      this._toast.showWarning('DATE INVALIDE', 'Date ou heure invalide');
      return;
    }

    const jsDate = dt.toUTC().toJSDate();
    this.savingManual = true;
    try {
      if (await this.rdvService.isSlotTaken(jsDate)) {
        this._toast.showWarning('CRÉNEAU OCCUPÉ', 'Un rendez-vous existe déjà à cette heure précise');
        return;
      }

      const slotId = String(jsDate.getTime());
      const batch = this.db.firestore.batch();
      batch.set(this.db.collection('rendez_vous').doc(slotId).ref, {
        date: jsDate,
        type: this.selectedType || 'coupe',
        user_id: 'walk-in',
        nom: nom || '-',
        prenom: prenom || 'client',
        phone: this.clientPhone.trim(),
        scissor: 0,
        avatar: 'assets/AVATAR.svg',
        manual: true
      });
      batch.set(this.db.collection('slots').doc(slotId).ref, { date: jsDate });
      await batch.commit();

      this._toast.showSucces('RDV AJOUTÉ', `Rendez-vous enregistré le ${dt.toFormat('dd/MM')} à ${this.manualTime}`);
      this.clientPrenom = '';
      this.clientNom = '';
      this.clientPhone = '';
      this.showManualForm = false;
      if (this.calendarView) {
        this.calendarView.currentYear = dt.year;
        this.calendarView.currentMonth = dt.month - 1;
        this.calendarView.loadAppointments();
      }
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', "Impossible d'enregistrer ce rendez-vous");
    } finally {
      this.savingManual = false;
    }
  }
}
