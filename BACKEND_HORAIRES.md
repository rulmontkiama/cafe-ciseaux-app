# Horaires et congés : API backend pour la page admin

Tout passe par `ScheduleService` ([schedule.service.ts](src/app/services/schedule.service.ts)). Rien à toucher côté Firestore : le service crée lui-même les documents manquants.

```ts
constructor(private scheduleService: ScheduleService) {}
```

Toutes les méthodes d'écriture renvoient une `Promise`. En cas de saisie invalide, elles rejettent avec une `ScheduleValidationError` dont `.errors` est une liste de messages en français, prêts à afficher dans un toast :

```ts
import { ScheduleValidationError } from '../services/schedule.service';

try {
  await this.scheduleService.addLeave(this.start, this.end, this.label);
  this._toast.showSucces('CONGÉS', 'Période enregistrée');
} catch (e) {
  if (e instanceof ScheduleValidationError) this._toast.showWarning('CONGÉS', e.errors.join(' — '));
  else this._toast.showError('ERREUR', "L'enregistrement a échoué, réessayez");
}
```

## Congés (période de plusieurs jours)

| Méthode | Rôle |
|---|---|
| `addLeave(startKey, endKey, label?)` | Bloque du jour `startKey` au jour `endKey` inclus. Clés au format `'AAAA-MM-JJ'` (c'est la valeur d'un `<input type="date">`). Retourne le `Leave` créé. Refuse : dates invalides, fin avant début, période déjà terminée, plus de 366 jours. |
| `getLeaves()` | `Observable<Leave[]>` : un élément par congé, du plus ancien au plus récent. Un ancien « jour bloqué » isolé apparaît comme un congé d'un jour. |
| `removeLeave(leave.id)` | Supprime le congé entier (tous ses jours). |
| `getAppointmentsBetween(startKey, endKey)` | Rendez-vous déjà pris sur la période. **À appeler avant `addLeave`** pour afficher « 3 rendez-vous existent déjà, ils ne seront pas annulés ». |

`Leave` ([leave.ts](src/app/models/leave.ts)) : `{ id, startKey, endKey, start: Date, end: Date, days, label }`.

Un congé n'annule jamais de rendez-vous existant : c'est à l'admin de contacter les clients, d'où `getAppointmentsBetween`.

## Jours isolés (compatibilité)

`addBlockDay(dateOuClé)`, `removeBlockDay(dateOuClé)` et `getAllBlocked()` fonctionnent comme avant (on peut leur passer un `Date` ou une clé).

## Horaires de la semaine

Un jour = `DayHours` : `{ start1, end1, start2, end2, isBook }` (matin, après-midi, ouvert aux rendez-vous). Les heures sont acceptées sous la forme `'9:00'`, `'09:00'` ou `'9h30'` et enregistrées en `'HH:mm'`. Les jours se nomment `'lundi'` … `'dimanche'` (`WEEK_DAYS` dans [schedule-utils.ts](src/app/services/schedule-utils.ts)).

| Méthode | Rôle |
|---|---|
| `saveDayHours(jour, patch)` | Modifie un jour en **une seule écriture** : `saveDayHours('mardi', { start1: '09:30', end1: '12:00' })`. Seuls les champs du `patch` changent. Retourne le jour enregistré. |
| `setDayOpen(jour, isBook)` | Ouvre/ferme les rendez-vous ce jour. Ouvrir exige au moins une plage horaire. |
| `setHalfDay(jour, 'morning' \| 'afternoon', range?)` | Ouvre une demi-journée (`{ start, end }`, ou 9h–12h / 13h–18h par défaut) ; `null` la ferme. |
| `copyDayHours(depuis, [jours])` | « Appliquer à d'autres jours » : `copyDayHours('lundi', ['mardi','mercredi'])`. |
| `saveWeek({ lundi: {...}, ... })` | Enregistre plusieurs jours d'un coup. Tout est validé avant d'écrire : une erreur = rien n'est enregistré. |
| `resetSchedule()` | Remet les horaires par défaut (à confirmer avec l'admin, ça écrase tout). |
| `ensureScheduleDoc()` | Crée les horaires par défaut s'ils n'existent pas (appelé automatiquement par les écritures). |
| `getSchedule()` | Inchangé : `Observable` de la liste des documents horaires (le premier est utilisé partout). |

Règles de validation (messages en français) : heures au format HH:mm, une plage a toujours un début et une fin, la fin est après le début, l'après-midi commence après la fin du matin, un jour ouvert a au moins une plage.

`updateSchedule()` et `updateReservationDay()` (utilisées par la page actuelle) restent disponibles mais n'écrivent qu'une valeur sans vérifier la cohérence ; préférer les méthodes ci-dessus pour les nouveaux écrans.

## Ce que le serveur garantit

- Une réservation sur un jour bloqué est refusée par les règles Firestore, même avec une app modifiée. Les jours bloqués sont les documents `blocked_days/<AAAA-MM-JJ>`.
- Seul un admin (`admin/<UID>`) peut écrire `horaires` et `blocked_days`.
- Limite : les règles lisent le jour en UTC. Aucun effet pour un salon ouvert en journée ; un créneau à 00h30 ou 01h30 à Paris serait contrôlé sur la veille.
- Les anciens jours bloqués créés avec un ID automatique ne sont pas reconnus par les règles (l'app les respecte toujours côté client). Pour les migrer : les supprimer puis les recréer avec `addLeave`.

## Pistes pour plus tard (non faites)

- Horaires exceptionnels pour une date précise (ex. ouvrir un dimanche) : demanderait un champ `exceptions` dans `horaires` et une lecture dans la page de réservation.
- Annulation automatique des rendez-vous d'un congé avec notification aux clients : demande une Cloud Function (forfait Blaze).
