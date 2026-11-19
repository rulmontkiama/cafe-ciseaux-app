import { Component, OnInit } from '@angular/core';
import { AlertService } from 'src/app/services/alert.service';
import {FormBuilder, Validators,FormGroup } from '@angular/forms';
import { CustomvalidationService } from 'src/app/services/custom-validation.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss']
})
export class ResetPasswordComponent implements OnInit {
  isLogin: boolean = false;
  errorMessage: any;
  submitted:any;
  constructor(
    public formBuilder: FormBuilder,
    private customValidator: CustomvalidationService,
    private _toast:AlertService,
    private authService: AuthenticationService, 
  ) { }
  resetPasswordForm:any = FormGroup
  ngOnInit() {
    this.resetPasswordForm = this.formBuilder.group({    
      email: ['',Validators.compose([Validators.required, this.customValidator.emailValidator()])],
    },
    {
      validator: this.customValidator.MatchPassword('password', 'confirmPassword'),
    });
  }  
  get email() {
    return this.resetPasswordForm.get('email');
  }
  onSubmit() {
    this.submitted = true;
    var that = this;
    setTimeout(function(){
      that.submitted = false;
    },7000);
    const formValues = this.resetPasswordForm.value;   
   if (!this.resetPasswordForm.valid) {
      this._toast.showWarning('INVALIDE','l\'email est invalide')
      return false;
    } else { 
      this._toast.showSucces('INSCRIPTION','l\'email à été envoyé')
      this.authService.ForgotPassword(formValues.email);
      delete this.resetPasswordForm.value.email;      
    }
  }
}