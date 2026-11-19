import { Component, Injectable, OnInit, Output } from '@angular/core';
import { AlertService } from 'src/app/services/alert.service';
import {AngularFirestoreCollection } from '@angular/fire/compat/firestore'
import { AuthenticationService } from 'src/app/services/authentication.service';
import { RendezVousService } from 'src/app/services/rendez-vous.service';
import { DateService } from 'src/app/services/date.service';
import { RendezVous } from 'src/app/models/rendez-vous';
import { environment } from '../../../environments/environment';
@Injectable({
  providedIn: 'root',
})
@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent implements OnInit {
  rdvm! : RendezVous ;
  public RDVData:any;
  public nom!:string;
  public prenom!:string;
  private uid!:string
  public username!:string;
  public scissor!:number;
  public avatar!:string;
  public avatarBool= false
  public uploadBool!: boolean
  public scissorBool = false
  public imageUrl = environment.imagePath;

  chats: any;
  userCollection!: AngularFirestoreCollection<any> ;
  collection: any;
  constructor(
    private _toast:AlertService,
    private authService: AuthenticationService,
    private rendez_vous:RendezVousService,   
    private dateService:DateService 
  ) {    
 }
  async ngOnInit() {  
    window.scrollTo(0, 0);
    var userDetails:any = this.authService.getUserInfos()
    this.nom = userDetails.nom
    this.prenom = userDetails.prenom
    this.username = userDetails.username
    this.scissor = Number( userDetails.scissor)
    this.avatar = userDetails.avatar
    this.uid = userDetails.uid
    if(!this.avatar){
      this.avatar = 'AVATAR.svg'
    }
   await this.rendez_vous.getUserRDV(this.uid).subscribe(users=> {
      this.RDVData = users;
      for (const k in this.RDVData) { 
        const formattedDate = this.dateService.formatDate(this.RDVData[k].date.seconds * 1000);
        this.RDVData[k].date = formattedDate.dateString;
        this.RDVData[k].hours  = formattedDate.hours;
        this.RDVData[k].passed  = formattedDate.passed;
      }
   });
  }  
  uploadChangedHandler(upload: any) {
    this.avatarBool= false; 
    this.uploadBool = upload;    
  }
  avatarChangedHandler(avatar: any) {
    console.log(avatar)
    this.avatar =  avatar 
  }
  changeAvatar() {
    this.avatarBool= !this.avatarBool; 
  }
  logout(){
    this.authService.SignOut()
    this._toast.showSucces('vous êtes déconnecté','logout')
  }
  deleteAccount(): void {
    console.log('Fonction supprimerCompte() appelée.');
    this.authService.deleteAccount(this.uid )
    // Ajoutez ici la logique réelle pour supprimer le compte
  }
  changePassword(): void {
    console.log('Fonction supprimerCompte() appelée.');
    // Ajoutez ici la logique réelle pour supprimer le compte
  }
}
