import { Component, OnInit } from '@angular/core';
import { AlertService } from 'src/app/services/alert.service';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { CustomvalidationService } from 'src/app/services/custom-validation.service';
import { AuthenticationService } from 'src/app/services/authentication.service';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  submitted = false;
  sending = false;
  resetPasswordForm!: FormGroup;

  constructor(
    public formBuilder: FormBuilder,
    private customValidator: CustomvalidationService,
    private _toast: AlertService,
    private authService: AuthenticationService
  ) {}

  ngOnInit(): void {
    this.resetPasswordForm = this.formBuilder.group({
      email: ['', Validators.compose([Validators.required, this.customValidator.emailValidator()])]
    });
  }

  get email() {
    return this.resetPasswordForm.get('email');
  }

  async onSubmit(): Promise<void> {
    this.submitted = true;
    if (!this.resetPasswordForm.valid || this.sending) {
      if (!this.resetPasswordForm.valid) {
        this._toast.showWarning('INVALIDE', "L'adresse e-mail n'est pas valide");
      }
      return;
    }

    this.sending = true;
    try {
      await this.authService.ForgotPassword(this.resetPasswordForm.value.email);
      this._toast.showSucces(
        'MOT DE PASSE',
        'Un e-mail de réinitialisation a été envoyé (pensez à vérifier vos spams)'
      );
      this.resetPasswordForm.reset();
      this.submitted = false;
    } catch (error: any) {
      let msg = "Impossible d'envoyer l'e-mail, réessayez";
      if (error?.code === 'auth/user-not-found') {
        msg = 'Aucun compte trouvé avec cette adresse e-mail';
      } else if (error?.code === 'auth/invalid-email') {
        msg = "L'adresse e-mail n'est pas valide";
      } else if (error?.code === 'auth/too-many-requests') {
        msg = 'Trop de tentatives, réessayez dans quelques minutes';
      }
      console.error(error);
      this._toast.showError('ERREUR', msg);
    } finally {
      this.sending = false;
    }
  }
}