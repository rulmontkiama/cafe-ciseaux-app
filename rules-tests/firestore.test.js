import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc,
  collection, getDocs, query, where, orderBy, Timestamp,
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
  for (const c of ['users', 'rendez_vous', 'messages', 'admin', 'blocked_days', 'demo']) {
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

// ---------- rendez_vous ----------
const newRdv = (uid) => ({
  date: Timestamp.fromDate(new Date('2030-06-01T09:00:00Z')), type: 'coupe',
  user_id: uid, nom: 'n', prenom: 'p', scissor: 1, avatar: 'x',
});
test('rdv: client lit les rdv d\'un mois (créneaux pris)', async () => {
  const q = query(
    collection(as(ALICE), 'rendez_vous'),
    where('date', '>=', new Date('2030-05-01')),
    where('date', '<=', new Date('2030-05-31')),
    orderBy('date', 'asc'),
  );
  await assertSucceeds(getDocs(q));
});
test('rdv: client crée son rdv (addRDV)', async () => {
  await assertSucceeds(setDoc(doc(collection(as(ALICE), 'rendez_vous')), newRdv(ALICE)));
});
test('rdv: client crée sans avatar', async () => {
  const { avatar, ...noAvatar } = newRdv(ALICE);
  await assertSucceeds(setDoc(doc(collection(as(ALICE), 'rendez_vous')), noAvatar));
});
test('rdv: création au nom d\'un autre ou champ parasite refusés', async () => {
  await assertFails(setDoc(doc(collection(as(ALICE), 'rendez_vous')), newRdv(BOB)));
  await assertFails(setDoc(doc(collection(as(ALICE), 'rendez_vous')), { ...newRdv(ALICE), admin: true }));
  await assertFails(setDoc(doc(collection(as(ALICE), 'rendez_vous')), { ...newRdv(ALICE), date: 'demain' }));
});
test('rdv: propriétaire met à jour scissor/avatar seulement', async () => {
  await assertSucceeds(updateDoc(doc(as(ALICE), 'rendez_vous', 'r_alice'), { scissor: 4 }));
  await assertSucceeds(updateDoc(doc(as(ALICE), 'rendez_vous', 'r_alice'), { avatar: 'y' }));
  await assertFails(updateDoc(doc(as(ALICE), 'rendez_vous', 'r_alice'), { date: Timestamp.now() }));
  await assertFails(updateDoc(doc(as(ALICE), 'rendez_vous', 'r_alice'), { user_id: BOB }));
  await assertFails(updateDoc(doc(as(ALICE), 'rendez_vous', 'r_bob'), { scissor: 4 }));
});
test('rdv: suppression de son rdv uniquement; admin supprime tout', async () => {
  await assertSucceeds(deleteDoc(doc(as(ALICE), 'rendez_vous', 'r_alice')));
  await assertFails(deleteDoc(doc(as(ALICE), 'rendez_vous', 'r_bob')));
  await assertSucceeds(deleteDoc(doc(as(ADMIN), 'rendez_vous', 'r_bob')));
});
test('rdv: admin liste tout (appointment-manager)', async () => {
  await assertSucceeds(getDocs(query(collection(as(ADMIN), 'rendez_vous'), orderBy('date', 'desc'))));
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
