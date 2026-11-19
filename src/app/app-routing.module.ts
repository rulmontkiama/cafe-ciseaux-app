import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CafeCiseauComponentList } from './cafe-ciseaux-list/cafe-ciseaux-list.component';
import { BarComponent } from './bar/bar.component';
import { LoginComponent } from './auth/components/login/login.component';
import { AdminComponent } from './admin/admin.component';
import { RegisterComponent } from './auth/components/register/register.component';
import { ProfileComponent } from './main/profile/profile.component';
import { AuthGuard} from './services/auth-guard.service';
import { RendezVousComponent } from './auth/components/rendez-vous/rendez-vous.component';
import { FileUploadComponent } from './file-upload/file-upload.component';
import { VerifyEmailComponent } from './src/app/verify-email.component';
import { PolicyComponent } from './policy/policy.component';
import { AdminRendezVousComponent } from './admin-rendez-vous/admin-rendez-vous.component';
import { AdminScheduleComponent } from './admin-schedule/admin-schedule.component';
import { AdminMessageComponent } from './admin-message/admin-message.component';
import { AdminParamsComponent } from './admin-params/admin-params.component';
import { AdminBeersComponent } from './admin-beers/admin-beers.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AppointmentManagerComponent } from './appointment-manager/appointment-manager.component';
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
  {path: 'admin',canActivate: [AuthGuard], component: AdminComponent,children:[
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'admin-rendez-vous'
      },{
        path: 'admin-rendez-vous',
        component: AdminRendezVousComponent
      },{
        path: 'admin-schedule',
        component: AdminScheduleComponent
      },{
        path: 'admin-message',
        component: AdminMessageComponent
      },{
        path: 'admin-params',
        component: AdminParamsComponent
      },{
        path: 'admin-beers',
        component: AdminBeersComponent
      },{
        path: 'admin-users',
        component: AdminUsersComponent
      }
      ,{
        path: 'admin-users',
        component: AdminUsersComponent
      }
      ,{
        path: 'appointment-manager',
        component: AppointmentManagerComponent
      }
    ]
  },


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
