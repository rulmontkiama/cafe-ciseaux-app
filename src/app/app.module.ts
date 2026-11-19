import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HammerConfigProvider } from './config/my-hammer-config';
import { HttpClientModule } from '@angular/common/http';
import { CafeCiseauxComponent } from './cafe-ciseaux/cafe-ciseaux.component';
import { CafeCiseauComponentList } from './cafe-ciseaux-list/cafe-ciseaux-list.component';
import { HeaderComponent } from './header/header.component';
import { NavigationComponent } from './navigation/navigation.component';
import { AuthModule } from './auth/auth/auth.module';
import { ProfileComponent } from './main/profile/profile.component';
import { ResetPasswordComponent } from './auth/components/reset-password/reset-password.component';
import { AdminComponent } from './admin/admin.component';
import { FileUploadComponent } from './file-upload/file-upload.component';
import { FormsModule} from '@angular/forms';
import { ClickDirectiveDirective } from './directive/click-directive.directive';
import {ToastrModule} from 'ngx-toastr';
import { AlertComponent } from './alert/alert.component';
//rendez-vous service
import { RendezVousService } from './services/rendez-vous.service';
//angularfire imports
import { AngularFireModule } from "@angular/fire/compat";
import { AngularFirestoreModule } from '@angular/fire/compat/firestore'
import { AngularFireStorageModule } from '@angular/fire/compat/storage';
import { AngularFireAuthModule } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
//environment import
import { environment } from "../environments/environment";
import { VerifyEmailComponent } from './src/app/verify-email.component';
import { ScheduleComponent } from './schedule/schedule.component';
import { PolicyComponent } from './policy/policy.component';
import { FooterComponent } from './footer/footer.component';
import { BarComponent } from './bar/bar.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { AdminRendezVousComponent } from './admin-rendez-vous/admin-rendez-vous.component';
import { AdminScheduleComponent } from './admin-schedule/admin-schedule.component';
import { AppointmentManagerComponent } from './appointment-manager/appointment-manager.component';
import { AdminMessageComponent } from './admin-message/admin-message.component';
import { AdminBeersComponent } from './admin-beers/admin-beers.component';
import { UserMessageComponent } from './user-message/user-message.component';
import { BeerSelectionComponent } from './beer-selection/beer-selection.component';
import { LoginDemoComponent } from './auth/components/login-demo/login-demo.component';
import { NgxFileDropModule } from 'ngx-file-drop';
import { CalendarViewComponent } from './calendar-view/calendar-view.component';


@NgModule({
  declarations: [
    AppComponent,
    CafeCiseauxComponent,
    CafeCiseauComponentList,
    HeaderComponent,
    NavigationComponent,
    ProfileComponent,
    AdminComponent,
    FileUploadComponent,
    ClickDirectiveDirective,
    AlertComponent,
    VerifyEmailComponent,
    ScheduleComponent,
    PolicyComponent,
    FooterComponent,
    BarComponent,
    DashboardComponent,
    AdminRendezVousComponent,
    AdminScheduleComponent,
    AppointmentManagerComponent,
    AdminMessageComponent,
    AdminBeersComponent,  
    UserMessageComponent,
    BeerSelectionComponent,
    LoginDemoComponent,
    CalendarViewComponent
  
  ],
  imports: [
    CommonModule,
    BrowserModule,
    BrowserAnimationsModule,
    AppRoutingModule,
    HttpClientModule,
    RouterModule,
    AuthModule,
    FormsModule,
    ToastrModule.forRoot(),
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireAuthModule,
    AngularFirestoreModule,
    AngularFireStorageModule,
    NgxFileDropModule
  ],
  providers: [
    AngularFirestore,
    RendezVousService,
    HammerConfigProvider
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
