import { DateTime } from 'luxon';

/**
 * Fonctions pures (sans Firebase) pour les horaires et les congés.
 * Un « jour » est identifié par une clé 'AAAA-MM-JJ' en heure de Paris.
 * Cette clé est aussi l'ID du document blocked_days/<clé> : c'est ce qui permet aux règles
 * Firestore de refuser une réservation sur un jour bloqué.
 */

export const PARIS = 'Europe/Paris';

/** Ordre d'affichage des jours dans la collection horaires. */
export const WEEK_DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
export type WeekDay = typeof WEEK_DAYS[number];

/** Plage maximale d'un congé (évite une saisie absurde qui écrirait des milliers de documents). */
export const MAX_LEAVE_DAYS = 366;

export interface DayHours {
  start1: string;
  end1: string;
  start2: string;
  end2: string;
  isBook: boolean;
}

export const CLOSED_DAY: DayHours = { start1: '', end1: '', start2: '', end2: '', isBook: false };

/** Horaires par défaut (ceux de FIREBASE_SETUP.md), utilisés si aucun document horaires n'existe. */
export function defaultSchedule(): Record<WeekDay, DayHours[]> {
  const weekday: DayHours = { start1: '09:00', end1: '12:00', start2: '13:00', end2: '18:00', isBook: true };
  return {
    lundi: [{ ...CLOSED_DAY }],
    mardi: [{ ...weekday }],
    mercredi: [{ ...weekday }],
    jeudi: [{ ...weekday }],
    vendredi: [{ ...weekday }],
    samedi: [{ start1: '09:00', end1: '16:00', start2: '', end2: '', isBook: true }],
    dimanche: [{ ...CLOSED_DAY }],
  };
}

// ---------- Clés de jour ----------

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number) => (n < 10 ? '0' : '') + n;

export function makeDayKey(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Minuit à Paris du jour donné, ou null si la clé est invalide (ex. 2026-02-31). Type any : pas de types luxon dans ce projet. */
export function parseDayKey(key: string): any | null {
  if (!KEY_RE.test(key || '')) return null;
  const dt = DateTime.fromISO(key, { zone: PARIS });
  return dt.isValid ? dt.startOf('day') : null;
}

/** Jour calendaire choisi par l'admin dans un Date local (ex. new Date(2026, 6, 14) → '2026-07-14'). */
export function dayKeyFromLocalDate(date: Date): string {
  return makeDayKey(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

/** Jour (heure de Paris) d'un instant Firestore donné en secondes. */
export function dayKeyFromSeconds(seconds: number): string {
  const d = DateTime.fromSeconds(seconds, { zone: PARIS });
  return makeDayKey(d.year, d.month, d.day);
}

export function todayKey(now: any = DateTime.now()): string {
  const d = now.setZone(PARIS);
  return makeDayKey(d.year, d.month, d.day);
}

/** Toutes les clés de jour de start à end inclus. Tableau vide si une clé est invalide ou si end < start. */
export function daysBetween(startKey: string, endKey: string): string[] {
  const start = parseDayKey(startKey);
  const end = parseDayKey(endKey);
  if (!start || !end || end < start) return [];
  const keys: string[] = [];
  let cursor = start;
  while (cursor <= end && keys.length <= MAX_LEAVE_DAYS) {
    keys.push(makeDayKey(cursor.year, cursor.month, cursor.day));
    cursor = cursor.plus({ days: 1 });
  }
  return keys;
}

// ---------- Horaires ----------

/**
 * '9:00', '09:00', '9h30', '9h' → 'HH:mm'. '' ou null → ''. Texte non reconnu → null.
 */
export function normalizeTime(value: unknown): string | null {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim().toLowerCase();
  if (raw === '') return '';
  const m = /^(\d{1,2})\s*[:h]\s*(\d{0,2})$/.exec(raw);
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] === '' ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad(h)}:${pad(min)}`;
}

const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Lecture tolérante d'un jour de la collection horaires (un tableau d'un objet, ou l'objet seul). */
export function readDay(raw: any): DayHours {
  const d = Array.isArray(raw) ? raw[0] : raw;
  return {
    start1: normalizeTime(d?.start1) ?? '',
    end1: normalizeTime(d?.end1) ?? '',
    start2: normalizeTime(d?.start2) ?? '',
    end2: normalizeTime(d?.end2) ?? '',
    isBook: Boolean(d?.isBook),
  };
}

/**
 * Liste des erreurs (en français, prêtes à afficher) d'un jour d'horaires. Tableau vide = valide.
 * Règles : heures au format HH:mm ; une plage a toujours un début ET une fin ; la fin est après le début ;
 * l'après-midi commence après la fin du matin ; un jour ouvert aux rendez-vous a au moins une plage.
 */
export function validateDayHours(h: DayHours): string[] {
  const errors: string[] = [];
  const t = { start1: h.start1, end1: h.end1, start2: h.start2, end2: h.end2 };
  for (const [k, v] of Object.entries(t)) {
    if (v !== '' && normalizeTime(v) !== v) {
      errors.push(`Heure invalide (${k}) : « ${v} », utilisez le format HH:mm`);
    }
  }
  if (errors.length) return errors;

  const ranges: Array<[string, string, string]> = [
    ['matin', t.start1, t.end1],
    ['après-midi', t.start2, t.end2],
  ];
  for (const [name, s, e] of ranges) {
    if ((s === '') !== (e === '')) {
      errors.push(`Plage du ${name} incomplète : renseignez l'heure de début et de fin`);
    } else if (s !== '' && toMinutes(e) <= toMinutes(s)) {
      errors.push(`Plage du ${name} : la fin (${e}) doit être après le début (${s})`);
    }
  }
  if (!errors.length && t.end1 !== '' && t.start2 !== '' && toMinutes(t.start2) < toMinutes(t.end1)) {
    errors.push(`L'après-midi (${t.start2}) ne peut pas commencer avant la fin du matin (${t.end1})`);
  }
  const hasRange = (t.start1 !== '' && t.end1 !== '') || (t.start2 !== '' && t.end2 !== '');
  if (!errors.length && h.isBook && !hasRange) {
    errors.push('Un jour ouvert aux rendez-vous doit avoir au moins une plage horaire');
  }
  return errors;
}
