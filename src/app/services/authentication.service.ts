
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
@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  //currentUser$ = authState(this.auth);
  userData: any
  existingAdminIds: any[] = [];
  constructor( 
    public afAuth: AngularFireAuth, // Inject Firebase auth service
    public router: Router,
    private db: AngularFirestore,
    private storage: AngularFireStorage,
    public adminService:AdminService,
    public ngZone: NgZone,    
    private usersService:UsersService
    ){
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
    async deleteAccount(uid: string): Promise<void> {
      try {
        // Vérifier l'authentification de l'utilisateur
        const user = await this.afAuth.currentUser;
        if (!user) {
          throw new Error('L\'utilisateur n\'est pas authentifié.');
        }
  
        // Demander une confirmation de suppression
        const confirmation = window.confirm('Êtes-vous sûr de vouloir supprimer votre compte ? Cette action est irréversible.');
  
        if (confirmation) {
          // Supprimer le compte
          await this.db.collection('users').doc(uid).delete();
          await user.delete();
          
         
        } else {
        }
      } catch (error) {
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
      const result: any = await this.afAuth.signInWithEmailAndPassword(email, password);
      const ok = await this.hydrateSession(result.user);
      if (!ok) {
        await this.afAuth.signOut();
        throw new Error('PROFILE_NOT_FOUND');
      }
      this.router.navigate(['profile']);
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
  // Reset Forggot password
  ForgotPassword(passwordResetEmail: string) {
    return this.afAuth
      .sendPasswordResetEmail(passwordResetEmail)
      .then(() => {
        window.alert('Password reset email sent, check your inbox.');
      })
      .catch((error) => {
        window.alert(error);
      });
  }
  /**
   * Connexion avec Google ou Apple (fenêtre popup Firebase).
   * Crée le profil Firestore au premier passage, puis charge la session locale.
   * Retourne true si connecté ; rejette avec l'erreur Firebase (ou PROFILE_NOT_FOUND,
   * SOCIAL_NOT_SUPPORTED_NATIVE) sinon : voir socialLoginErrorMessage().
   */
  async loginWithProvider(providerName: 'google' | 'apple'): Promise<boolean> {
    // Dans l'app mobile (WebView), Google refuse les popups et Apple exige un plugin natif
    if (Capacitor.isNativePlatform()) {
      throw new Error('SOCIAL_NOT_SUPPORTED_NATIVE');
    }
    let provider: any;
    if (providerName === 'google') {
      provider = new firebase.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
    } else {
      provider = new firebase.auth.OAuthProvider('apple.com');
      provider.addScope('email');
      provider.addScope('name');
    }
    const result: any = await this.afAuth.signInWithPopup(provider);
    const user = result?.user;
    if (!user) {
      return false;
    }
    await this.ensureSocialProfile(user);
    const ok = await this.hydrateSession(user);
    if (!ok) {
      await this.afAuth.signOut();
      throw new Error('PROFILE_NOT_FOUND');
    }
    this.router.navigate(['profile']);
    return true;
  }
  /** Crée users/<uid> s'il n'existe pas (nom et prénom tirés du nom affiché du compte). */
  private async ensureSocialProfile(user: any): Promise<void> {
    const existing = await this.usersService.getUser(user.uid);
    if (existing && existing[0]) {
      return;
    }
    const parts = (user.displayName || '').trim().split(/\s+/).filter(Boolean);
    // Apple ne fournit pas toujours le nom : on prend alors le début de l'e-mail
    const prenom = parts[0] || (user.email || '').split('@')[0] || '';
    const nom = parts.slice(1).join(' ');
    const userData: Users = {
      uid: user.uid,
      email: user.email || '',
      nom: nom.toLowerCase(),
      prenom: prenom.toLowerCase(),
      birthdate: '',
      scissor: 0,
      avatar: user.photoURL || 'assets/AVATAR.svg',
    };
    await this.db.doc(`users/${user.uid}`).set(userData);
  }
  /** Message à afficher pour une erreur de connexion Google/Apple, ou null s'il faut rester silencieux. */
  socialLoginErrorMessage(error: any): string | null {
    switch (error?.code) {
      case 'auth/popup-closed-by-user':
      case 'auth/cancelled-popup-request':
        return null; // l'utilisateur a fermé la fenêtre : pas une erreur
      case 'auth/popup-blocked':
        return 'la fenêtre de connexion a été bloquée par le navigateur, autorisez les popups pour ce site';
      case 'auth/account-exists-with-different-credential':
        return "un compte existe déjà avec cet e-mail : connectez-vous avec votre mot de passe ou avec l'autre méthode";
      case 'auth/operation-not-allowed':
        return "cette méthode de connexion n'est pas activée";
      case 'auth/unauthorized-domain':
        return "ce site n'est pas autorisé dans Firebase (Authentication > Paramètres > Domaines autorisés)";
      case 'auth/network-request-failed':
        return 'vérifiez votre connexion internet';
    }
    if (error?.message === 'PROFILE_NOT_FOUND') {
      return "votre compte n'a pas de profil, contactez le salon";
    }
    if (error?.message === 'SOCIAL_NOT_SUPPORTED_NATIVE') {
      return "la connexion Google/Apple n'est pas encore disponible dans l'application mobile, utilisez votre e-mail";
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
      scissor: 0,
      avatar: user.avatar,
    };
    return userRef.set(userData, {
      merge: true,
    });
  }
// Sign Up : retourne true si le compte ET le profil ont bien été créés
  async signUp(registerForm:any): Promise<boolean> {
    const { email, password } = registerForm;
    try {
      const result: any = await this.afAuth.createUserWithEmailAndPassword(email, password);
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
      registerForm.avatar = avatarUrl;
      registerForm.uid = user.uid;
      await this.SetUserData(registerForm);
      // L'utilisateur est déjà connecté côté Firebase : on charge sa session locale
      await this.hydrateSession(user);
      this.SendVerificationMail();
      return true;
    } catch (error: any) {
      window.alert(error.message);
      return false;
    }
  }

    // Sign out
    SignOut() {
      this.clearStorage()
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
  return JSON.parse(localStorage.getItem('admin_id') || '{}');
}
  clearStorage() {
      localStorage.clear();
  }
}
