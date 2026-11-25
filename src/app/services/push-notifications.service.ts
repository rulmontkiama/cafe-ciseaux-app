import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging, Importance, Visibility } from '@capacitor-firebase/messaging';
import firebase from 'firebase/compat/app';
import { firstValueFrom } from 'rxjs';
import { AlertService } from './alert.service';

const MAX_TOKENS_PER_USER = 10;

@Injectable({
  providedIn: 'root',
})
export class PushNotificationsService {
  private listenersBound = false;
  private channelCreated = false;
  private activeUid: string | null = null;
  private currentToken: string | null = null;
  private lastSavedKey: string | null = null;
  private initInFlight = false;

  constructor(
    private db: AngularFirestore,
    private router: Router,
    private ngZone: NgZone,
    private alertService: AlertService
  ) {}

  /**
   * Initialise les notifications push natives (iOS / Android) pour l'utilisateur connecté.
   * No-op silencieux sur le Web.
   */
  async initForUser(uid: string): Promise<void> {
    if (!uid || !Capacitor.isNativePlatform()) {
      return;
    }

    this.activeUid = uid;
    await this.bindListenersOnce();
    await this.ensureAndroidChannel();

    if (this.initInFlight) {
      return;
    }
    this.initInFlight = true;

    try {
      const perm = await FirebaseMessaging.checkPermissions();
      let receiveStatus = perm?.receive;
      if (receiveStatus === 'prompt' || receiveStatus === 'prompt-with-rationale') {
        const req = await FirebaseMessaging.requestPermissions();
        receiveStatus = req?.receive;
      }

      if (receiveStatus !== 'granted') {
        return;
      }

      const token = await this.fetchTokenWithRetry();
      if (token && this.activeUid === uid) {
        this.currentToken = token;
        await this.saveTokenForUser(uid, token);
      }
    } catch (err) {
      console.warn('[Push] Initialisation différée ou impossible :', err);
    } finally {
      this.initInFlight = false;
    }
  }

  /**
   * Retire le jeton FCM de l'appareil lors de la déconnexion pour éviter
   * que cet appareil ne continue à recevoir des notifications pour l'ancien compte.
   */
  async removeCurrentToken(uid?: string | null): Promise<void> {
    const targetUid = uid || this.activeUid;
    const token = this.currentToken;
    this.activeUid = null;
    this.lastSavedKey = null;

    if (!Capacitor.isNativePlatform() || !targetUid) {
      return;
    }

    let tokenToRemove = token;
    if (!tokenToRemove) {
      try {
        const res = await Promise.race([
          FirebaseMessaging.getToken(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
        ]);
        tokenToRemove = res?.token || null;
      } catch {
        tokenToRemove = null;
      }
    }

    if (!tokenToRemove) {
      return;
    }

    try {
      await Promise.race([
        this.db.doc(`users/${targetUid}`).update({
          fcmTokens: firebase.firestore.FieldValue.arrayRemove(tokenToRemove),
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch {
      // Silencieux si hors ligne ou profil déjà supprimé
    }
  }

  private async bindListenersOnce(): Promise<void> {
    if (this.listenersBound) {
      return;
    }
    this.listenersBound = true;

    try {
      await FirebaseMessaging.addListener('tokenReceived', (event) => {
        const token = event?.token;
        if (!token) return;
        this.currentToken = token;
        if (this.activeUid) {
          this.saveTokenForUser(this.activeUid, token).catch(() => {});
        }
      });

      await FirebaseMessaging.addListener('notificationReceived', (event) => {
        // Sur iOS, presentationOptions affiche déjà la bannière système en premier plan.
        // Sur Android, on affiche une alerte discrète uniquement hors écran de messagerie.
        if (Capacitor.getPlatform() !== 'android') {
          return;
        }
        const currentPath = this.router.url.split('?')[0];
        if (currentPath === '/user-message' || currentPath === '/admin/admin-message') {
          return;
        }
        const title = event?.notification?.title || 'Café Ciseaux';
        const body = event?.notification?.body || 'Vous avez reçu un nouveau message';
        this.ngZone.run(() => {
          this.alertService.showInfo(title, body);
        });
      });

      await FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        const rawData = (event?.notification?.data || {}) as Record<string, any>;
        const route = typeof rawData['route'] === 'string' ? rawData['route'] : '';
        const fromUid = typeof rawData['fromUid'] === 'string' ? rawData['fromUid'] : '';

        this.ngZone.run(() => {
          if (route === '/admin/admin-message') {
            this.router.navigate(['/admin/admin-message'], {
              queryParams: fromUid ? { uid: fromUid } : undefined,
            });
          } else {
            this.router.navigate(['/user-message']);
          }
        });
      });
    } catch (err) {
      console.warn('[Push] Impossible d’attacher les écouteurs natifs :', err);
    }
  }

  private async ensureAndroidChannel(): Promise<void> {
    if (this.channelCreated || Capacitor.getPlatform() !== 'android') {
      return;
    }
    this.channelCreated = true;
    try {
      await FirebaseMessaging.createChannel({
        id: 'messages',
        name: 'Messages',
        description: 'Notifications de nouveaux messages Café Ciseaux',
        importance: Importance.High,
        visibility: Visibility.Public,
        vibration: true,
      });
    } catch {
      // Silencieux sur anciennes versions d'Android (< 8.0)
    }
  }

  private async fetchTokenWithRetry(): Promise<string | null> {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const result = await FirebaseMessaging.getToken();
        if (result?.token) {
          return result.token;
        }
      } catch {
        // Sur iOS au tout premier lancement, le jeton APNs peut mettre ~1-2s à arriver
      }
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    return null;
  }

  private async saveTokenForUser(uid: string, token: string): Promise<void> {
    const cleanToken = (token || '').trim();
    if (!uid || !cleanToken) return;

    const saveKey = `${uid}:${cleanToken}`;
    if (this.lastSavedKey === saveKey) {
      return;
    }

    const userRef = this.db.doc(`users/${uid}`);
    let snap = await firstValueFrom(userRef.get()).catch(() => null);

    // Si le compte vient tout juste d'être créé (Google/Apple Sign-In), attendre brièvement la création du profil
    if (!snap?.exists) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      snap = await firstValueFrom(userRef.get()).catch(() => null);
    }
    if (!snap?.exists) {
      return;
    }

    const data: any = snap.data() || {};
    const existing: string[] = Array.isArray(data.fcmTokens)
      ? data.fcmTokens.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
      : [];

    if (existing.includes(cleanToken)) {
      this.lastSavedKey = saveKey;
      return;
    }

    if (existing.length >= MAX_TOKENS_PER_USER) {
      const trimmed = [...existing.slice(-(MAX_TOKENS_PER_USER - 1)), cleanToken];
      await userRef.update({ fcmTokens: trimmed });
    } else {
      await userRef.update({
        fcmTokens: firebase.firestore.FieldValue.arrayUnion(cleanToken),
      });
    }
    this.lastSavedKey = saveKey;
  }
}
