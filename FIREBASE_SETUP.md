# Guide de reprise & configuration Firebase — Café-Ciseaux

Ce document rassemble tout ce dont tu as besoin pour connecter ton propre projet Firebase et faire tourner l'application **Café-Ciseaux** (Angular 17 + Firebase + Capacitor 5).

---

## 1. Prérequis & installation locale

> **Note importante** : le projet utilise Angular 17 avec `@angular/fire@7.6.1`, ce qui crée un conflit de `peerDependencies` avec `npm install` standard. Utilise toujours `--legacy-peer-deps`.

```bash
# À la racine du projet
npm install --legacy-peer-deps

# Lancer le serveur de développement local
npm start
# -> http://localhost:4200

# Build de production
npm run build
# -> génère les fichiers dans dist/cafe_ciseaux
```

Si tu utilises les Cloud Functions (le fichier `functions/src/index.ts` est actuellement un squelette vide) :
```bash
cd functions
npm install
npm run build
```

---

## 2. Créer et configurer ton projet Firebase

1. Va sur la [Console Firebase](https://console.firebase.google.com/) et crée un nouveau projet.
2. Ajoute une **application Web** (`</>`) dans les paramètres du projet pour obtenir l'objet `firebaseConfig`.
3. Renseigne cet objet dans les deux fichiers suivants :
   - `src/environments/environment.ts` (développement)
   - `src/environments/environment.prod.ts` (production)

```ts
firebase: {
  apiKey: "VOTRE_API_KEY",
  authDomain: "VOTRE_PROJET.firebaseapp.com",
  projectId: "VOTRE_PROJET",
  storageBucket: "VOTRE_PROJET.appspot.com", // ou .firebasestorage.app
  messagingSenderId: "VOTRE_SENDER_ID",
  firebaseStorageDownloadTokens: "",
  appId: "VOTRE_APP_ID",
  measurementId: "VOTRE_MEASUREMENT_ID"
}
```

4. Active les 3 services Firebase utilisés par l'application :
   - **Authentication** → méthode **E-mail/Mot de passe** (et **Google** si tu souhaites utiliser `GoogleAuth`).
   - **Cloud Firestore** → crée une base de données (ex. région `europe-west1`).
   - **Firebase Storage** → active le bucket par défaut.

---

## 3. Firebase Storage (optionnel pour l'instant)

> **Mode sans Storage (actuel)** : `useStorage: false` dans `src/environments/environment.ts` et `environment.prod.ts`. Les nouveaux comptes reçoivent l'avatar local `assets/AVATAR.svg`, le changement de photo de profil est désactivé, et l'admin ajoute les bières avec une URL d'image (ou l'image par défaut). Pour activer Storage plus tard : crée-le dans la console (forfait Blaze), mets `useStorage: true`, téléverse `images/AVATAR.svg` et déploie `storage.rules`.

### Prérequis si Storage est activé

Lors de l'inscription d'un nouvel utilisateur (`AuthenticationService.signUp`), l'application va chercher l'avatar par défaut dans Firebase Storage au chemin exact :

```text
images/AVATAR.svg
```

**Action obligatoire** : dans Firebase Storage, crée un dossier `images/` et uploades-y le fichier `src/assets/AVATAR.svg` (en gardant exactement le nom `AVATAR.svg`). Sans ce fichier, les nouveaux comptes sont créés sans avatar (l'inscription n'échoue plus).

Les uploads ultérieurs d'avatars utilisateurs et d'images de bières sont aussi stockés dans `images/<nom_du_fichier>`.

---

## 4. Structure exacte des collections Firestore

L'application utilise **8 collections** à la racine de Firestore :

### 4.1 `horaires` *(à initialiser manuellement — 1 seul document)*
Contient un document unique (ID libre, ex. `default`). **Attention au format** : chaque jour de la semaine est un **tableau contenant 1 objet**. Un jour fermé a des chaînes vides `""`.

```json
{
  "lundi":    [{ "start1": "", "end1": "", "start2": "", "end2": "", "isBook": false }],
  "mardi":    [{ "start1": "09:00", "end1": "12:00", "start2": "13:00", "end2": "18:00", "isBook": true }],
  "mercredi": [{ "start1": "09:00", "end1": "12:00", "start2": "13:00", "end2": "18:00", "isBook": true }],
  "jeudi":    [{ "start1": "09:00", "end1": "12:00", "start2": "13:00", "end2": "18:00", "isBook": true }],
  "vendredi": [{ "start1": "09:00", "end1": "12:00", "start2": "13:00", "end2": "18:00", "isBook": true }],
  "samedi":   [{ "start1": "09:00", "end1": "16:00", "start2": "", "end2": "", "isBook": true }],
  "dimanche": [{ "start1": "", "end1": "", "start2": "", "end2": "", "isBook": false }]
}
```

### 4.2 `admin` *(à initialiser manuellement)*
Liste les comptes autorisés à accéder à l'interface `/admin`. Crée un document par administrateur après avoir créé son compte dans Authentication.

> **Important (règles de sécurité)** : l'**ID du document doit être l'UID** de l'admin (et non un ID automatique). Les règles Firestore (`firestore.rules`) reconnaissent un admin par `admin/<UID>`.

```json
// Document : admin/<UID_FIREBASE_AUTH_DE_L_ADMIN>
{
  "admin_id": "<UID_FIREBASE_AUTH_DE_L_ADMIN>"
}
```

### 4.3 `users` *(créé automatiquement à l'inscription, ID du document = `uid`)*
```json
{
  "uid": "string (UID Firebase Auth)",
  "email": "string",
  "nom": "string (minuscules)",
  "prenom": "string (minuscules)",
  "birthdate": "string (ex. '1990-05-12')",
  "scissor": 0,
  "avatar": "string (URL Firebase Storage)"
}
```
> Pense à créer aussi un document correspondant dans `users/{uid}` pour ton compte admin si tu le crées directement depuis la console Firebase Auth.

### 4.4 `rendez_vous` *(géré par l'app)*
```json
{
  "date": "Timestamp Firestore",
  "type": "string (type de prestation)",
  "user_id": "string (UID client)",
  "nom": "string",
  "prenom": "string",
  "scissor": 0,
  "avatar": "string (URL)"
}
```

### 4.5 `blocked_days` *(géré depuis `/admin/admin-schedule`)*
```json
{
  "date": "Timestamp Firestore"
}
```

### 4.6 `beer-selection` *(géré depuis `/admin/admin-beers`)*
> Note : le champ du nom est bien **`nom`** en base (même si le modèle TypeScript déclare `name`).
```json
{
  "nom": "string",
  "description": "string",
  "imageUrl": "string (URL Firebase Storage)"
}
```

### 4.7 `messages` *(géré par la messagerie client/admin)*
```json
{
  "from_id": "string (UID expéditeur)",
  "to_id": "string (UID destinataire)",
  "msg": "string",
  "date": "Timestamp Firestore (ou nombre/date)",
  "is_read": false
}
```

### 4.8 `demo` *(optionnel)*
Utilisée uniquement par `UsersService.getDemo()`. Attention : `LoginDemoComponent` contient des identifiants en dur (`contact@tract.be` / `userDEMO123`) à modifier ou retirer avant mise en production.

---

## 5. Index composites Firestore

Plusieurs requêtes combinent `.where(...)` et `.orderBy(...)`. Au premier lancement, Firestore affichera dans la console navigateur un lien direct pour créer automatiquement chaque index manquant :
- `messages` : `(from_id ASC, date DESC)`, `(to_id ASC, date DESC)`, `(from_id ASC, to_id ASC, date ASC)`
- `rendez_vous` : `(user_id ASC, date ASC)` et `(user_id ASC, date DESC)`

---

## 5 bis. Règles de sécurité Firestore

Le fichier `firestore.rules` (référencé dans `firebase.json`) contient les règles. Pour les déployer :

```bash
npm install -g firebase-tools
firebase login
firebase use <TON_PROJET>
firebase deploy --only firestore:rules,storage
```

`storage.rules` organise le bucket en deux zones : `images/` (photos de bières et `AVATAR.svg`, écriture réservée aux admins) et `avatars/<uid>/` (avatars envoyés par les utilisateurs, formats JPEG/PNG/WebP/GIF, 5 Mo max). Le composant `file-upload` écrit désormais dans `avatars/<uid>/`. Les règles Storage s'appuient sur le document `admin/<UID>` de Firestore : déploie les deux ensemble.

### Tester les règles (émulateur)

Le dossier `rules-tests/` contient 41 tests automatiques (Firestore + Storage) qui rejouent les opérations réelles de l'app : inscription, réservation, messagerie, pages admin, uploads. Ils passent tous.

Prérequis : **Java 21 ou plus** (l'émulateur ne fonctionne pas avec Java 8).

```bash
cd rules-tests
npm install
npm test
```

Relance-les après toute modification de `firestore.rules` ou `storage.rules`. Ils ne remplacent pas un test de bout en bout avec ton vrai projet Firebase avant la mise en production.

---

## 6. Points d'attention repérés lors de l'audit

1. **Sécurité des routes admin (`src/app/services/auth-guard.service.ts`)** : le guard vérifie uniquement `/admin`, `/admin/admin-rendez-vous`, `/admin/admin-message` et `/admin/admin-schedule`, mais laisse passer un accès direct à `/admin/admin-beers`, `/admin/admin-users`, `/admin/admin-params` et `/admin/appointment-manager`. Il faudra corriger le guard (`state.url.startsWith('/admin')`) **et** sécuriser côté serveur avec des **Firestore Security Rules**.
2. **Identifiants de démo en dur (`src/app/auth/components/login-demo/login-demo.component.ts`)** : à supprimer ou remplacer par ton propre compte démo.
3. **Configuration Capacitor (`capacitor.config.json`)** : `webDir` vaut actuellement `"dist"`, alors que `angular.json` génère le build dans `"dist/cafe_ciseaux"`. Pense à mettre `"webDir": "dist/cafe_ciseaux"` avant de lancer `npx cap sync`.
4. **Crédits footer** : les crédits de l'ancien développeur (Dylan Bigare / `tract.be`) dans `src/app/footer/footer.component.html` sont conservés comme demandé.
