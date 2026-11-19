import { Component } from '@angular/core';
import { AlertService } from 'src/app/services/alert.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { UsersService } from 'src/app/services/users.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-login-demo',
  templateUrl: './login-demo.component.html',
  styleUrls: ['./login-demo.component.scss']
})
export class LoginDemoComponent {
  constructor(
    private _toast:AlertService,
    private authService : AuthenticationService
  ){}
  async demoLogin(){
  const demoEmail = environment.demo.email
  const demoPass = environment.demo.password
  if (!demoEmail || !demoPass) {
    this._toast.showWarning('DEMO','le compte de démonstration n\'est pas configuré')
    return
  }
  this.authService.login(demoEmail, demoPass).then((result) => {
    if (result === false) {
      this._toast.showWarning('INCORRECT','email ou mot de passe incorrect')
    } else {
      this._toast.showSucces('LOGIN','vous êtes connecté à la demo')
    }
  }).catch((error) => {
      if (error?.message === 'PROFILE_NOT_FOUND') {
        this._toast.showError('PROFIL INTROUVABLE', "votre compte n'a pas de profil, contactez le salon");
      } else if (error?.code === 'auth/too-many-requests') {
        this._toast.showError('TROP DE TENTATIVES', 'réessayez dans quelques minutes');
      } else if (error?.code === 'auth/network-request-failed') {
        this._toast.showError('RÉSEAU', 'vérifiez votre connexion internet');
      } else {
        console.error(error);
        this._toast.showError('ERREUR', 'connexion impossible, réessayez');
      }
    });
}
}
