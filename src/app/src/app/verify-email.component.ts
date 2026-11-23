import { Component } from '@angular/core';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { AlertService } from 'src/app/services/alert.service';

@Component({
  selector: 'app-verify-email',
  templateUrl: './verify-email.component.html',
  styleUrls: ['./verify-email.component.scss']
})
export class VerifyEmailComponent {
  resending = false;

  constructor(
    public authService: AuthenticationService,
    private _toast: AlertService
  ) {}

  async resendEmail(): Promise<void> {
    if (this.resending) return;
    this.resending = true;
    try {
      await this.authService.SendVerificationMail();
      this._toast.showSucces('E-MAIL ENVOYÉ', 'Un nouvel e-mail de confirmation vient de vous être envoyé');
    } catch (error: any) {
      if (error?.code === 'auth/too-many-requests') {
        this._toast.showWarning('PATIENCE', 'Un e-mail a déjà été envoyé, attendez quelques instants');
      } else {
        this._toast.showError('ERREUR', "Impossible de renvoyer l'e-mail de confirmation");
      }
    } finally {
      this.resending = false;
    }
  }
}
