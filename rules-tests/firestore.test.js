import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  collection, getDocs, query, where, orderBy, Timestamp, writeBatch,
} from 'firebase/firestore';

const PROJECT = 'demo-cafe-ciseaux';
const ADMIN = 'adminUid';
const ALICE = 'aliceUid';
const BOB = 'bobUid';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'admin', ADMIN), { admin_id: ADMIN });
    for (const [uid, nom] of [[ADMIN, 'boss'], [ALICE, 'alice'], [BOB, 'bob']]) {
      await setDoc(doc(db, 'users', uid), {
        uid, email: `${uid}@test.dev`, nom, prenom: nom, birthdate: '1990-01-01', scissor: 2, avatar: 'x',
      });
    }
    await setDoc(doc(db, 'rendez_vous', 'r_alice'), {
      date: Timestamp.fromDate(new Date('2030-05-10T10:00:00Z')), type: 'coupe',
      user_id: ALICE, nom: 'alice', prenom: 'alice', scissor: 2, avatar: 'x',
    });
    await setDoc(doc(db, 'rendez_vous', 'r_bob'), {
      date: Timestamp.fromDate(new Date('2030-05-11T10:00:00Z')), type: 'coupe',
      user_id: BOB, nom: 'bob', prenom: 'bob', scissor: 2, avatar: 'x',
    });
    await setDoc(doc(db, 'messages', 'm1'), { from_id: ALICE, to_id: ADMIN, msg: 'hi', date: Timestamp.now(), is_read: false });
    await setDoc(doc(db, 'messages', 'm2'), { from_id: ADMIN, to_id: ALICE, msg: 'yo', date: Timestamp.now(), is_read: false });
    await setDoc(doc(db, 'messages', 'm3'), { from_id: BOB, to_id: ADMIN, msg: 'secret', date: Timestamp.now(), is_read: false });
    await setDoc(doc(db, 'horaires', 'default'), { lundi: [{ start1: '', end1: '', start2: '', end2: '', isBook: false }] });
    await setDoc(doc(db, 'beer-selection', 'b1'), { nom: 'ipa', description: 'd', imageUrl: 'u' });
    await setDoc(doc(db, 'blocked_days', 'd1'), { date: Timestamp.now() });
    await setDoc(doc(db, 'demo', 'x'), { a: 1 });
  });
});

const as = (uid) => env.authenticatedContext(uid, { email: `${uid}@test.dev` }).firestore();
const anon = () => env.unauthenticatedContext().firestore();

// ---------- Visiteur non connecté ----------
test('visiteur: lit horaires et bières', async () => {
  await assertSucceeds(getDocs(collection(anon(), 'horaires')));
  await assertSucceeds(getDocs(collection(anon(), 'beer-selection')));
});
test('visiteur: ne lit ni users, ni rendez_vous, ni messages, ni admin, ni blocked_days', async () => {
  for (const c of ['users', 'rendez_vous', 'slots', 'messages', 'admin', 'blocked_days', 'demo']) {
    await assertFails(getDocs(collection(anon(), c)));
  }
});
test('visiteur: aucune écriture', async () => {
  await assertFails(setDoc(doc(anon(), 'horaires', 'default'), { a: 1 }));
  await assertFails(addDoc(collection(anon(), 'beer-selection'), { nom: 'x' }));
});

// ---------- admin ----------
test('client: liste la collection admin (login)', async () => {
  await assertSucceeds(getDocs(collection(as(ALICE), 'admin')));
});
test('client: ne peut pas écrire dans admin (auto-promotion)', async () => {
  await assertFails(setDoc(doc(as(ALICE), 'admin', ALICE), { admin_id: ALICE }));
  await assertFails(setDoc(doc(as(ADMIN), 'admin', 'zzz'), { admin_id: 'zzz' }));
});

// ---------- users ----------
test('users: lit son profil par requête where uid (getUser)', async () => {
  await assertSucceeds(getDocs(query(collection(as(ALICE), 'users'), where('uid', '==', ALICE))));
});
test('users: client lit le profil de l\'admin (messagerie)', async () => {
  await assertSucceeds(getDocs(query(collection(as(ALICE), 'users'), where('uid', '==', ADMIN))));
});
test('users: client ne lit pas le profil d\'un autre client', async () => {
  await assertFails(getDocs(query(collection(as(ALICE), 'users'), where('uid', '==', BOB))));
  await assertFails(getDoc(doc(as(ALICE), 'users', BOB)));
});
test('users: client ne liste pas tous les users', async () => {
  await assertFails(getDocs(collection(as(ALICE), 'users')));
  await assertFails(getDocs(query(collection(as(ALICE), 'users'), orderBy('nom'))));
});
test('users: admin liste et lit tout', async () => {
  await assertSucceeds(getDocs(query(collection(as(ADMIN), 'users'), orderBy('nom'))));
  await assertSucceeds(getDoc(doc(as(ADMIN), 'users', BOB)));
});
test('users: inscription (scissor 0, uid = auth)', async () => {
  const db = env.authenticatedContext('newUid', { email: 'n@test.dev' }).firestore();
  await assertSucceeds(setDoc(doc(db, 'users', 'newUid'), {
    uid: 'newUid', email: 'n@test.dev', nom: 'n', prenom: 'n', birthdate: '1990-05-12', scissor: 0, avatar: 'x',
  }, { merge: true }));
});
test('users: inscription refusée si scissor != 0 ou uid usurpé', async () => {
  const db = env.authenticatedContext('newUid', { email: 'n@test.dev' }).firestore();
  await assertFails(setDoc(doc(db, 'users', 'newUid'), { uid: 'newUid', email: 'n@test.dev', scissor: 4 }));
  await assertFails(setDoc(doc(db, 'users', BOB), { uid: BOB, email: 'n@test.dev', scissor: 0 }));
});
test('users: met à jour son avatar et son scissor (0-5)', async () => {
  await assertSucceeds(updateDoc(doc(as(ALICE), 'users', ALICE), { avatar: 'new' }));
  await assertSucceeds(updateDoc(doc(as(ALICE), 'users', ALICE), { scissor: 3 }));
});
test('users: scissor hors bornes, email, uid ou autre profil refusés', async () => {
  await assertFails(updateDoc(doc(as(ALICE), 'users', ALICE), { scissor: 99 }));
  await assertFails(updateDoc(doc(as(ALICE), 'users', ALICE), { scissor: -1 }));
  await assertFails(updateDoc(doc(as(ALICE), 'users', ALICE), { email: 'x@y.z' }));
  await assertFails(updateDoc(doc(as(ALICE), 'users', ALICE), { uid: BOB }));
  await assertFails(updateDoc(doc(as(ALICE), 'users', BOB), { scissor: 5 }));
});
test('users: supprime son compte, pas celui d\'un autre', async () => {
  await assertSucceeds(deleteDoc(doc(as(ALICE), 'users', ALICE)));
  await assertFails(deleteDoc(doc(as(ALICE), 'users', BOB)));
});
test('users: admin met à jour le scissor d\'un client (deleteAndUpdate)', async () => {
  await assertSucceeds(updateDoc(doc(as(ADMIN), 'users', ALICE), { scissor: 1 }));
});

// ---------- rendez_vous + slots ----------
// L'ID du rdv et du créneau = heure en millisecondes ; les deux sont écrits dans le même batch (addRDV).
const FUTURE = new Date('2030-06-01T09:00:00Z');
const rdvFor = (uid, d = FUTURE) => ({
  date: Timestamp.fromDate(d), type: 'coupe',
  user_id: uid, nom: 'n', prenom: 'p', scissor: 1, avatar: 'x',
});
const bookBatch = (db, uid, d = FUTURE, extra = {}) => {
  const id = String(d.getTime());
  const b = writeBatch(db);
  b.set(doc(db, 'rendez_vous', id), { ...rdvFor(uid, d), ...extra });
  b.set(doc(db, 'slots', id), { date: Timestamp.fromDate(d) });
  return b.commit();
};

test('rdv: client lit ses rdv du mois (calendrier du profil)', async () => {
  const q = query(
    collection(as(ALICE), 'rendez_vous'),
    where('user_id', '==', ALICE),
    where('date', '>=', new Date('2030-05-01')),
    where('date', '<=', new Date('2030-05-31')),
    orderBy('date', 'asc'),
  );
  await assertSucceeds(getDocs(q));
});
test('rdv: client ne lit pas les rdv des autres (RGPD)', async () => {
  await assertFails(getDoc(doc(as(ALICE), 'rendez_vous', 'r_bob')));
  await assertFails(getDocs(collection(as(ALICE), 'rendez_vous')));
  await assertFails(getDocs(query(collection(as(ALICE), 'rendez_vous'), where('user_id', '==', BOB))));
});
test('slots: client lit les créneaux pris, sans données personnelles', async () => {
  await assertSucceeds(bookBatch(as(BOB), BOB));
  const snap = await assertSucceeds(getDocs(query(
    collection(as(ALICE), 'slots'),
    where('date', '>=', new Date('2030-06-01')),
    where('date', '<', new Date('2030-06-02')),
    orderBy('date', 'desc'),
  )));
  assert.equal(snap.size, 1);
  assert.deepEqual(Object.keys(snap.docs[0].data()), ['date']);
});
test('slots: visiteur non connecté ne lit pas les créneaux', async () => {
  await assertFails(getDocs(collection(anon(), 'slots')));
});
test('rdv: client réserve (rdv + créneau dans le même batch)', async () => {
  await assertSucceeds(bookBatch(as(ALICE), ALICE));
});
test('rdv: réservation sans avatar acceptée', async () => {
  const id = String(FUTURE.getTime());
  const db = as(ALICE);
  const { avatar, ...noAvatar } = rdvFor(ALICE);
  const b = writeBatch(db);
  b.set(doc(db, 'rendez_vous', id), noAvatar);
  b.set(doc(db, 'slots', id), { date: Timestamp.fromDate(FUTURE) });
  await assertSucceeds(b.commit());
});
test('rdv: deux clients ne peuvent pas prendre le même créneau', async () => {
  await assertSucceeds(bookBatch(as(ALICE), ALICE));
  await assertFails(bookBatch(as(BOB), BOB));
});
test('rdv: le même client ne peut pas non plus réserver deux fois le créneau', async () => {
  await assertSucceeds(bookBatch(as(ALICE), ALICE));
  await assertFails(bookBatch(as(ALICE), ALICE, FUTURE, { type: 'barbe' }));
});
test('rdv: date passée refusée', async () => {
  await assertFails(bookBatch(as(ALICE), ALICE, new Date('2020-01-01T09:00:00Z')));
});
test("rdv: ID qui ne correspond pas à l'heure refusé", async () => {
  const db = as(ALICE);
  const b = writeBatch(db);
  b.set(doc(db, 'rendez_vous', 'autre'), rdvFor(ALICE));
  b.set(doc(db, 'slots', 'autre'), { date: Timestamp.fromDate(FUTURE) });
  await assertFails(b.commit());
});
test('rdv: sans réserver le créneau (slot absent) refusé', async () => {
  const db = as(ALICE);
  await assertFails(setDoc(doc(db, 'rendez_vous', String(FUTURE.getTime())), rdvFor(ALICE)));
});
test('rdv: créneau seul (sans rdv) refusé', async () => {
  const db = as(ALICE);
  await assertFails(setDoc(doc(db, 'slots', String(FUTURE.getTime())), { date: Timestamp.fromDate(FUTURE) }));
});
test("rdv: création au nom d'un autre, champ parasite ou date invalide refusés", async () => {
  await assertFails(bookBatch(as(ALICE), BOB));
  await assertFails(bookBatch(as(ALICE), ALICE, FUTURE, { admin: true }));
  await assertFails(bookBatch(as(ALICE), ALICE, FUTURE, { date: 'demain' }));
});
test('slots: créneau avec champ parasite (nom) refusé', async () => {
  const db = as(ALICE);
  const id = String(FUTURE.getTime());
  const b = writeBatch(db);
  b.set(doc(db, 'rendez_vous', id), rdvFor(ALICE));
  b.set(doc(db, 'slots', id), { date: Timestamp.fromDate(FUTURE), nom: 'alice' });
  await assertFails(b.commit());
});
test('rdv: propriétaire met à jour scissor/avatar seulement', async () => {
  await assertSucceeds(updateDoc(doc(as(ALICE), 'rendez_vous', 'r_alice'), { scissor: 4 }));
  await assertSucceeds(updateDoc(doc(as(ALICE), 'rendez_vous', 'r_alice'), { avatar: 'y' }));
  await assertFails(updateDoc(doc(as(ALICE), 'rendez_vous', 'r_alice'), { date: Timestamp.now() }));
  await assertFails(updateDoc(doc(as(ALICE), 'rendez_vous', 'r_alice'), { user_id: BOB }));
  await assertFails(updateDoc(doc(as(ALICE), 'rendez_vous', 'r_bob'), { scissor: 4 }));
});
test("rdv: annulation = rdv + créneau supprimés ensemble ; pas ceux des autres", async () => {
  await assertSucceeds(bookBatch(as(ALICE), ALICE));
  const id = String(FUTURE.getTime());
  const dbBob = as(BOB);
  const bad = writeBatch(dbBob);
  bad.delete(doc(dbBob, 'rendez_vous', id));
  bad.delete(doc(dbBob, 'slots', id));
  await assertFails(bad.commit());
  const db = as(ALICE);
  const ok = writeBatch(db);
  ok.delete(doc(db, 'rendez_vous', id));
  ok.delete(doc(db, 'slots', id));
  await assertSucceeds(ok.commit());
  // le créneau est de nouveau libre
  await assertSucceeds(bookBatch(as(BOB), BOB));
});
test("rdv: un client ne peut pas libérer le créneau d'un autre sans son rdv", async () => {
  await assertSucceeds(bookBatch(as(ALICE), ALICE));
  await assertFails(deleteDoc(doc(as(BOB), 'slots', String(FUTURE.getTime()))));
});
test('rdv: suppression de son rdv uniquement; admin supprime tout', async () => {
  await assertSucceeds(deleteDoc(doc(as(ALICE), 'rendez_vous', 'r_alice')));
  await assertFails(deleteDoc(doc(as(ALICE), 'rendez_vous', 'r_bob')));
  await assertSucceeds(deleteDoc(doc(as(ADMIN), 'rendez_vous', 'r_bob')));
});
test('rdv: admin liste tout (appointment-manager)', async () => {
  await assertSucceeds(getDocs(query(collection(as(ADMIN), 'rendez_vous'), orderBy('date', 'desc'))));
});

// ---------- congés / jours bloqués ----------
// blocked_days/<AAAA-MM-JJ> : l'ID est la date, ce qui permet aux règles de refuser les réservations ce jour-là.
const blockDays = (db, keys, leaveId = 'leave1') => {
  const b = writeBatch(db);
  keys.forEach((k) => b.set(doc(db, 'blocked_days', k), {
    date: Timestamp.fromDate(new Date(`${k}T00:00:00Z`)), leave_id: leaveId, label: 'Vacances',
  }));
  return b.commit();
};
test('congés: l\'admin bloque une période (un document par jour) et la supprime', async () => {
  const db = as(ADMIN);
  await assertSucceeds(blockDays(db, ['2030-07-14', '2030-07-15', '2030-07-16']));
  const snap = await assertSucceeds(getDocs(query(collection(db, 'blocked_days'), where('leave_id', '==', 'leave1'))));
  assert.equal(snap.size, 3);
  const b = writeBatch(db);
  snap.docs.forEach((d) => b.delete(d.ref));
  await assertSucceeds(b.commit());
});
test('congés: un client ne peut ni créer ni supprimer un jour bloqué', async () => {
  await assertFails(blockDays(as(ALICE), ['2030-07-14']));
  await assertSucceeds(blockDays(as(ADMIN), ['2030-07-14']));
  await assertFails(deleteDoc(doc(as(ALICE), 'blocked_days', '2030-07-14')));
});
test('congés: un client lit les jours bloqués, pas un visiteur', async () => {
  await assertSucceeds(blockDays(as(ADMIN), ['2030-07-14']));
  await assertSucceeds(getDocs(query(collection(as(ALICE), 'blocked_days'), orderBy('date', 'desc'))));
  await assertFails(getDocs(collection(anon(), 'blocked_days')));
});
test('congés: réservation refusée un jour bloqué, acceptée la veille et le lendemain', async () => {
  await assertSucceeds(blockDays(as(ADMIN), ['2030-07-14', '2030-07-15']));
  await assertFails(bookBatch(as(ALICE), ALICE, new Date('2030-07-14T09:00:00Z')));
  await assertFails(bookBatch(as(ALICE), ALICE, new Date('2030-07-15T16:40:00Z'))); // fin de journée, même jour
  await assertSucceeds(bookBatch(as(ALICE), ALICE, new Date('2030-07-13T09:00:00Z')));
  await assertSucceeds(bookBatch(as(ALICE), ALICE, new Date('2030-07-16T09:00:00Z')));
});
test('congés: après suppression du congé, le jour est de nouveau réservable', async () => {
  await assertSucceeds(blockDays(as(ADMIN), ['2030-07-14']));
  await assertFails(bookBatch(as(ALICE), ALICE, new Date('2030-07-14T09:00:00Z')));
  await assertSucceeds(deleteDoc(doc(as(ADMIN), 'blocked_days', '2030-07-14')));
  await assertSucceeds(bookBatch(as(ALICE), ALICE, new Date('2030-07-14T09:00:00Z')));
});
test('congés: un ancien jour bloqué (ID automatique) ne bloque pas côté serveur mais reste lisible', async () => {
  // fixture d1 : ID automatique, non reconnu par les règles (l'app le fait respecter côté client)
  await assertSucceeds(getDoc(doc(as(ALICE), 'blocked_days', 'd1')));
});
test('horaires: l\'admin crée et modifie le document, un client non', async () => {
  const week = { mardi: [{ start1: '09:00', end1: '12:00', start2: '13:00', end2: '18:00', isBook: true }] };
  await assertSucceeds(setDoc(doc(as(ADMIN), 'horaires', 'default'), week, { merge: true }));
  await assertSucceeds(setDoc(doc(as(ADMIN), 'horaires', 'default'), { lundi: [{ start1: '', end1: '', start2: '', end2: '', isBook: false }] }, { merge: true }));
  await assertFails(setDoc(doc(as(ALICE), 'horaires', 'default'), week, { merge: true }));
  await assertSucceeds(getDocs(collection(anon(), 'horaires')));
});

// ---------- messages ----------
test('messages: client lit ses conversations (envoyés et reçus)', async () => {
  const db = as(ALICE);
  await assertSucceeds(getDocs(query(collection(db, 'messages'), where('from_id', '==', ALICE), orderBy('date', 'desc'))));
  await assertSucceeds(getDocs(query(collection(db, 'messages'), where('to_id', '==', ALICE), orderBy('date', 'desc'))));
  await assertSucceeds(getDocs(query(collection(db, 'messages'),
    where('from_id', '==', ALICE), where('to_id', '==', ADMIN), orderBy('date', 'asc'))));
  await assertSucceeds(getDocs(query(collection(db, 'messages'), where('to_id', '==', ALICE), where('is_read', '==', false))));
});
test('messages: client ne lit pas toute la collection ni les messages d\'un autre', async () => {
  await assertFails(getDocs(query(collection(as(ALICE), 'messages'), orderBy('date', 'desc'))));
  await assertFails(getDoc(doc(as(ALICE), 'messages', 'm3')));
  await assertFails(getDocs(query(collection(as(ALICE), 'messages'), where('from_id', '==', BOB))));
});
test('messages: admin lit les messages qui lui sont adressés', async () => {
  await assertSucceeds(getDocs(query(collection(as(ADMIN), 'messages'), where('to_id', '==', ADMIN), orderBy('date', 'desc'))));
});
test('messages: envoi valide; usurpation, vide, trop long refusés', async () => {
  const base = { to_id: ADMIN, msg: 'salut', date: Timestamp.now(), is_read: false };
  await assertSucceeds(addDoc(collection(as(ALICE), 'messages'), { ...base, from_id: ALICE }));
  await assertFails(addDoc(collection(as(ALICE), 'messages'), { ...base, from_id: BOB }));
  await assertFails(addDoc(collection(as(ALICE), 'messages'), { ...base, from_id: ALICE, msg: '' }));
  await assertFails(addDoc(collection(as(ALICE), 'messages'), { ...base, from_id: ALICE, msg: 'x'.repeat(2001) }));
  await assertFails(addDoc(collection(as(ALICE), 'messages'), { ...base, from_id: ALICE, is_read: true }));
});
test('messages: le destinataire marque comme lu, pas l\'expéditeur, pas d\'autre champ', async () => {
  await assertSucceeds(updateDoc(doc(as(ADMIN), 'messages', 'm1'), { is_read: true }));
  await assertFails(updateDoc(doc(as(ALICE), 'messages', 'm1'), { is_read: true }));
  await assertFails(updateDoc(doc(as(ADMIN), 'messages', 'm1'), { msg: 'modifié' }));
  await assertFails(updateDoc(doc(as(ADMIN), 'messages', 'm1'), { is_read: false }));
});
test('messages: suppression impossible', async () => {
  await assertFails(deleteDoc(doc(as(ALICE), 'messages', 'm1')));
  await assertFails(deleteDoc(doc(as(ADMIN), 'messages', 'm1')));
});

// ---------- horaires / blocked_days / beer-selection / demo ----------
test('horaires, bières, jours bloqués: écriture admin seulement', async () => {
  await assertSucceeds(updateDoc(doc(as(ADMIN), 'horaires', 'default'), { lundi: [{ isBook: true }] }));
  await assertSucceeds(addDoc(collection(as(ADMIN), 'beer-selection'), { nom: 'x', description: 'y', imageUrl: 'z' }));
  await assertSucceeds(addDoc(collection(as(ADMIN), 'blocked_days'), { date: Timestamp.now() }));
  await assertSucceeds(deleteDoc(doc(as(ADMIN), 'blocked_days', 'd1')));
  await assertFails(updateDoc(doc(as(ALICE), 'horaires', 'default'), { lundi: [] }));
  await assertFails(addDoc(collection(as(ALICE), 'beer-selection'), { nom: 'x' }));
  await assertFails(addDoc(collection(as(ALICE), 'blocked_days'), { date: Timestamp.now() }));
  await assertFails(deleteDoc(doc(as(ALICE), 'beer-selection', 'b1')));
});
test('blocked_days et demo: lecture pour connectés', async () => {
  await assertSucceeds(getDocs(query(collection(as(ALICE), 'blocked_days'), orderBy('date', 'desc'))));
  await assertSucceeds(getDocs(collection(as(ALICE), 'demo')));
  await assertFails(setDoc(doc(as(ADMIN), 'demo', 'y'), { a: 1 }));
});

// ---------- collection inconnue ----------
test('collection inconnue: tout refusé', async () => {
  await assertFails(getDocs(collection(as(ADMIN), 'nimporte_quoi')));
  await assertFails(setDoc(doc(as(ADMIN), 'nimporte_quoi', 'a'), { a: 1 }));
});
