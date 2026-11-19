import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LoginComponent } from '../components/login/login.component';
import { RegisterComponent } from '../components/register/register.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { RouterModule } from '@angular/router';
import { RendezVousComponent } from '../components/rendez-vous/rendez-vous.component';
import { HamburgerToggleDirective } from 'src/app/hamburger-toggle.directive';
import { BrowserModule } from '@angular/platform-browser';
import { ResetPasswordComponent } from '../components/reset-password/reset-password.component';
@NgModule({
  declarations: [
    LoginComponent, 
    RegisterComponent ,
    RendezVousComponent,
    HamburgerToggleDirective,
    ResetPasswordComponent
  ],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    BrowserModule,
    FormsModule,
    HttpClientModule,
    RouterModule,
  ],
  exports : [
    LoginComponent, 
    RegisterComponent ,
    RendezVousComponent,
    ResetPasswordComponent
  ]
})
export class AuthModule { }
