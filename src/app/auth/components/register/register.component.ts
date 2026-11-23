import { Component, OnInit } from '@angular/core';
import { AlertService } from 'src/app/services/alert.service';
import { FormBuilder, Validators, FormGroup } from '@angular/forms';
import { CustomvalidationService } from 'src/app/services/custom-validation.service';
import { AuthenticationService } from 'src/app/services/authentication.service';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss']
})
export class RegisterComponent implements OnInit {
  isLogin: boolean = false;
  errorMessage: any;
  submitted: boolean = false; // Typé en boolean
  socialLoading = false;
  
  // Correction du typage de la variable
  registerForm!: FormGroup;

  constructor(
    public formBuilder: FormBuilder,
    private customValidator: CustomvalidationService,
    private _toast: AlertService,
    private authService: AuthenticationService, 
  ) { }

  ngOnInit() {
    this.registerForm = this.formBuilder.group({    
      nom: ['', Validators.required],
      prenom: ['', Validators.required],
      email: ['', Validators.compose([Validators.required, this.customValidator.emailValidator()])],
      phone: [''],
      birthdate: [''],
      password: ['', Validators.compose([Validators.required, this.customValidator.patternValidator()])],
      confirmPassword: ['', Validators.required],
    }, {
      validator: this.customValidator.MatchPassword('password', 'confirmPassword'),
    });
  }  

  get nom() { return this.registerForm.get('nom'); }
  get prenom() { return this.registerForm.get('prenom'); }
  get email() { return this.registerForm.get('email'); }
  get password() { return this.registerForm.get('password'); }
  get confirmPassword() { return this.registerForm.get('confirmPassword'); }

  // Connexion / inscription avec Google
  async googleLogin() {
    if (this.socialLoading) return;
    this.socialLoading = true;
    try {
      const ok = await this.authService.loginWithGoogle();
      if (ok) {
        this._toast.showSucces('LOGIN', 'vous êtes connecté');
      }
    } catch (error) {
      const message = this.authService.socialLoginErrorMessage(error);
      if (message) {
        this._toast.showError('CONNEXION', message);
      }
    } finally {
      this.socialLoading = false;
    }
  }

  // Connexion / inscription avec Apple
  async appleLogin() {
    if (this.socialLoading) return;
    this.socialLoading = true;
    try {
      const ok = await this.authService.loginWithApple();
      if (ok) {
        this._toast.showSucces('LOGIN', 'vous êtes connecté');
      }
    } catch (error) {
      const message = this.authService.socialLoginErrorMessage(error);
      if (message) {
        this._toast.showError('CONNEXION', message);
      }
    } finally {
      this.socialLoading = false;
    }
  }

  async onSubmit() {
    this.submitted = true;
    
    // Utilisation d'une fonction fléchée pour garder le bon "this" proprement
    setTimeout(() => {
      this.submitted = false; 
    }, 7000);

    // Mettre en minuscules nom et prénom
    const formValues = this.registerForm.value;
    this.registerForm.patchValue({
      nom: formValues.nom?.toLowerCase() || '',
      prenom: formValues.prenom?.toLowerCase() || ''
    });

    if (this.registerForm.invalid) {
      this._toast.showWarning('INVALIDE', 'Le formulaire est invalide');
      return;
    } 

    try {
      await this.authService.signUp(this.registerForm.value);
      this._toast.showSucces('INSCRIPTION', 'Votre compte a été enregistré, un e-mail de confirmation a été envoyé');
    } catch (error: any) {
      let msg = "Le compte n'a pas pu être créé, réessayez";
      if (error?.code === 'auth/email-already-in-use') {
        msg = 'Un compte existe déjà avec cette adresse e-mail';
      } else if (error?.code === 'auth/invalid-email') {
        msg = "L'adresse e-mail n'est pas valide";
      } else if (error?.code === 'auth/weak-password') {
        msg = 'Le mot de passe est trop faible';
      } else if (error?.code === 'auth/network-request-failed') {
        msg = 'Vérifiez votre connexion internet';
      }
      console.error(error);
      this._toast.showError('INSCRIPTION', msg);
    }
  }
}