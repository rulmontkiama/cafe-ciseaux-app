
import { Injectable, NgZone } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Router } from '@angular/router';
import { Users } from '../models/users';
import { UsersService } from './users.service';
import { AdminService } from './admin.service';
import { Buffer } from 'buffer';
const crypto = require('crypto-browserify');
import * as jwt from 'jsonwebtoken';
import * as auth from 'firebase/auth';
import { AngularFirestore, AngularFirestoreDocument } from '@angular/fire/compat/firestore';
import { AngularFireStorage } from '@angular/fire/compat/storage';
import { Observable, firstValueFrom } from 'rxjs';
import firebase from 'firebase/compat/app';
import { log } from 'console';
@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  getUserId() {
    throw new Error('Method not implemented.');
  }
  private getRandomValue: (arr: any) => Buffer = require('crypto').randomBytes;
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
          console.log('Compte utilisateur supprimé avec succès.');
          console.log(uid)
          
         
        } else {
          console.log('Suppression du compte annulée.');
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
      const token = jwt.sign({ uid: profile.uid, email: profile.email }, this.generateSecretKey());
      this.setDataInLocalStorage('token', token);
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
  private generateSecretKey(): string {
    const length = 32;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * charset.length);
      key += charset.charAt(randomIndex);
    }
    return key;
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
  // Returns true when user is looged in and email is verified
  // Sign in with Google
  GoogleAuth() {
    return this.AuthLogin(new auth.GoogleAuthProvider()).then((res: any) => {
      this.router.navigate(['dashboard']);
    });
  }
  // Auth logic to run auth providers
  AuthLogin(provider: any) {
    return this.afAuth
      .signInWithPopup(provider)
      .then((result) => {
        this.router.navigate(['profile']);
        this.SetUserData(result.user);
      })
      .catch((error) => {
        window.alert(error);
      });
  }
    /* Setting up user data when sign in with username/password, 
  sign up with username/password and sign in with social auth  
  provider in Firestore database using AngularFirestore + AngularFirestoreDocument service */
  SetUserData(user: any) {
    console.log(user)
    console.log(user.email)
    
    const userRef: AngularFirestoreDocument<any> = this.db.doc(
      `users/${user.uid}`
    );
    const userData: Users = {
      uid: user.uid,
      email: user.email,
      nom: user.nom,
      prenom: user.prenom,
      birthdate: '1990-05-12',
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
      // Avatar par défaut : si le fichier manque dans Storage, on inscrit quand même l'utilisateur
      let avatarUrl = '';
      try {
        avatarUrl = await firstValueFrom(this.storage.ref('images/AVATAR.svg').getDownloadURL());
      } catch (e) {
        console.warn('images/AVATAR.svg introuvable dans Firebase Storage : inscription sans avatar', e);
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
    console.log(data.uid);
    
    return data.uid
}
getAdminId() {
  return JSON.parse(localStorage.getItem('admin_id') || '{}');
}
  clearStorage() {
      localStorage.clear();
  }
}
