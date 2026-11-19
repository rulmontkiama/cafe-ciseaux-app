import { Component, OnInit  } from '@angular/core';
import { AlertService } from 'src/app/services/alert.service';
import {FormBuilder, Validators,FormGroup } from '@angular/forms';
import { CustomvalidationService } from 'src/app/services/custom-validation.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  errorMessage: any
  submitted:any;
  constructor(
    private _toast:AlertService,
    public formBuilder: FormBuilder,
    private customValidator: CustomvalidationService,
    private authService: AuthenticationService,
  ) { }
  loginForm:any = FormGroup
  ngOnInit() {
    // verify is user is login
    this.loginForm = this.formBuilder.group({    
      email: ['', Validators.compose([Validators.required, this.customValidator.emailValidator()])],
      // On retire le patternValidator ici, seul le required est nécessaire pour se connecter
      password: ['', Validators.required],
    });
  }  
  get email() {
    return this.loginForm.get('email');
  }
  get password() {
    return this.loginForm.get('password');
  }
  onSubmit() {
    this.submitted = true;
    var that = this;
    setTimeout(function(){
      that.submitted = false;
    },7000);
    if (!this.loginForm.valid) {
      this._toast.showWarning('INVALIDE','le formulaire est invalide')
      return false;
    }
    const {  email, password } = this.loginForm.value;
    this.authService.login(email, password).then((result) => {
      if (result === false) {
        this._toast.showWarning('INCORRECT','email ou mot de passe incorrect')
      } else {
        this._toast.showSucces('LOGIN','vous êtes connecté')
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