import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map, Observable, shareReplay } from 'rxjs';
import { Schedule } from '../models/schedule';
import { Leave } from '../models/leave';
import {
  DayHours, MAX_LEAVE_DAYS, WEEK_DAYS, WeekDay,
  dayKeyFromLocalDate, dayKeyFromSeconds, daysBetween, defaultSchedule,
  normalizeTime, parseDayKey, readDay, todayKey, validateDayHours,
} from './schedule-utils';

/** Erreur de saisie : `errors` contient des messages en français, prêts à afficher à l'admin. */
export class ScheduleValidationError extends Error {
  constructor(public errors: string[]) {
    super(errors.join(' ; '));
    this.name = 'ScheduleValidationError';
  }
}

const TIME_KEYS = ['start1', 'end1', 'start2', 'end2'] as const;
const BATCH_SIZE = 400; // Firestore accepte 500 écritures par batch

/**
 * Horaires d'ouverture, congés et jours bloqués.
 *
 * Données :
 *  - `horaires/<id>` : un seul document, un champ par jour : lundi: [{ start1, end1, start2, end2, isBook }].
 *  - `blocked_days/<AAAA-MM-JJ>` : un document par jour bloqué { date, leave_id?, label? }. Un congé de
 *    plusieurs jours = plusieurs documents avec le même leave_id. L'ID du document est la date : les
 *    règles Firestore refusent toute réservation sur un jour bloqué, même depuis un client modifié.
 */
@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  private schedule$?: Observable<any[]>;

  constructor(private db: AngularFirestore) { }

  // ====================================================================================
  //  Horaires
  // ====================================================================================

  /** Documents horaires partagés en temps réel (évite les abonnements Firestore en doublon). */
  getSchedule(): Observable<any> {
    if (!this.schedule$) {
      this.schedule$ = this.db.collection<Schedule>('horaires', ref => ref)
        .snapshotChanges()
        .pipe(
          map(schedules => schedules.map(a => a.payload.doc.data() as Schedule)),
          shareReplay({ bufferSize: 1, refCount: true })
        );
    }
    return this.schedule$;
  }

  /**
   * Crée le document horaires avec les horaires par défaut s'il n'existe pas encore.
   * Retourne l'ID du document. Appelé automatiquement par toutes les écritures ci-dessous.
   */
  async ensureScheduleDoc(): Promise<string> {
    const col = this.db.collection('horaires').ref;
    const snap = await col.get();
    if (!snap.empty) {
      return snap.docs[0].id;
    }
    await col.doc('default').set(defaultSchedule());
    return 'default';
  }

  /**
   * Modifie un jour de la semaine en une seule écriture, après validation.
   * `patch` ne contient que ce qui change : { start1: '09:00' }, { isBook: false }, etc.
   * Les heures sont acceptées sous la forme '9:00', '09:00' ou '9h30' et enregistrées en 'HH:mm'.
   * Rejette avec ScheduleValidationError (messages en français dans .errors) si le résultat est invalide.
   * Retourne le jour tel qu'enregistré.
   */
  async saveDayHours(day: WeekDay | string, patch: Partial<DayHours>): Promise<DayHours> {
    this.assertWeekDay(day);
    const ref = await this.scheduleRef();
    const snap = await ref.get();
    const current = readDay((snap.data() as any)?.[day]);
    const merged = this.applyPatch(current, patch);
    const errors = validateDayHours(merged);
    if (errors.length) {
      throw new ScheduleValidationError(errors);
    }
    await ref.set({ [day]: [merged] }, { merge: true });
    return merged;
  }

  /** Ouvre ou ferme les rendez-vous un jour de la semaine (l'ouverture exige au moins une plage horaire). */
  setDayOpen(day: WeekDay | string, isBook: boolean): Promise<DayHours> {
    return this.saveDayHours(day, { isBook });
  }

  /**
   * Ouvre (avec une plage) ou ferme une demi-journée. range = { start, end } pour ouvrir, null pour fermer.
   * Plage par défaut si range est omis : matin 09:00–12:00, après-midi 13:00–18:00.
   */
  setHalfDay(day: WeekDay | string, part: 'morning' | 'afternoon', range?: { start: string; end: string } | null): Promise<DayHours> {
    const [startKey, endKey] = part === 'morning' ? ['start1', 'end1'] as const : ['start2', 'end2'] as const;
    if (range === null) {
      return this.saveDayHours(day, { [startKey]: '', [endKey]: '' });
    }
    const r = range ?? (part === 'morning' ? { start: '09:00', end: '12:00' } : { start: '13:00', end: '18:00' });
    return this.saveDayHours(day, { [startKey]: r.start, [endKey]: r.end });
  }

  /** Copie les horaires d'un jour vers d'autres jours (ex. du lundi vers mardi → vendredi), en une écriture. */
  async copyDayHours(fromDay: WeekDay | string, toDays: Array<WeekDay | string>): Promise<void> {
    this.assertWeekDay(fromDay);
    toDays.forEach(d => this.assertWeekDay(d));
    const ref = await this.scheduleRef();
    const snap = await ref.get();
    const source = readDay((snap.data() as any)?.[fromDay]);
    const errors = validateDayHours(source);
    if (errors.length) {
      throw new ScheduleValidationError(errors);
    }
    const update: Record<string, DayHours[]> = {};
    toDays.filter(d => d !== fromDay).forEach(d => { update[d] = [{ ...source }]; });
    if (Object.keys(update).length) {
      await ref.set(update, { merge: true });
    }
  }

  /**
   * Enregistre plusieurs jours d'un coup (formulaire « toute la semaine »). Tout est validé avant
   * d'écrire quoi que ce soit : s'il y a une erreur, rien n'est enregistré.
   */
  async saveWeek(week: Partial<Record<WeekDay, Partial<DayHours>>>): Promise<void> {
    const ref = await this.scheduleRef();
    const snap = await ref.get();
    const data: any = snap.data() || {};
    const update: Record<string, DayHours[]> = {};
    const errors: string[] = [];
    for (const day of Object.keys(week)) {
      this.assertWeekDay(day);
      const merged = this.applyPatch(readDay(data[day]), (week as any)[day]);
      validateDayHours(merged).forEach(e => errors.push(`${day} : ${e}`));
      update[day] = [merged];
    }
    if (errors.length) {
      throw new ScheduleValidationError(errors);
    }
    if (Object.keys(update).length) {
      await ref.set(update, { merge: true });
    }
  }

  /** Remet les horaires par défaut (préserve les autres champs comme communication et prestations). */
  async resetSchedule(): Promise<void> {
    const ref = await this.scheduleRef();
    await ref.set(defaultSchedule(), { merge: true });
  }

  /**
   * Anciennes méthodes (appelées par la page admin actuelle). Elles modifient une seule valeur,
   * sans vérifier la cohérence de la plage : l'ancienne page écrit début puis fin séparément.
   * Préférer saveDayHours() / setHalfDay() / setDayOpen() pour les nouveaux écrans.
   */
  updateReservationDay(day: string, key: string, value: any): Promise<void> {
    return this.patchDayLenient(day, { [key]: value });
  }
  updateSchedule(jour: string, key: string, valeur: string): Promise<void> {
    return this.patchDayLenient(jour, { [key]: valeur });
  }

  // ====================================================================================
  //  Jours bloqués et congés
  // ====================================================================================

  /**
   * Bloque une période (congés, vacances, fermeture exceptionnelle) du jour start au jour end inclus,
   * clés 'AAAA-MM-JJ'. Les réservations y sont refusées par l'app ET par les règles Firestore.
   * Les rendez-vous déjà pris sur la période ne sont PAS annulés : voir getAppointmentsBetween()
   * pour avertir l'admin avant de valider.
   * Rejette avec ScheduleValidationError si les dates sont invalides, passées, ou la période trop longue.
   */
  async addLeave(startKey: string, endKey: string, label: string = ''): Promise<Leave> {
    const errors: string[] = [];
    if (!parseDayKey(startKey)) errors.push(`Date de début invalide : « ${startKey} »`);
    if (!parseDayKey(endKey)) errors.push(`Date de fin invalide : « ${endKey} »`);
    if (!errors.length && endKey < startKey) errors.push('La date de fin doit être après la date de début');
    if (!errors.length && endKey < todayKey()) errors.push('Cette période est déjà terminée');
    const keys = errors.length ? [] : daysBetween(startKey, endKey);
    if (!errors.length && keys.length > MAX_LEAVE_DAYS) {
      errors.push(`Une période ne peut pas dépasser ${MAX_LEAVE_DAYS} jours`);
    }
    if (errors.length) {
      throw new ScheduleValidationError(errors);
    }
    const cleanLabel = (label || '').trim().slice(0, 80);
    const leaveId = this.db.createId();
    await this.commitInChunks(keys.map(key => ({
      ref: this.db.collection('blocked_days').doc(key).ref,
      data: { date: this.dayTimestamp(key), leave_id: leaveId, label: cleanLabel },
    })));
    return this.buildLeave(leaveId, keys, cleanLabel);
  }

  /** Congés et jours bloqués regroupés (un élément par congé), triés du plus ancien au plus récent. */
  getLeaves(): Observable<Leave[]> {
    return this.db.collection('blocked_days').snapshotChanges().pipe(
      map(docs => {
        const groups = new Map<string, { keys: string[]; label: string }>();
        for (const d of docs) {
          const data: any = d.payload.doc.data();
          if (data?.date?.seconds == null) continue;
          const id: string = data.leave_id || d.payload.doc.id;
          const g = groups.get(id) || { keys: [] as string[], label: data.label || '' };
          g.keys.push(dayKeyFromSeconds(data.date.seconds));
          groups.set(id, g);
        }
        return Array.from(groups, ([id, g]) => this.buildLeave(id, g.keys, g.label))
          .sort((a, b) => a.startKey.localeCompare(b.startKey));
      })
    );
  }

  /** Supprime un congé entier (tous ses jours). Accepte aussi l'ID d'un ancien jour bloqué isolé. */
  async removeLeave(leaveId: string): Promise<void> {
    const col = this.db.collection('blocked_days').ref;
    const snap = await col.where('leave_id', '==', leaveId).get();
    const refs = snap.empty ? [col.doc(leaveId)] : snap.docs.map(d => d.ref);
    await this.commitInChunks(refs.map(ref => ({ ref, data: null })));
  }

  /** Bloque un seul jour. Accepte un Date (jour choisi, heure locale) ou une clé 'AAAA-MM-JJ'. */
  async addBlockDay(blockDay: Date | string): Promise<void> {
    const key = this.toDayKey(blockDay);
    await this.db.collection('blocked_days').doc(key).set({ date: this.dayTimestamp(key), label: '' });
  }

  /** Débloque un seul jour (Date ou clé). Gère aussi les anciens jours bloqués créés avec un ID automatique. */
  async removeBlockDay(date: Date | string): Promise<void> {
    const key = this.toDayKey(date);
    const col = this.db.collection('blocked_days').ref;
    const refs = new Map<string, any>();
    refs.set(key, col.doc(key));
    const legacy = await col.where('date', '==', this.dayTimestamp(key)).get();
    legacy.forEach(doc => refs.set(doc.id, doc.ref));
    await this.commitInChunks(Array.from(refs.values()).map(ref => ({ ref, data: null })));
  }

  /** Liste brute des jours bloqués, du plus récent au plus ancien (avec leur `id`). */
  getAllBlocked(): Observable<any> {
    return this.db.collection('blocked_days', ref => ref
      .orderBy('date', 'desc')).snapshotChanges()
      .pipe(
        map(blockedDays => {
          return blockedDays.map(a => {
            const data: any = a.payload.doc.data();
            data.id = a.payload.doc.id;
            return data;
          });
        })
      );
  }

  /** Rendez-vous déjà pris entre deux jours (inclus) : à montrer à l'admin avant de valider un congé. Admin seulement. */
  async getAppointmentsBetween(startKey: string, endKey: string): Promise<any[]> {
    const start = parseDayKey(startKey);
    const end = parseDayKey(endKey);
    if (!start || !end || end < start) {
      throw new ScheduleValidationError(['Période invalide']);
    }
    const snap = await this.db.collection('rendez_vous').ref
      .where('date', '>=', start.toJSDate())
      .where('date', '<', end.plus({ days: 1 }).toJSDate())
      .orderBy('date', 'asc')
      .get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as object) }));
  }

  // ====================================================================================
  //  Interne
  // ====================================================================================

  private async scheduleRef() {
    const id = await this.ensureScheduleDoc();
    return this.db.collection('horaires').doc(id).ref;
  }

  private assertWeekDay(day: string): asserts day is WeekDay {
    if (!(WEEK_DAYS as readonly string[]).includes(day)) {
      throw new ScheduleValidationError([`Jour inconnu : « ${day} »`]);
    }
  }

  /** Applique un patch (heures normalisées en HH:mm). Rejette si une heure est illisible. */
  private applyPatch(current: DayHours, patch: Partial<DayHours>): DayHours {
    const next: DayHours = { ...current };
    const errors: string[] = [];
    for (const k of TIME_KEYS) {
      if (patch[k] === undefined) continue;
      const n = normalizeTime(patch[k]);
      if (n === null) errors.push(`Heure invalide : « ${patch[k]} », utilisez le format HH:mm`);
      else next[k] = n;
    }
    if (patch.isBook !== undefined) next.isBook = Boolean(patch.isBook);
    if (errors.length) throw new ScheduleValidationError(errors);
    return next;
  }

  /** Écriture d'une valeur sans validation croisée (anciennes méthodes). Les erreurs sont loguées, pas relancées. */
  private async patchDayLenient(day: string, patch: Record<string, any>): Promise<void> {
    try {
      this.assertWeekDay(day);
      const ref = await this.scheduleRef();
      const snap = await ref.get();
      const next: any = { ...readDay((snap.data() as any)?.[day]) };
      for (const [k, v] of Object.entries(patch)) {
        if ((TIME_KEYS as readonly string[]).includes(k)) {
          const n = normalizeTime(v);
          if (n === null) throw new ScheduleValidationError([`Heure invalide : « ${v} »`]);
          next[k] = n;
        } else if (k === 'isBook') {
          next.isBook = Boolean(v);
        }
      }
      await ref.set({ [day]: [next] }, { merge: true });
    } catch (error) {
      console.error('Mise à jour des horaires impossible', error);
    }
  }

  private toDayKey(value: Date | string): string {
    const key = typeof value === 'string' ? value : dayKeyFromLocalDate(value);
    if (!parseDayKey(key)) {
      throw new ScheduleValidationError([`Date invalide : « ${key} »`]);
    }
    return key;
  }

  /** Minuit à Paris du jour, tel qu'enregistré dans le champ `date` de blocked_days. */
  private dayTimestamp(key: string): Date {
    return parseDayKey(key)!.toJSDate();
  }

  private buildLeave(id: string, keys: string[], label: string): Leave {
    const sorted = [...keys].sort();
    const startKey = sorted[0];
    const endKey = sorted[sorted.length - 1];
    return {
      id, startKey, endKey,
      start: parseDayKey(startKey)!.toJSDate(),
      end: parseDayKey(endKey)!.toJSDate(),
      days: sorted.length,
      label,
    };
  }

  /** Écrit (data) ou supprime (data = null) par paquets, pour rester sous la limite de 500 par batch. */
  private async commitInChunks(ops: Array<{ ref: any; data: any }>): Promise<void> {
    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      const batch = this.db.firestore.batch();
      ops.slice(i, i + BATCH_SIZE).forEach(op => {
        if (op.data === null) batch.delete(op.ref);
        else batch.set(op.ref, op.data);
      });
      await batch.commit();
    }
  }
}
