import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthenticationService } from '../services/authentication.service';
import { RendezVousService } from '../services/rendez-vous.service';
import { ScheduleService } from '../services/schedule.service';
import { BeersService } from '../services/beers.service';
import { MessageService } from '../services/message.service';
import { DateService } from '../services/date.service';
import { AlertService } from '../services/alert.service';
import { UsersService } from '../services/users.service';
import {
  CommunicationBadge,
  EMPTY_COMMUNICATION,
  SalonCommunication,
  SalonCommunicationService
} from '../services/salon-communication.service';
import { readDay } from '../services/schedule-utils';

const FRENCH_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

@Component({
  selector: 'app-admin-overview',
  templateUrl: './admin-overview.component.html',
  styleUrls: ['./admin-overview.component.scss']
})
export class AdminOverviewComponent implements OnInit, OnDestroy {
  adminName = '';
  todayLabel = '';
  todayStatusText = 'Non configuré';
  isOpenToday = false;
  hasScheduleDoc = true;
  initializingSchedule = false;

  todayAppointments: any[] = [];
  monthRdvCount = 0;
  unreadMessages = 0;
  beersCount = 0;
  leavesCount = 0;
  loadingRdv = true;

  // Formulaire de la zone Communication
  readonly badges: CommunicationBadge[] = ['INFO', 'NOUVEAUTÉ', 'FERMETURE', 'ÉVÉNEMENT'];
  comm: SalonCommunication = { ...EMPTY_COMMUNICATION };
  savingComm = false;

  private subs = new Subscription();

  constructor(
    private authService: AuthenticationService,
    private rdvService: RendezVousService,
    private scheduleService: ScheduleService,
    private commService: SalonCommunicationService,
    private beersService: BeersService,
    private msgService: MessageService,
    private dateService: DateService,
    private usersService: UsersService,
    private _toast: AlertService
  ) {}

  ngOnInit(): void {
    const infos = this.authService.getUserInfos();
    this.adminName = [infos?.prenom, infos?.nom].filter(Boolean).join(' ') || 'Admin';
    this.todayLabel = new Date().toLocaleDateString('fr-BE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    this.loadTodayAndMonthRdv();

    this.subs.add(
      this.scheduleService.getSchedule().subscribe({
        next: (docs: any[]) => {
          const doc = docs?.[0];
          this.hasScheduleDoc = Boolean(doc);
          if (!doc) {
            this.isOpenToday = false;
            this.todayStatusText = 'Horaires non initialisés';
            return;
          }
          const todayKey = FRENCH_DAYS[new Date().getDay()];
          const day = readDay(doc[todayKey]);
          if (!day.start1 && !day.start2) {
            this.isOpenToday = false;
            this.todayStatusText = "Fermé aujourd'hui";
          } else {
            this.isOpenToday = true;
            const r1 = day.start1 && day.end1 ? `${day.start1}–${day.end1}` : '';
            const r2 = day.start2 && day.end2 ? `${day.start2}–${day.end2}` : '';
            this.todayStatusText = [r1, r2].filter(Boolean).join(' · ');
          }
        }
      })
    );

    this.subs.add(
      this.commService.getCommunication().subscribe({
        next: (c) => {
          this.comm = { ...c };
        }
      })
    );

    this.subs.add(
      this.beersService.getBeers().subscribe({
        next: (beers) => {
          this.beersCount = (beers || []).length;
        }
      })
    );

    this.subs.add(
      this.scheduleService.getLeaves().subscribe({
        next: (leaves) => {
          this.leavesCount = (leaves || []).length;
        }
      })
    );

    if (infos?.uid) {
      this.subs.add(
        this.msgService.getUnreadMessageCount(infos.uid).subscribe({
          next: (count) => {
            this.unreadMessages = count || 0;
          }
        })
      );
    }
  }

  ngOnDestroy(): void {
    this.subs.unsubscribe();
  }

  async loadTodayAndMonthRdv(): Promise<void> {
    this.loadingRdv = true;
    const now = new Date();
    const todayFormatted = this.dateService.formatDate(now.getTime()).dateString;
    try {
      const monthRdvs = await this.rdvService.getRDVForCurrentMonthOnce(now.getFullYear(), now.getMonth());
      const normalized = (monthRdvs || []).map((rdv: any) => {
        const ms = typeof rdv.date?.seconds === 'number' ? rdv.date.seconds * 1000 : Number(rdv.date);
        const f = this.dateService.formatDate(ms);
        return {
          ...rdv,
          ms,
          dateString: f.dateString,
          hours: f.hours,
          passed: f.passed
        };
      });
      this.monthRdvCount = normalized.length;
      this.todayAppointments = normalized
        .filter((r) => r.dateString === todayFormatted)
        .sort((a, b) => a.ms - b.ms);
      this.hydrateTodayPhones(this.todayAppointments);
    } catch (error) {
      console.error('Erreur chargement RDV tableau de bord:', error);
    } finally {
      this.loadingRdv = false;
    }
  }

  private async hydrateTodayPhones(items: any[]): Promise<void> {
    const missingUids = Array.from(
      new Set(
        items
          .filter((r) => !r.phone && r.user_id && r.user_id !== 'walk-in')
          .map((r) => String(r.user_id))
      )
    );
    if (missingUids.length === 0) return;

    const phoneMap = new Map<string, string>();
    await Promise.all(
      missingUids.map(async (uid) => {
        try {
          const list = await this.usersService.getUser(uid);
          phoneMap.set(uid, (list?.[0]?.phone || '').trim());
        } catch {
          phoneMap.set(uid, '');
        }
      })
    );

    for (const r of items) {
      if (!r.phone && r.user_id && phoneMap.get(r.user_id)) {
        r.phone = phoneMap.get(r.user_id);
      }
    }
  }

  async initDefaultSchedule(): Promise<void> {
    if (this.initializingSchedule) return;
    this.initializingSchedule = true;
    try {
      await this.scheduleService.ensureScheduleDoc();
      this._toast.showSucces('HORAIRES', 'Les horaires par défaut ont été créés');
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', "Impossible d'initialiser les horaires (vérifiez vos droits admin)");
    } finally {
      this.initializingSchedule = false;
    }
  }

  async saveCommunication(): Promise<void> {
    if (this.savingComm) return;
    if (this.comm.active && !this.comm.title.trim() && !this.comm.message.trim()) {
      this._toast.showWarning('ANNONCE VIDE', 'Ajoutez un titre ou un message avant de publier');
      return;
    }
    this.savingComm = true;
    try {
      this.comm = await this.commService.saveCommunication({
        active: this.comm.active,
        badge: this.comm.badge,
        title: this.comm.title,
        message: this.comm.message
      });
      this._toast.showSucces(
        'COMMUNICATION',
        this.comm.active ? 'Annonce publiée sur le site' : 'Annonce masquée du site'
      );
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', "Impossible d'enregistrer l'annonce");
    } finally {
      this.savingComm = false;
    }
  }

  async clearCommunication(): Promise<void> {
    this.comm = { ...EMPTY_COMMUNICATION };
    await this.saveCommunication();
  }
}
