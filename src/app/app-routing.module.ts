import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CafeCiseauComponentList } from './cafe-ciseaux-list/cafe-ciseaux-list.component';
import { BarComponent } from './bar/bar.component';
import { LoginComponent } from './auth/components/login/login.component';
import { RegisterComponent } from './auth/components/register/register.component';
import { ProfileComponent } from './main/profile/profile.component';
import { AuthGuard} from './services/auth-guard.service';
import { RendezVousComponent } from './auth/components/rendez-vous/rendez-vous.component';
import { FileUploadComponent } from './file-upload/file-upload.component';
import { VerifyEmailComponent } from './src/app/verify-email.component';
import { PolicyComponent } from './policy/policy.component';
import { UserMessageComponent } from './user-message/user-message.component';
import { BeerSelectionComponent } from './beer-selection/beer-selection.component';
import { ResetPasswordComponent } from './auth/components/reset-password/reset-password.component';
import { LoginDemoComponent } from './auth/components/login-demo/login-demo.component';
const routes: Routes = [
  {path : '',component:CafeCiseauComponentList},
  {path : 'cafeCiseaux',component:CafeCiseauComponentList},
  {path : 'bar',component:BarComponent},
  {path: 'register', component: RegisterComponent},
  {path: 'file-upload', component: FileUploadComponent},
  {path : 'verify-email-address',component:VerifyEmailComponent},
  {path : 'policy',component:PolicyComponent},
  {path : 'beer-selection',canActivate: [AuthGuard],component:BeerSelectionComponent},
  {path : 'reset-password',component:ResetPasswordComponent},
  {path: 'login-demo',canActivate: [AuthGuard], component: LoginDemoComponent},
  {path: 'login',canActivate: [AuthGuard], component: LoginComponent},
  {path: 'rendez-vous',canActivate: [AuthGuard], component: RendezVousComponent},
  {path: 'user-message',canActivate: [AuthGuard], component: UserMessageComponent},
  {path: 'profile',canActivate: [AuthGuard], component: ProfileComponent},
  {path: 'admin',canActivate: [AuthGuard], loadChildren: () => import('./admin/admin.module').then(m => m.AdminModule)},


];
@NgModule({
  imports: [
    RouterModule.forRoot(routes)
  ],
  exports: 
  [
    RouterModule //  module de routage fourni par Angular
  ]
})
export class AppRoutingModule { }
