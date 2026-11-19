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

    // Inscription Firebase : crée le compte, le profil Firestore et la session locale
    // (le mot de passe n'est plus jamais copié dans le localStorage).
    const created = await this.authService.signUp(this.registerForm.value);
    if (created) {
      this._toast.showSucces('INSCRIPTION', 'Votre compte a été enregistré, un E-mail de confirmation a été envoyé');
    } else {
      this._toast.showError('INSCRIPTION', "Le compte n'a pas pu être créé");
    }
  }
}