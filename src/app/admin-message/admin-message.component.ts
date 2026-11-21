import { Component, SecurityContext, ViewChild } from '@angular/core';
import { Observable, map, of, take } from 'rxjs';
import { AuthenticationService } from '../services/authentication.service';
import { DomSanitizer } from '@angular/platform-browser';
import { Timestamp } from 'firebase/firestore';
import { MessageService } from '../services/message.service';
import { AlertService } from 'src/app/services/alert.service';
import { Chat } from '../models/chat.model';
import { DateService } from '../services/date.service';
@Component({
  selector: 'app-admin-message',
  templateUrl: './admin-message.component.html',
  styleUrls: ['./admin-message.component.scss']
})
export class AdminMessageComponent {
  @ViewChild('submitButton') submitButton: any;
  searchResults!: Observable<Chat[]> | undefined;
  selectedUser: Chat | undefined;
  conversation:any
  newMessage: string = '';
  userDetails:any
  messages: Observable<any> | undefined;
  users!: Chat[];
  allMsg!: Observable<Chat[]>;
  constructor(
    private authService: AuthenticationService,
    private _toast:AlertService,
    private sanitizer: DomSanitizer,
    private msgService:MessageService,
    private dateService:DateService
    ) {}
    async ngOnInit() {
      this.userDetails = this.authService.getUserInfos();
      this.searchResults = this.msgService.getChatMsg(this.userDetails).pipe(
        map(chats => chats.filter(chat => chat.nom.toLowerCase()))
      );
    }    
    async onSearchUsers($event: any) {
      const searchValue = $event.target?.value || '';
      if (searchValue === '') {
        // Si l'input est vide, afficher la liste des derniers messages
        this.searchResults = this.msgService.getChatMsg(this.userDetails);
      } else {
        // Sinon, effectuer la recherche
        this.searchResults = this.msgService.getChatMsg(this.userDetails).pipe(
          map(chats => chats.filter(chat => chat.nom.toLowerCase().includes(searchValue.toLowerCase())))
        );
      }      
      this.searchResults.subscribe(results => {
        // Mettre à jour la liste des résultats dans la vue
        this.users = results;
      });
    }    
    async selectUser(user: Chat) {
      this.selectedUser = user;
      this.searchResults = of([]);
      (await this.msgService.getConversation(user.uid, this.userDetails))
        .pipe(
          map(conversation => {
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
            // Faire des actions avec les données récupérées
          },
          error => {
            console.error(error);
            // Gérer l'erreur
          }
        );
    
      // Observer les changements dans la collection de messages
      (await
        // Observer les changements dans la collection de messages
        this.msgService.getConversation(user.uid, this.userDetails))
        .subscribe(
          conversation => {
            // Afficher un message pour signaler le changement
            // Modifier la date pour chaque message de la conversation
            conversation.forEach(message => {
              const formattedDate = this.dateService.formatDate(message.date.seconds * 1000);
              message.date = formattedDate.dateString;
              message.hours = formattedDate.hours;
            });
            // Mettre à jour la conversation
            this.conversation = conversation;
            // Mettre à jour la lecture des message
            this.msgService.updateIsRead(user.uid, this.userDetails)
          },
          error => {
            console.error(error);
            // Gérer l'erreur
          }
        );
    }
    
  deselectUser() {
    this.selectedUser = undefined;
  }
  onSendMessage() {
    if (this.selectedUser && this.newMessage) {
      const messageDate = new Date();
      const messageTimestamp = Timestamp.fromDate(messageDate);
      const messageText = this.sanitizer.sanitize(SecurityContext.HTML, this.newMessage);
      // Envoyer le message au service
      this.msgService.onSendMessage(this.userDetails.uid,this.selectedUser.uid, messageText, messageTimestamp);
      // Vider le champ de saisie du message
      this.newMessage = '';
      this._toast.showSucces('CONFIRMATION','Le message à été envoyé')
    }
  }
  triggerSubmit(): void {
    this.submitButton.nativeElement.click();
  }
  
}
