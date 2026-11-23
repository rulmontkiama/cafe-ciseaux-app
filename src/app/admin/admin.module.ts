import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { SharedModule } from '../shared/shared.module';
import { AdminComponent } from './admin.component';
import { DashboardComponent } from '../dashboard/dashboard.component';
import { AdminOverviewComponent } from '../admin-overview/admin-overview.component';
import { AdminRendezVousComponent } from '../admin-rendez-vous/admin-rendez-vous.component';
import { AdminScheduleComponent } from '../admin-schedule/admin-schedule.component';
import { AdminMessageComponent } from '../admin-message/admin-message.component';
import { AdminParamsComponent } from '../admin-params/admin-params.component';
import { AdminBeersComponent } from '../admin-beers/admin-beers.component';
import { AdminUsersComponent } from '../admin-users/admin-users.component';
import { AppointmentManagerComponent } from '../appointment-manager/appointment-manager.component';

// Chargé uniquement quand on ouvre /admin : le code d'administration ne pèse plus sur l'app des clients.
const routes: Routes = [
  {
    path: '',
    component: AdminComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'overview' },
      { path: 'overview', component: AdminOverviewComponent },
      { path: 'admin-rendez-vous', component: AdminRendezVousComponent },
      { path: 'admin-schedule', component: AdminScheduleComponent },
      { path: 'admin-message', component: AdminMessageComponent },
      { path: 'admin-params', component: AdminParamsComponent },
      { path: 'admin-beers', component: AdminBeersComponent },
      { path: 'admin-users', component: AdminUsersComponent },
      { path: 'appointment-manager', component: AppointmentManagerComponent },
    ],
  },
];

@NgModule({
  declarations: [
    AdminComponent,
    DashboardComponent,
    AdminOverviewComponent,
    AdminRendezVousComponent,
    AdminScheduleComponent,
    AdminMessageComponent,
    AdminBeersComponent,
    AppointmentManagerComponent,
  ],
  imports: [CommonModule, FormsModule, SharedModule, AdminUsersComponent, RouterModule.forChild(routes)],
})
export class AdminModule {}
