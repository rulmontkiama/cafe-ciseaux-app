import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, map } from 'rxjs';
import { ScheduleService } from './schedule.service';

export type CommunicationBadge = 'INFO' | 'NOUVEAUTÉ' | 'FERMETURE' | 'ÉVÉNEMENT';

export interface SalonCommunication {
  active: boolean;
  badge: CommunicationBadge;
  title: string;
  message: string;
  updatedAt: string;
}

export const EMPTY_COMMUNICATION: SalonCommunication = {
  active: false,
  badge: 'INFO',
  title: '',
  message: '',
  updatedAt: ''
};

/**
 * Stocke la communication publique du salon dans le champ `communication` du document `horaires`.
 * Compatible directement avec les règles Firestore existantes (lecture publique, écriture admin).
 */
@Injectable({
  providedIn: 'root'
})
export class SalonCommunicationService {
  constructor(
    private db: AngularFirestore,
    private scheduleService: ScheduleService
  ) {}

  getCommunication(): Observable<SalonCommunication> {
    return this.scheduleService.getSchedule().pipe(
      map((docs: any[]) => {
        const raw = docs?.[0]?.communication;
        if (!raw) return { ...EMPTY_COMMUNICATION };
        return {
          active: Boolean(raw.active),
          badge: raw.badge || 'INFO',
          title: raw.title || '',
          message: raw.message || '',
          updatedAt: raw.updatedAt || ''
        };
      })
    );
  }

  async saveCommunication(comm: Omit<SalonCommunication, 'updatedAt'>): Promise<SalonCommunication> {
    const docId = await this.scheduleService.ensureScheduleDoc();
    const payload: SalonCommunication = {
      active: Boolean(comm.active),
      badge: comm.badge || 'INFO',
      title: (comm.title || '').trim(),
      message: (comm.message || '').trim(),
      updatedAt: new Date().toISOString()
    };
    await this.db.collection('horaires').doc(docId).set({ communication: payload }, { merge: true });
    return payload;
  }
}
