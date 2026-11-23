/** Un congé (ou un jour bloqué isolé), tel que renvoyé par ScheduleService.getLeaves(). */
export interface Leave {
  /** Identifiant à passer à removeLeave() (leave_id, ou ID du jour pour un ancien jour bloqué isolé). */
  id: string;
  /** Premier et dernier jour, au format 'AAAA-MM-JJ' (heure de Paris). */
  startKey: string;
  endKey: string;
  /** Mêmes jours, en Date (minuit à Paris), pratiques pour l'affichage. */
  start: Date;
  end: Date;
  /** Nombre de jours bloqués réellement présents (≤ nombre de jours entre start et end). */
  days: number;
  /** Libellé saisi par l'admin (ex. « Vacances d'été »), vide si aucun. */
  label: string;
}
