import { Component, SecurityContext, ViewChild } from '@angular/core';
import { MessageService } from '../services/message.service';
import { AuthenticationService } from '../services/authentication.service';
import { Message } from '../models/message.model';
import { Timestamp } from 'firebase/firestore';
import { DomSanitizer } from '@angular/platform-browser';
import { AlertService } from '../services/alert.service';
import { map } from 'rxjs';
import { DateService } from '../services/date.service';
import { AdminService } from '../services/admin.service';
import { UsersService } from '../services/users.service';
@Component({
  selector: 'app-user-message',
  templateUrl: './user-message.component.html',
  styleUrls: ['./user-message.component.scss']
})
export class UserMessageComponent {
  @ViewChild('submitButton') submitButton: any;
  messageListing!:  Message[]  ;
  newMessage: string = '';
  selectedMessage: Message | undefined;
  conversation:any
  userDetails:any
  currentMsg:any
  isRead:any
  adminUser: any

  constructor(
    private authService: AuthenticationService,
    private msgService:MessageService,
    private sanitizer: DomSanitizer,
    private _toast:AlertService,
    private dateService:DateService,
    private adminService:AdminService,
    private userService: UsersService,
  ){

  }
  async ngOnInit(){
    this.userDetails= await this.authService.getUserInfos()
    // getAdminId() renvoie la LISTE des admins : on prend la première id (avant : admin.admin_id valait undefined)
    const adminId = this.authService.getFirstAdminId();
    if (!adminId) {
      this._toast.showWarning('MESSAGERIE', 'aucun destinataire disponible pour le moment');
      return;
    }
    console.log(this.userDetails)
    this.adminUser =  await this.userService.getSender(adminId);
    if(Array.isArray(this.adminUser)){
      this.adminUser = this.adminUser[0];
    }
    
    (await this.msgService.getConversation(adminId, this.userDetails))
    .pipe(
      map(conversation => {
        console.log(this.adminUser)
        // Modifier la date pour chaque message de la conversation
        conversation.forEach(message => {
          const formattedDate = this.dateService.formatDate(message.date.seconds * 1000);
          message.date = formattedDate.dateString;
          message.hours = formattedDate.hours;
        });
        return conversation;
      })
    )
    .subscribe(
      conversation => {
        this.conversation = conversation;
        console.log(this.conversation);
        // Faire des actions avec les données récupérées
      },
      error => {
        console.error(error);
        // Gérer l'erreur
      }
    );

  // Observer les changements dans la collection de messages

    
  }
  async onSendMessage() {
    const adminId = this.authService.getFirstAdminId();
    if (!this.newMessage || !adminId) {
      return false;
    }
    // Le texte est affiché via {{ }} (échappé par Angular) : pas besoin de l'encoder en HTML ici.
    // Avant : newMessage était vidé AVANT l'envoi, donc des messages vides partaient en base.
    const textToSend = this.newMessage.trim();
    if (!textToSend.trim()) {
      return false;
    }
    const messageTimestamp = Timestamp.fromDate(new Date());
    // Compte de démo (optionnel) : la collection demo peut être vide ou absente
    let demoId: any = null;
    try {
      const demoData = await this.userService.getDemo();
      demoId = demoData?.[0]?.demo_id ?? null;
    } catch (e) {
      demoId = null;
    }
    this.newMessage = '';
    if (demoId && demoId == this.userDetails.uid) {
      this._toast.showSucces('CONFIRMATION','Le message à été envoyé(démo)')
      return false;
    }
    try {
      await this.msgService.onSendMessage(this.userDetails.uid, adminId, textToSend, messageTimestamp);
      this._toast.showSucces('CONFIRMATION','Le message à été envoyé')
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', "Le message n'a pas pu être envoyé");
    }
    return true;
  }
  triggerSubmit(): void {
    this.submitButton.nativeElement.click();
  }

}
