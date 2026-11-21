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
import { FileUploadComponent } from './file-upload/file-upload.component';
import { FormsModule} from '@angular/forms';
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
import { UserMessageComponent } from './user-message/user-message.component';
import { BeerSelectionComponent } from './beer-selection/beer-selection.component';
import { LoginDemoComponent } from './auth/components/login-demo/login-demo.component';
import { NgxFileDropModule } from 'ngx-file-drop';
import { SharedModule } from './shared/shared.module';


@NgModule({
  declarations: [
    AppComponent,
    CafeCiseauxComponent,
    CafeCiseauComponentList,
    HeaderComponent,
    NavigationComponent,
    ProfileComponent,
    
    FileUploadComponent,
    AlertComponent,
    VerifyEmailComponent,
    ScheduleComponent,
    PolicyComponent,
    FooterComponent,
    BarComponent,
    
    
    
    
    
    UserMessageComponent,
    BeerSelectionComponent,
    LoginDemoComponent,
    
  
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
    NgxFileDropModule,
    SharedModule
  ],
  providers: [
    AngularFirestore,
    RendezVousService,
    HammerConfigProvider
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
