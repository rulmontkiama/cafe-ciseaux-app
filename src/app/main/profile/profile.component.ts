import { Component, OnDestroy, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Subscription } from 'rxjs';
import { DateTime } from 'luxon';
import { AlertService } from 'src/app/services/alert.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { RendezVousService } from 'src/app/services/rendez-vous.service';
import { DateService } from 'src/app/services/date.service';
import { UsersService } from 'src/app/services/users.service';
import { environment } from '../../../environments/environment';

export interface ProfileRdvItem {
  id: string;
  timestampMs: number;
  dateLabel: string;
  shortDate: string;
  hours: string;
  type: string;
  scissor: number;
  passed: boolean;
  countdownLabel: string;
}

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit, OnDestroy {
  public nom = '';
  public prenom = '';
  public phone = '';
  public savingPhone = false;
  public scissor = 0;
  public avatar = 'assets/AVATAR.svg';
  public avatarBool = false;
  public uploadBool = false;
  public imageUrl = environment.imagePath;
  public useStorage = environment.useStorage;

  public readonly mapsUrl = 'https://www.google.com/maps/search/?api=1&query=Ruelle+Grognet+8+4960+Malmedy+Belgium';

  public get isAdmin(): boolean {
    const adminIds = this.authService.getAdminId();
    return Boolean(this.uid && Array.isArray(adminIds) && adminIds.includes(this.uid));
  }

  public isLoadingRdv = true;
  public activeTab: 'upcoming' | 'past' = 'upcoming';
  public upcomingRdv: ProfileRdvItem[] = [];
  public pastRdv: ProfileRdvItem[] = [];
  public cancellingId: string | null = null;
  public showDangerZone = false;

  private uid = '';
  private rdvSub?: Subscription;
  private userSub?: Subscription;

  constructor(
    private _toast: AlertService,
    private authService: AuthenticationService,
    private rendez_vous: RendezVousService,
    private dateService: DateService,
    private usersService: UsersService,
    private db: AngularFirestore
  ) {}

  ngOnInit(): void {
    window.scrollTo(0, 0);
    const userDetails: any = this.authService.getUserInfos();
    if (!userDetails) {
      this.isLoadingRdv = false;
      return;
    }

    this.nom = userDetails.nom || '';
    this.prenom = userDetails.prenom || '';
    this.phone = userDetails.phone || '';
    this.scissor = Math.max(0, Math.min(5, Number(userDetails.scissor) || 0));
    this.avatar = userDetails.avatar || 'assets/AVATAR.svg';
    this.uid = userDetails.uid || '';

    // Synchronise en temps réel les points fidélité, le téléphone et l'avatar
    this.userSub = this.usersService.userObserve(this.uid).subscribe({
      next: (users: any[]) => {
        const current = users?.[0];
        if (!current) return;
        this.scissor = Math.max(0, Math.min(5, Number(current.scissor) || 0));
        if (current.avatar) {
          this.avatar = current.avatar;
        }
        if (typeof current.phone === 'string' && !this.savingPhone) {
          this.phone = current.phone;
        }
      }
    });

    // Charge les rendez-vous du client en temps réel
    this.rdvSub = this.rendez_vous.getUserRDV(this.uid).subscribe({
      next: (rdvs: any[]) => {
        const items: ProfileRdvItem[] = (rdvs || [])
          .filter((r) => r?.date != null)
          .map((r) => {
            const ms = typeof r.date?.seconds === 'number' ? r.date.seconds * 1000 : Number(r.date);
            const formatted = this.dateService.formatDate(ms);
            const paris = DateTime.fromMillis(ms, { zone: 'utc' }).setZone('Europe/Paris').setLocale('fr');
            return {
              id: r.id,
              timestampMs: ms,
              dateLabel: paris.toFormat('cccc d LLLL'),
              shortDate: formatted.dateString,
              hours: formatted.hours,
              type: r.type || 'Coupe',
              scissor: Number(r.scissor) || 0,
              passed: formatted.passed,
              countdownLabel: this.buildCountdownLabel(paris)
            };
          });

        this.upcomingRdv = items
          .filter((r) => !r.passed)
          .sort((a, b) => a.timestampMs - b.timestampMs);

        this.pastRdv = items
          .filter((r) => r.passed)
          .sort((a, b) => b.timestampMs - a.timestampMs);

        this.isLoadingRdv = false;
      },
      error: (err) => {
        console.error('Erreur chargement des rendez-vous client :', err);
        this.isLoadingRdv = false;
        this._toast.showError('ERREUR', 'Impossible de charger vos rendez-vous');
      }
    });
  }

  ngOnDestroy(): void {
    this.rdvSub?.unsubscribe();
    this.userSub?.unsubscribe();
  }

  get nextRdv(): ProfileRdvItem | null {
    return this.upcomingRdv[0] ?? null;
  }

  private buildCountdownLabel(target: any): string {
    const now = DateTime.now().setZone('Europe/Paris');
    const diffDays = Math.floor(target.startOf('day').diff(now.startOf('day'), 'days').days);
    if (diffDays <= 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Demain';
    return `Dans ${diffDays} jours`;
  }

  async cancelRdv(rdv: ProfileRdvItem): Promise<void> {
    if (!rdv?.id || this.cancellingId) return;
    const confirmed = window.confirm(
      `Annuler votre rendez-vous du ${rdv.dateLabel} à ${rdv.hours} ?`
    );
    if (!confirmed) return;

    this.cancellingId = rdv.id;
    try {
      await this.rendez_vous.deleteAndUpdate(rdv.id);
      this._toast.showSucces('ANNULATION', 'Votre rendez-vous a bien été annulé');
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', "Impossible d'annuler ce rendez-vous");
    } finally {
      this.cancellingId = null;
    }
  }

  downloadIcs(rdv: ProfileRdvItem): void {
    const startUtc = DateTime.fromMillis(rdv.timestampMs, { zone: 'utc' });
    const endUtc = startUtc.plus({ minutes: 20 });
    const fmt = (dt: any) => dt.toFormat("yyyyMMdd'T'HHmmss'Z'");

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Cafe Ciseaux//RDV//FR',
      'BEGIN:VEVENT',
      `UID:${rdv.id}@cafeciseaux`,
      `DTSTAMP:${fmt(DateTime.utc())}`,
      `DTSTART:${fmt(startUtc)}`,
      `DTEND:${fmt(endUtc)}`,
      `SUMMARY:Café Ciseaux — ${rdv.type.toUpperCase()}`,
      'LOCATION:Café Ciseaux, Rle Grognet 8, 4960 Malmedy, Belgium',
      'DESCRIPTION:Votre rendez-vous chez Café Ciseaux.',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cafe-ciseaux-${rdv.shortDate.replace(/\//g, '-')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  uploadChangedHandler(upload: any): void {
    this.avatarBool = false;
    this.uploadBool = upload;
  }

  avatarChangedHandler(avatar: any): void {
    this.avatar = avatar;
  }

  changeAvatar(): void {
    if (!environment.useStorage) {
      this._toast.showWarning('PHOTO DE PROFIL', "le changement de photo n'est pas disponible pour le moment");
      return;
    }
    this.avatarBool = !this.avatarBool;
  }

  async savePhone(): Promise<void> {
    if (!this.uid || this.savingPhone) return;
    const cleanPhone = (this.phone || '').trim();
    this.savingPhone = true;
    try {
      await this.db.collection('users').doc(this.uid).update({ phone: cleanPhone });
      const infos = this.authService.getUserInfos() || {};
      infos.phone = cleanPhone;
      this.authService.setDataInLocalStorage('userInfos', JSON.stringify(infos));
      this._toast.showSucces('PROFIL', 'Numéro de téléphone enregistré');
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', 'Impossible de sauvegarder votre numéro');
    } finally {
      this.savingPhone = false;
    }
  }

  logout(): void {
    this.authService.SignOut();
    this._toast.showSucces('DÉCONNEXION', 'Vous êtes déconnecté');
  }

  async deleteAccount(): Promise<void> {
    try {
      const deleted = await this.authService.deleteAccount(this.uid);
      if (deleted) {
        this._toast.showSucces('COMPTE SUPPRIMÉ', 'Votre compte a bien été supprimé');
      }
    } catch (error: any) {
      if (error?.code === 'auth/requires-recent-login') {
        this._toast.showWarning(
          'RECONNEXION REQUISE',
          'Par sécurité, déconnectez-vous puis reconnectez-vous avant de supprimer votre compte'
        );
      } else {
        this._toast.showError('ERREUR', 'Impossible de supprimer votre compte, réessayez');
      }
    }
  }
}
