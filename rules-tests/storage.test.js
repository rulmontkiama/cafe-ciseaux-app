import { test, before, after, beforeEach } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes, deleteObject } from 'firebase/storage';

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
    storage: {
      rules: readFileSync(new URL('../storage.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 9199,
    },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'admin', ADMIN), { admin_id: ADMIN });
    const st = ctx.storage();
    await uploadBytes(ref(st, 'images/AVATAR.svg'), new Uint8Array([1, 2, 3]), { contentType: 'image/svg+xml' });
    await uploadBytes(ref(st, `avatars/${ALICE}/a.png`), new Uint8Array([1, 2, 3]), { contentType: 'image/png' });
  });
});

const as = (uid) => env.authenticatedContext(uid).storage();
const anon = () => env.unauthenticatedContext().storage();
const bytes = (n = 10) => new Uint8Array(n);

test('images: lecture publique', async () => {
  await assertSucceeds(getBytes(ref(anon(), 'images/AVATAR.svg')));
});
test('images: admin écrit (photo de bière), un client non', async () => {
  await assertSucceeds(uploadBytes(ref(as(ADMIN), 'images/biere.jpg'), bytes(), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(as(ALICE), 'images/biere.jpg'), bytes(), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(anon(), 'images/biere.jpg'), bytes(), { contentType: 'image/jpeg' }));
});
test('images: un client ne peut pas écraser AVATAR.svg ni supprimer', async () => {
  await assertFails(uploadBytes(ref(as(ALICE), 'images/AVATAR.svg'), bytes(), { contentType: 'image/svg+xml' }));
  await assertFails(deleteObject(ref(as(ALICE), 'images/AVATAR.svg')));
});
test('images: admin refusé si ce n\'est pas une image ou si > 5 Mo', async () => {
  await assertFails(uploadBytes(ref(as(ADMIN), 'images/x.txt'), bytes(), { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(as(ADMIN), 'images/gros.png'), bytes(5 * 1024 * 1024 + 1), { contentType: 'image/png' }));
});
test('avatars: l\'utilisateur écrit dans son dossier (file-upload)', async () => {
  await assertSucceeds(uploadBytes(ref(as(ALICE), `avatars/${ALICE}/moi.jpg`), bytes(), { contentType: 'image/jpeg' }));
});
test('avatars: pas dans le dossier d\'un autre, pas en SVG, pas hors image, pas > 5 Mo', async () => {
  await assertFails(uploadBytes(ref(as(ALICE), `avatars/${BOB}/moi.jpg`), bytes(), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(ref(as(ALICE), `avatars/${ALICE}/moi.svg`), bytes(), { contentType: 'image/svg+xml' }));
  await assertFails(uploadBytes(ref(as(ALICE), `avatars/${ALICE}/moi.txt`), bytes(), { contentType: 'text/plain' }));
  await assertFails(uploadBytes(ref(as(ALICE), `avatars/${ALICE}/gros.png`), bytes(5 * 1024 * 1024 + 1), { contentType: 'image/png' }));
});
test('avatars: lecture pour connectés seulement', async () => {
  await assertSucceeds(getBytes(ref(as(BOB), `avatars/${ALICE}/a.png`)));
  await assertFails(getBytes(ref(anon(), `avatars/${ALICE}/a.png`)));
});
test('avatars: suppression par le propriétaire ou un admin, pas par un autre client', async () => {
  await assertFails(deleteObject(ref(as(BOB), `avatars/${ALICE}/a.png`)));
  await assertSucceeds(deleteObject(ref(as(ALICE), `avatars/${ALICE}/a.png`)));
});
test('chemin inconnu: tout refusé', async () => {
  await assertFails(uploadBytes(ref(as(ADMIN), 'autre/x.png'), bytes(), { contentType: 'image/png' }));
  await assertFails(getBytes(ref(as(ADMIN), 'autre/x.png')));
});
