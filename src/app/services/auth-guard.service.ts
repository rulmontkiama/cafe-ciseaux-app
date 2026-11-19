import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { AuthenticationService } from './authentication.service';
import { firstValueFrom } from 'rxjs';
import { AlertService } from './alert.service';

// Pages réservées aux utilisateurs connectés (hors /admin, géré séparément)
const PRIVATE_PATHS = ['/profile', '/rendez-vous', '/user-message'];

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(
    public authService: AuthenticationService,
    public router: Router,
    private _toast: AlertService,
  ) { }

  /**
   * La source de vérité est la session Firebase (et non plus seulement le localStorage).
   * Si la copie locale (profil, token) manque alors que Firebase est connecté
   * (inscription, rechargement, stockage vidé...), elle est reconstruite ici.
   */
  async canActivate(
    next: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Promise<boolean | UrlTree> {
    // Chemin sans paramètres ni ancre : '/rendez-vous?x=1' doit rester protégé
    const path = state.url.split(/[?#]/)[0];
    const isAdminPath = path === '/admin' || path.startsWith('/admin/');
    const isPrivatePath = PRIVATE_PATHS.includes(path);
    const isLoginPath = path === '/login';

    if (!isAdminPath && !isPrivatePath && !isLoginPath) {
      return true;
    }

    // Attend que Firebase ait fini de restaurer la session (1re émission)
    const user: any = await firstValueFrom(this.authService.authState$);

    if (isLoginPath) {
      if (user && await this.hasSession(user)) {
        this._toast.showWarning('ALREADY CONNECT', 'vous êtes déjà connecté');
        return this.router.parseUrl('/profile');
      }
      return true;
    }

    if (!user) {
      this._toast.showWarning('PAGE PRIVÉE', 'vous n\'êtes pas connecté');
      return this.router.parseUrl('/login');
    }

    if (!(await this.hasSession(user))) {
      this._toast.showWarning('PROFIL INTROUVABLE', 'impossible de charger votre profil, reconnectez-vous');
      return this.router.parseUrl('/login');
    }

    if (isAdminPath) {
      const adminIds = this.authService.getAdminId();
      if (!(Array.isArray(adminIds) && adminIds.includes(user.uid))) {
        this._toast.showWarning('PAGE PRIVÉE', 'Accès à la page non autorisé');
        return this.router.parseUrl('/profile');
      }
    }
    return true;
  }

  /** true si le profil local est présent, sinon tente de le reconstruire depuis Firestore. */
  private async hasSession(user: any): Promise<boolean> {
    const infos = this.authService.getUserInfos();
    if (this.authService.getToken() && infos && infos.uid === user.uid) {
      return true;
    }
    return this.authService.hydrateSession(user);
  }
}
