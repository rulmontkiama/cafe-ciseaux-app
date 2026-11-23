import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, map } from 'rxjs';
import { DEFAULT_PRESTATIONS, Prestation } from '../models/types';
import { ScheduleService } from './schedule.service';

/**
 * Gère le catalogue des prestations (nom, durée, tarif) dans le champ `prestations`
 * du document `horaires` (lecture publique, écriture admin d'après firestore.rules).
 */
@Injectable({
  providedIn: 'root'
})
export class SalonCatalogService {
  constructor(
    private db: AngularFirestore,
    private scheduleService: ScheduleService
  ) {}

  getPrestations(): Observable<Prestation[]> {
    return this.scheduleService.getSchedule().pipe(
      map((docs: any[]) => {
        const list = docs?.[0]?.prestations;
        if (!Array.isArray(list) || list.length === 0) {
          return DEFAULT_PRESTATIONS.map((p) => ({ ...p }));
        }
        return list
          .filter((p: any) => p && typeof p.name === 'string' && p.name.trim())
          .map((p: any, idx: number) => ({
            id: Number(p.id) || idx + 1,
            name: String(p.name).trim().toUpperCase(),
            durationMin: Math.max(10, Number(p.durationMin) || 20),
            price: String(p.price ?? '').trim()
          }));
      })
    );
  }

  async savePrestations(prestations: Prestation[]): Promise<Prestation[]> {
    const cleaned: Prestation[] = prestations
      .filter((p) => p.name && p.name.trim().length > 0)
      .map((p, idx) => ({
        id: idx + 1,
        name: p.name.trim().toUpperCase(),
        durationMin: Math.max(10, Math.min(240, Number(p.durationMin) || 20)),
        price: (p.price || '').trim()
      }));

    const docId = await this.scheduleService.ensureScheduleDoc();
    await this.db.collection('horaires').doc(docId).set({ prestations: cleaned }, { merge: true });
    return cleaned;
  }
}
