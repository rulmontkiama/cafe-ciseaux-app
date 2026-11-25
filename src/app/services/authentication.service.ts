
import { Injectable, NgZone } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { Users } from '../models/users';
import { UsersService } from './users.service';
import { AdminService } from './admin.service';
import { environment } from 'src/environments/environment';
import { Capacitor } from '@capacitor/core';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, firstValueFrom } from 'rxjs';
import firebase from 'firebase/compat/app';
import { GoogleAuthProvider, OAuthProvider } from 'firebase/auth';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { PushNotificationsService } from './push-notifications.service';
@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  //currentUser$ = authState(this.auth);
  userData: any
  existingAdminIds: any[] = [];
  private googleProviderCtor: any = null;
  private oAuthProviderCtor: any = null;
  constructor( 
    public afAuth: AngularFireAuth, // Inject Firebase auth service
    public router: Router,
    private db: AngularFirestore,
    private storage: AngularFireStorage,
    public adminService:AdminService,
    public ngZone: NgZone,    
    private usersService:UsersService,
    private pushService: PushNotificationsService
    ){
     // Précharge les constructeurs depuis la même instance Firebase que AngularFireAuth
     // (évite auth/argument-error lorsque @angular/fire utilise sa propre copie interne de firebase)
     Promise.resolve((this.afAuth as any).app)
       .then((app: any) => {
         this.googleProviderCtor = app?.firebase?.auth?.GoogleAuthProvider ?? null;
         this.oAuthProviderCtor = app?.firebase?.auth?.OAuthProvider ?? null;
       })
       .catch(() => {});

     this.afAuth.authState.subscribe((user) => {
        if (user) {
          this.userData = user;
          this.setDataInLocalStorage('userData', JSON.stringify(this.userData));
        } else {
          this.userData = null;
          this.setDataInLocalStorage('userData','null');
          // Firebase n'a plus de session : on efface aussi la copie locale (token, profil, admins)
          // pour que l'app ne se croie jamais connectée à tort.
          ['token', 'userInfos', 'admin_id'].forEach(k => localStorage.removeItem(k));
        }
     })
     
    }
    get authState$(): Observable<firebase.User | null> {
      return this.afAuth.authState;
    }
    async deleteAccount(uid: string): Promise<boolean> {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error("L'utilisateur n'est pas authentifié.");
      }

      const confirmation = window.confirm(
        'Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.'
      );
      if (!confirmation) {
        return false;
      }

      // Sauvegarde temporaire du profil pour le restaurer si Firebase exige une reconnexion récente
      const userDocRef = this.db.collection('users').doc(uid);
      const snap = await firstValueFrom(userDocRef.get());
      const backup = snap?.exists ? snap.data() : null;

      try {
        if (backup) {
          await userDocRef.delete();
        }
        await user.delete();
        this.clearStorage();
        this.router.navigate(['/']);
        return true;
      } catch (error) {
        // Restaure le profil Firestore pour éviter un compte orphelin si user.delete() échoue
        if (backup) {
          try {
            await userDocRef.set(backup);
          } catch (restoreErr) {
            console.error('Impossible de restaurer le profil après échec :', restoreErr);
          }
        }
        console.error('Une erreur s\'est produite lors de la suppression du compte :', error);
        throw error;
      }
    }
  setAdminIds(res:any){
    // Liste neuve à chaque appel (avant : doublons qui s'accumulaient à chaque connexion)
    this.existingAdminIds = (res || []).map((a:any) => a.admin_id).filter((id:any) => !!id);
    this.setDataInLocalStorage('admin_id', JSON.stringify(this.existingAdminIds));
  }
  /** Première id admin (destinataire des messages des clients), ou null s'il n'y en a aucune. */
  getFirstAdminId(): string | null {
    const ids = this.getAdminId();
    return Array.isArray(ids) && ids.length > 0 ? ids[0] : null;
  }
  /**
   * Recopie la session Firebase dans le localStorage : profil (userInfos), liste des admins
   * et marqueur de session (token). Retourne false si le profil Firestore est introuvable.
   * Appelée après connexion, après inscription, et par le guard quand la copie locale manque.
   */
  async hydrateSession(user: any): Promise<boolean> {
    if (!user) return false;
    try {
      const [profiles, admins] = await Promise.all([
        this.usersService.getUser(user.uid),
        this.adminService.getAdmin().catch(() => []),
      ]);
      const profile = profiles && profiles[0];
      if (!profile) return false;
      this.setAdminIds(admins);
      this.setDataInLocalStorage('token', this.generateSessionMarker());
      this.setDataInLocalStorage('userInfos', JSON.stringify(profile));
      this.pushService.initForUser(user.uid).catch(() => {});
      return true;
    } catch (error) {
      console.error('Impossible de charger le profil', error);
      return false;
    }
  }
  /**
   * Connexion. Retourne true si OK, false si identifiants incorrects.
   * Rejette avec PROFILE_NOT_FOUND si le compte existe mais n'a pas de profil Firestore,
   * ou avec l'erreur Firebase pour les autres cas (réseau, trop de tentatives...).
   */
  async login(email: string, password: string): Promise<boolean> {
    try {
      const cleanEmail = (email || '').trim();
      const result: any = await this.afAuth.signInWithEmailAndPassword(cleanEmail, password);
      const ok = await this.hydrateSession(result.user);
      if (!ok) {
        await this.afAuth.signOut();
        throw new Error('PROFILE_NOT_FOUND');
      }
      const adminIds = this.getAdminId();
      const targetRoute = Array.isArray(adminIds) && adminIds.includes(result.user.uid) ? 'admin' : 'profile';
      this.router.navigate([targetRoute]);
      return true;
    } catch (error: any) {
      // Firebase v10 renvoie auth/invalid-credential (plus seulement auth/wrong-password)
      if (['auth/wrong-password', 'auth/invalid-credential', 'auth/user-not-found', 'auth/invalid-email'].includes(error?.code)) {
        return false;
      }
      throw error;
    }
  }

   // Send email verfificaiton when new user sign up
  /** Marqueur de session local (32 caractères aléatoires). Ce n'est pas un secret : la vraie session est celle de Firebase. */
  private generateSessionMarker(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  }
  SendVerificationMail() {
    return this.afAuth.currentUser
      .then((u: any) => u.sendEmailVerification())
      .then(() => {
        this.router.navigate(['verify-email-address']);
      });
  }
  // Réinitialisation du mot de passe (retourne la Promise pour que le composant affiche le toast adapté)
  ForgotPassword(passwordResetEmail: string): Promise<void> {
    return this.afAuth.sendPasswordResetEmail((passwordResetEmail || '').trim());
  }
  private async getAuthConstructors(): Promise<{ GoogleProviderCtor: any; OAuthProviderCtor: any }> {
    if (!this.googleProviderCtor || !this.oAuthProviderCtor) {
      const app: any = await Promise.resolve((this.afAuth as any).app);
      this.googleProviderCtor = app?.firebase?.auth?.GoogleAuthProvider || GoogleAuthProvider;
      this.oAuthProviderCtor = app?.firebase?.auth?.OAuthProvider || OAuthProvider;
    }
    return {
      GoogleProviderCtor: this.googleProviderCtor,
      OAuthProviderCtor: this.oAuthProviderCtor
    };
  }

  private async finalizeSocialLogin(user: any, fallbackDisplayName?: string | null): Promise<boolean> {
    if (!user) {
      return false;
    }
    await this.ensureSocialProfile(user, fallbackDisplayName);
    const ok = await this.hydrateSession(user);
    if (!ok) {
      await this.afAuth.signOut();
      throw new Error('PROFILE_NOT_FOUND');
    }
    const adminIds = this.getAdminId();
    const targetRoute = Array.isArray(adminIds) && adminIds.includes(user.uid) ? 'admin' : 'profile';
    this.router.navigate([targetRoute]);
    return true;
  }

  /**
   * Connexion avec Google (SDK natif sur iOS/Android via Capacitor, popup Firebase sur Web).
   * Crée le profil Firestore au premier passage, puis charge la session locale.
   */
  async loginWithGoogle(): Promise<boolean> {
    const { GoogleProviderCtor } = await this.getAuthConstructors();

    if (Capacitor.isNativePlatform()) {
      const nativeRes = await FirebaseAuthentication.signInWithGoogle();
      const idToken = nativeRes?.credential?.idToken;
      const accessToken = nativeRes?.credential?.accessToken;
      if (!idToken) {
        return false;
      }
      const credential = GoogleProviderCtor.credential(idToken, accessToken || null);
      const result: any = await this.afAuth.signInWithCredential(credential);
      return this.finalizeSocialLogin(result?.user, nativeRes?.user?.displayName);
    }

    const provider = new GoogleProviderCtor();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result: any = await this.afAuth.signInWithPopup(provider);
    return this.finalizeSocialLogin(result?.user);
  }

  /**
   * Connexion avec Apple (SDK natif Sign in with Apple sur iOS / OAuth natif sur Android,
   * popup Firebase OAuthProvider('apple.com') sur Web).
   */
  async loginWithApple(): Promise<boolean> {
    const { OAuthProviderCtor } = await this.getAuthConstructors();

    if (Capacitor.isNativePlatform()) {
      const nativeRes = await FirebaseAuthentication.signInWithApple();
      const idToken = nativeRes?.credential?.idToken;
      const rawNonce = nativeRes?.credential?.nonce;
      if (!idToken) {
        return false;
      }
      const provider = new OAuthProviderCtor('apple.com');
      const credential = provider.credential({
        idToken,
        rawNonce: rawNonce || undefined
      });
      const result: any = await this.afAuth.signInWithCredential(credential);
      return this.finalizeSocialLogin(result?.user, nativeRes?.user?.displayName);
    }

    const provider = new OAuthProviderCtor('apple.com');
    provider.addScope('email');
    provider.addScope('name');
    provider.setCustomParameters({ locale: 'fr' });
    const result: any = await this.afAuth.signInWithPopup(provider);
    return this.finalizeSocialLogin(result?.user);
  }

  /** Crée users/<uid> s'il n'existe pas (nom et prénom tirés du nom affiché du compte). */
  private async ensureSocialProfile(user: any, fallbackDisplayName?: string | null): Promise<void> {
    const existing = await this.usersService.getUser(user.uid);
    if (existing && existing[0]) {
      return;
    }
    const rawName = (user.displayName || fallbackDisplayName || '').trim();
    const parts = rawName.split(/\s+/).filter(Boolean);
    // Si le nom affiché est absent (ex. relai privé Apple), on prend le début de l'e-mail comme prénom
    const prenom = parts[0] || (user.email || '').split('@')[0] || 'client';
    const nom = parts.slice(1).join(' ');
    const userData: Users = {
      uid: user.uid,
      email: user.email || '',
      nom: nom.toLowerCase(),
      prenom: prenom.toLowerCase(),
      birthdate: '',
      phone: '',
      scissor: 0,
      avatar: user.photoURL || 'assets/AVATAR.svg',
    };
    await this.db.doc(`users/${user.uid}`).set(userData);
  }
  /** Message à afficher pour une erreur de connexion Google / Apple, ou null si annulé par l'utilisateur. */
  socialLoginErrorMessage(error: any): string | null {
    const code = String(error?.code || '');
    const rawMsg = String(error?.message || '').toLowerCase();

    // Annulation volontaire par l'utilisateur (Web, iOS Google/Apple, Android)
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      code === '12501' ||
      code === '1001' ||
      code === '-5' ||
      rawMsg.includes('cancel') ||
      rawMsg.includes('user_canceled') ||
      rawMsg.includes('1001')
    ) {
      return null;
    }

    switch (code) {
      case 'auth/popup-blocked':
        return 'la fenêtre de connexion a été bloquée par le navigateur, autorisez les popups pour ce site';
      case 'auth/account-exists-with-different-credential':
        return "un compte existe déjà avec cet e-mail : connectez-vous avec votre mot de passe ou avec l'autre méthode";
      case 'auth/operation-not-allowed':
        return "cette méthode de connexion n'est pas encore activée dans Firebase";
      case 'auth/unauthorized-domain':
        return "ce site n'est pas autorisé dans Firebase (Authentication > Paramètres > Domaines autorisés)";
      case 'auth/network-request-failed':
        return 'vérifiez votre connexion internet';
    }
    if (rawMsg.includes('1000') || rawMsg.includes('authorizationerror')) {
      return 'Sign in with Apple nécessite la signature développeur Apple sur cet appareil';
    }
    if (error?.message === 'PROFILE_NOT_FOUND') {
      return "votre compte n'a pas de profil, contactez le salon";
    }
    console.error(error);
    return 'connexion impossible, réessayez';
  }

    /* Setting up user data when sign in with username/password, 
  sign up with username/password and sign in with social auth  
  provider in Firestore database using AngularFirestore + AngularFirestoreDocument service */
  SetUserData(user: any) {
    
    const userRef: AngularFirestoreDocument<any> = this.db.doc(
      `users/${user.uid}`
    );
    const userData: Users = {
      uid: user.uid,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      birthdate: user.birthdate || '',
      phone: (user.phone || '').trim(),
      scissor: 0,
      avatar: user.avatar,
    };
    return userRef.set(userData, {
      merge: true,
    });
  }
  // Sign Up : crée le compte Auth, le profil Firestore et la session locale
  async signUp(registerForm: any): Promise<boolean> {
    const cleanEmail = (registerForm.email || '').trim().toLowerCase();
    const { password } = registerForm;
    const result: any = await this.afAuth.createUserWithEmailAndPassword(cleanEmail, password);
    const user = result.user;
    // Avatar par défaut : image locale de l'app (assets/AVATAR.svg). Si Firebase Storage est activé
    // (environment.useStorage), on utilise plutôt celle de Storage, avec l'image locale en secours.
    let avatarUrl = 'assets/AVATAR.svg';
    if (environment.useStorage) {
      try {
        avatarUrl = await firstValueFrom(this.storage.ref('images/AVATAR.svg').getDownloadURL());
      } catch (e) {
        console.warn('images/AVATAR.svg introuvable dans Firebase Storage : avatar local utilisé', e);
      }
    }
    const payload = {
      ...registerForm,
      email: cleanEmail,
      nom: (registerForm.nom || '').trim().toLowerCase(),
      prenom: (registerForm.prenom || '').trim().toLowerCase(),
      avatar: avatarUrl,
      uid: user.uid
    };
    await this.SetUserData(payload);
    // L'utilisateur est déjà connecté côté Firebase : on charge sa session locale
    await this.hydrateSession(user);
    await this.SendVerificationMail().catch((err) => {
      console.warn('Envoi e-mail de vérification différé :', err);
      this.router.navigate(['verify-email-address']);
    });
    return true;
  }

    // Sign out
    async SignOut() {
      const currentUid = this.userData?.uid || this.getId();
      await this.pushService.removeCurrentToken(currentUid).catch(() => {});
      this.clearStorage();
      if (Capacitor.isNativePlatform()) {
        FirebaseAuthentication.signOut().catch(() => {});
      }
      return this.afAuth.signOut().then(() => {
        this.router.navigate(['login']);
      });
    }


  getUserDetails() {
    if(localStorage.getItem('userData')){
      return localStorage.getItem('userData')
    }else{
      return null
    }    
  }
  getUserInfos() {
    if(localStorage.getItem('userInfos')){
      return  JSON.parse(localStorage.getItem('userInfos')|| '{}');
    }else{
      return null
    }    
  }
  setDataInLocalStorage(variableName: string, data: string) {
      localStorage.setItem(variableName, data);
  }
  editDataInLocalStorage(key:string, itemIndex:any, newValue:any) {
    let data = JSON.parse(localStorage.getItem(key) || '[]');
    data[itemIndex] = newValue;
    localStorage.setItem(key, JSON.stringify(data));
    return true;
}
  getToken() {
      return localStorage.getItem('token');
  }
  getId() {
    let data = JSON.parse(localStorage.getItem('userInfos')|| '{}');
    
    return data.uid
}
  getAdminId() {
    return JSON.parse(localStorage.getItem('admin_id') || '[]');
  }
  clearStorage() {
      localStorage.clear();
  }
}
