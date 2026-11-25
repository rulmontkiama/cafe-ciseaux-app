import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Capacitor } from '@capacitor/core';
import { FirebaseMessaging, Importance, Visibility } from '@capacitor-firebase/messaging';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { AlertService } from './alert.service';

const MAX_TOKENS_PER_USER = 10;

export interface PushStatusState {
  supported: boolean;
  permission: 'prompt' | 'granted' | 'denied' | 'unknown';
  registered: boolean;
  busy: boolean;
  detail: string;
}

@Injectable({
  providedIn: 'root',
})
export class PushNotificationsService {
  private listenersBound = false;
  private visibilityBound = false;
  private channelCreated = false;
  private activeUid: string | null = null;
  private currentToken: string | null = null;
  private lastSavedKey: string | null = null;
  private initInFlight = false;

  readonly status$ = new BehaviorSubject<PushStatusState>({
    supported: Capacitor.isNativePlatform(),
    permission: 'unknown',
    registered: false,
    busy: false,
    detail: '',
  });

  constructor(
    private db: AngularFirestore,
    private router: Router,
    private ngZone: NgZone,
    private alertService: AlertService
  ) {}

  get isNativeSupported(): boolean {
    return Capacitor.isNativePlatform();
  }

  private setStatus(partial: Partial<PushStatusState>): void {
    this.ngZone.run(() => {
      this.status$.next({
        ...this.status$.value,
        ...partial,
      });
    });
  }

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
    this.bindResumeListenerOnce();
    await this.ensureAndroidChannel();

    if (this.initInFlight) {
      return;
    }
    this.initInFlight = true;
    this.setStatus({ busy: true });

    try {
      const perm = await FirebaseMessaging.checkPermissions();
      let receiveStatus = perm?.receive || 'prompt';

      if (receiveStatus !== 'granted' && receiveStatus !== 'denied') {
        const req = await FirebaseMessaging.requestPermissions();
        receiveStatus = req?.receive || 'denied';
      }

      if (receiveStatus !== 'granted') {
        this.setStatus({
          permission: receiveStatus === 'denied' ? 'denied' : 'prompt',
          registered: false,
          busy: false,
          detail:
            receiveStatus === 'denied'
              ? 'Autorisez les notifications dans Réglages > Café Ciseaux > Notifications.'
              : 'Appuyez sur Activer pour recevoir les alertes de messages.',
        });
        return;
      }

      this.setStatus({ permission: 'granted' });
      const { token, error } = await this.fetchTokenWithRetry();
      if (token && this.activeUid === uid) {
        this.currentToken = token;
        const saved = await this.saveTokenForUser(uid, token);
        this.setStatus({
          permission: 'granted',
          registered: saved,
          busy: false,
          detail: saved
            ? 'Vous recevrez une alerte à chaque nouveau message.'
            : 'Enregistrement du profil en attente, réessayez dans un instant.',
        });
      } else {
        this.setStatus({
          permission: 'granted',
          registered: false,
          busy: false,
          detail: error
            ? `Enregistrement push en attente (${error}).`
            : 'Appuyez sur Activer pour finaliser la connexion aux notifications.',
        });
      }
    } catch (err: any) {
      const msg = String(err?.message || err || '').slice(0, 120);
      console.warn('[Push] Initialisation différée ou impossible :', msg);
      this.setStatus({
        busy: false,
        registered: false,
        detail: msg ? `Impossible d’activer pour le moment (${msg}).` : '',
      });
    } finally {
      this.initInFlight = false;
    }
  }

  /**
   * Déclenchement explicite depuis un bouton (geste utilisateur sur Mon profil).
   */
  async enableManually(uid: string): Promise<PushStatusState> {
    if (!uid || !Capacitor.isNativePlatform()) {
      return this.status$.value;
    }

    this.activeUid = uid;
    this.lastSavedKey = null;
    await this.bindListenersOnce();
    this.bindResumeListenerOnce();
    await this.ensureAndroidChannel();

    this.setStatus({ busy: true, detail: 'Activation en cours…' });

    try {
      const req = await FirebaseMessaging.requestPermissions();
      const receiveStatus = req?.receive || 'denied';
      if (receiveStatus !== 'granted') {
        this.setStatus({
          permission: receiveStatus === 'denied' ? 'denied' : 'prompt',
          registered: false,
          busy: false,
          detail: 'Activez les notifications dans Réglages > Café Ciseaux > Notifications.',
        });
        return this.status$.value;
      }

      this.setStatus({ permission: 'granted' });
      const { token, error } = await this.fetchTokenWithRetry();
      if (!token) {
        this.setStatus({
          permission: 'granted',
          registered: false,
          busy: false,
          detail: error
            ? `Jeton Apple/Firebase indisponible (${error}).`
            : 'Jeton push indisponible sur cet appareil.',
        });
        return this.status$.value;
      }

      this.currentToken = token;
      const saved = await this.saveTokenForUser(uid, token);
      this.setStatus({
        permission: 'granted',
        registered: saved,
        busy: false,
        detail: saved
          ? 'Vous recevrez une alerte à chaque nouveau message.'
          : 'Impossible d’enregistrer cet appareil dans votre profil.',
      });
      return this.status$.value;
    } catch (err: any) {
      const msg = String(err?.message || err || '').slice(0, 120);
      this.setStatus({
        busy: false,
        registered: false,
        detail: msg || 'Activation impossible pour le moment.',
      });
      return this.status$.value;
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
    this.setStatus({ registered: false, busy: false, detail: '' });

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
      const userRef = this.db.doc(`users/${targetUid}`);
      await Promise.race([
        (async () => {
          const snap = await firstValueFrom(userRef.get()).catch(() => null);
          if (!snap?.exists) return;
          const data: any = snap.data() || {};
          const existing: string[] = Array.isArray(data.fcmTokens)
            ? data.fcmTokens.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
            : [];
          const remaining = existing.filter((t) => t !== tokenToRemove);
          if (remaining.length !== existing.length) {
            await userRef.update({ fcmTokens: remaining });
          }
        })(),
        new Promise<void>((resolve) => setTimeout(resolve, 2500)),
      ]);
    } catch {
      // Silencieux si hors ligne ou profil déjà supprimé
    }
  }

  private bindResumeListenerOnce(): void {
    if (this.visibilityBound || typeof document === 'undefined') {
      return;
    }
    this.visibilityBound = true;
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.activeUid) {
        this.initForUser(this.activeUid).catch(() => {});
      }
    });
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
          this.saveTokenForUser(this.activeUid, token)
            .then((saved) => {
              if (saved) {
                this.setStatus({
                  permission: 'granted',
                  registered: true,
                  busy: false,
                  detail: 'Vous recevrez une alerte à chaque nouveau message.',
                });
              }
            })
            .catch(() => {});
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

  private async fetchTokenWithRetry(): Promise<{ token: string | null; error: string }> {
    let lastError = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await FirebaseMessaging.getToken();
        if (result?.token) {
          return { token: result.token, error: '' };
        }
      } catch (err: any) {
        lastError = String(err?.message || err || '').slice(0, 100);
      }
      if (attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
    return { token: null, error: lastError };
  }

  private async saveTokenForUser(uid: string, token: string): Promise<boolean> {
    const cleanToken = (token || '').trim();
    if (!uid || !cleanToken) return false;

    const saveKey = `${uid}:${cleanToken}`;
    if (this.lastSavedKey === saveKey) {
      return true;
    }

    const userRef = this.db.doc(`users/${uid}`);
    let snap = await firstValueFrom(userRef.get()).catch(() => null);

    // Si le compte vient tout juste d'être créé (Google/Apple Sign-In), attendre brièvement la création du profil
    if (!snap?.exists) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      snap = await firstValueFrom(userRef.get()).catch(() => null);
    }
    if (!snap?.exists) {
      return false;
    }

    const data: any = snap.data() || {};
    const existing: string[] = Array.isArray(data.fcmTokens)
      ? data.fcmTokens.filter((t: any) => typeof t === 'string' && t.trim().length > 0)
      : [];

    if (existing.includes(cleanToken)) {
      this.lastSavedKey = saveKey;
      return true;
    }

    // Tableau pur string[] (évite tout conflit d'instance FieldValue entre firebase@10 et @angular/fire@7)
    const nextTokens = [...existing.slice(-(MAX_TOKENS_PER_USER - 1)), cleanToken];
    await userRef.update({ fcmTokens: nextTokens });
    this.lastSavedKey = saveKey;
    return true;
  }
}
