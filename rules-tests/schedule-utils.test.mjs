// Tests des fonctions pures horaires/congés (aucun émulateur nécessaire) :
//   node --test schedule-utils.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  daysBetween, dayKeyFromLocalDate, dayKeyFromSeconds, parseDayKey,
  normalizeTime, validateDayHours, readDay, defaultSchedule, MAX_LEAVE_DAYS,
} from '../src/app/services/schedule-utils.ts';

test('clés de jour : plage inclusive, passage de mois et d\'année', () => {
  assert.deepEqual(daysBetween('2026-12-30', '2027-01-02'), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.deepEqual(daysBetween('2026-07-14', '2026-07-14'), ['2026-07-14']);
});
test('clés de jour : plage inversée ou date invalide → vide', () => {
  assert.deepEqual(daysBetween('2026-07-15', '2026-07-14'), []);
  assert.deepEqual(daysBetween('2026-02-31', '2026-03-02'), []);
  assert.deepEqual(daysBetween('n\'importe quoi', '2026-03-02'), []);
});
test('clés de jour : changement d\'heure (mars/octobre) ne saute ni ne double un jour', () => {
  const march = daysBetween('2026-03-27', '2026-03-31');
  assert.deepEqual(march, ['2026-03-27', '2026-03-28', '2026-03-29', '2026-03-30', '2026-03-31']);
  const oct = daysBetween('2026-10-24', '2026-10-27');
  assert.deepEqual(oct, ['2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27']);
});
test('clés de jour : plafond de sécurité', () => {
  assert.ok(daysBetween('2026-01-01', '2030-01-01').length <= MAX_LEAVE_DAYS + 1);
});
test('jour choisi par l\'admin et jour Paris d\'un instant', () => {
  assert.equal(dayKeyFromLocalDate(new Date(2026, 6, 14)), '2026-07-14');
  // 2026-07-13 22:30 UTC = 14 juillet 00:30 à Paris (été, UTC+2)
  assert.equal(dayKeyFromSeconds(Date.UTC(2026, 6, 13, 22, 30) / 1000), '2026-07-14');
  assert.equal(parseDayKey('2026-07-14').hour, 0);
});
test('normalizeTime : formats courants', () => {
  assert.equal(normalizeTime('9:00'), '09:00');
  assert.equal(normalizeTime('09:05'), '09:05');
  assert.equal(normalizeTime('9h30'), '09:30');
  assert.equal(normalizeTime('18h'), '18:00');
  assert.equal(normalizeTime(''), '');
  assert.equal(normalizeTime(null), '');
  assert.equal(normalizeTime('25:00'), null);
  assert.equal(normalizeTime('12:75'), null);
  assert.equal(normalizeTime('midi'), null);
});
test('validateDayHours : jours valides', () => {
  for (const day of Object.values(defaultSchedule())) {
    assert.deepEqual(validateDayHours(day[0]), []);
  }
});
test('validateDayHours : erreurs', () => {
  const base = { start1: '09:00', end1: '12:00', start2: '13:00', end2: '18:00', isBook: true };
  assert.equal(validateDayHours({ ...base, end1: '08:00' }).length, 1);       // fin avant début
  assert.equal(validateDayHours({ ...base, start2: '11:00' }).length, 1);     // après-midi avant fin du matin
  assert.equal(validateDayHours({ ...base, end2: '' }).length, 1);            // plage incomplète
  assert.equal(validateDayHours({ ...base, start1: '9h' }).length, 1);        // format non normalisé
  assert.equal(validateDayHours({ start1: '', end1: '', start2: '', end2: '', isBook: true }).length, 1); // ouvert sans heures
  assert.deepEqual(validateDayHours({ start1: '', end1: '', start2: '', end2: '', isBook: false }), []); // fermé : ok
  assert.deepEqual(validateDayHours({ ...base, start2: '', end2: '' }), []); // matin seul : ok
});
test('readDay : tolère tableau, objet seul et valeurs manquantes', () => {
  assert.deepEqual(readDay([{ start1: '9h', end1: '12:00', isBook: 1 }]),
    { start1: '09:00', end1: '12:00', start2: '', end2: '', isBook: true });
  assert.deepEqual(readDay(undefined), { start1: '', end1: '', start2: '', end2: '', isBook: false });
});
