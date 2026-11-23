import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, map } from 'rxjs';
import { AuthenticationService } from '../services/authentication.service';
import { MessageService } from '../services/message.service';
import { UsersService } from '../services/users.service';
import { AlertService } from 'src/app/services/alert.service';
import { Chat } from '../models/chat.model';
import { DateService } from '../services/date.service';

@Component({
  selector: 'app-admin-message',
  templateUrl: './admin-message.component.html',
  styleUrls: ['./admin-message.component.scss']
})
export class AdminMessageComponent implements OnInit, OnDestroy {
  @ViewChild('submitButton') submitButton: any;
  selectedUser: Chat | undefined;
  conversation: any[] = [];
  newMessage = '';
  userDetails: any;
  allChats: Chat[] = [];
  filteredChats: Chat[] = [];
  searchQuery = '';
  isLoading = true;

  private chatsSub?: Subscription;
  private convSub?: Subscription;
  private querySub?: Subscription;

  constructor(
    private authService: AuthenticationService,
    private _toast: AlertService,
    private msgService: MessageService,
    private usersService: UsersService,
    private dateService: DateService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.userDetails = this.authService.getUserInfos();
    if (!this.userDetails?.uid) {
      this.isLoading = false;
      return;
    }

    this.chatsSub = this.msgService.getChatMsg(this.userDetails).subscribe({
      next: (chats) => {
        this.allChats = (chats || []).sort((a: any, b: any) => {
          const sa = a?.date?.seconds ?? 0;
          const sb = b?.date?.seconds ?? 0;
          return sb - sa;
        });
        this.applyFilter();
        this.isLoading = false;
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
      }
    });

    // Ouvre directement une conversation si on arrive depuis Clients (?uid=...)
    this.querySub = this.route.queryParamMap.subscribe((params) => {
      const targetUid = params.get('uid');
      if (targetUid && targetUid !== this.userDetails?.uid) {
        this.openDirectConversation(targetUid);
      }
    });
  }

  ngOnDestroy(): void {
    this.chatsSub?.unsubscribe();
    this.convSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  private async openDirectConversation(targetUid: string): Promise<void> {
    if (this.selectedUser?.uid === targetUid) return;
    try {
      const result: any = await this.usersService.getSender(targetUid);
      const client = Array.isArray(result) ? result[0] : null;
      if (!client) return;
      const directChat: Chat = {
        uid: client.uid || targetUid,
        nom: client.nom || '',
        prenom: client.prenom || '',
        avatar: client.avatar || '',
        msg: '',
        date: null,
        is_read: true,
        hours: '',
        from_id: ''
      };
      await this.selectUser(directChat);
    } catch (err) {
      console.error('Impossible de charger le client cible :', err);
    }
  }

  onSearchUsers(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchQuery = input.value || '';
    this.applyFilter();
  }

  private applyFilter(): void {
    const term = this.searchQuery.trim().toLowerCase();
    if (!term) {
      this.filteredChats = [...this.allChats];
      return;
    }
    this.filteredChats = this.allChats.filter((chat) => {
      const fullName = `${chat.prenom || ''} ${chat.nom || ''}`.toLowerCase();
      return fullName.includes(term) || (chat.msg || '').toLowerCase().includes(term);
    });
  }

  async selectUser(user: Chat): Promise<void> {
    this.selectedUser = user;
    this.conversation = [];
    this.convSub?.unsubscribe();

    const conv$ = await this.msgService.getConversation(user.uid, this.userDetails);
    this.convSub = conv$
      .pipe(
        map((conversation) =>
          (conversation || []).map((message) => {
            const ms =
              typeof message.date?.toMillis === 'function'
                ? message.date.toMillis()
                : typeof message.date?.seconds === 'number'
                  ? message.date.seconds * 1000
                  : message.date instanceof Date
                    ? message.date.getTime()
                    : Date.now();
            const formatted = this.dateService.formatDate(ms);
            return {
              ...message,
              date: formatted.dateString,
              hours: formatted.hours
            };
          })
        )
      )
      .subscribe({
        next: (conversation) => {
          this.conversation = conversation;
          this.msgService.updateIsRead(user.uid, this.userDetails).catch(() => {});
          setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          }, 50);
        },
        error: (error) => {
          console.error(error);
        }
      });
  }

  deselectUser(): void {
    this.convSub?.unsubscribe();
    this.selectedUser = undefined;
    this.conversation = [];
    this.applyFilter();
    if (this.route.snapshot.queryParamMap.has('uid')) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { uid: null },
        queryParamsHandling: 'merge',
        replaceUrl: true
      });
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }

  async onSendMessage(): Promise<void> {
    const text = this.newMessage.trim();
    if (!this.selectedUser || !text) return;
    if (text.length > 2000) {
      this._toast.showWarning('MESSAGE TROP LONG', 'Maximum 2000 caractères par message');
      return;
    }

    const messageTimestamp = new Date();
    this.newMessage = '';
    try {
      await this.msgService.onSendMessage(this.userDetails.uid, this.selectedUser.uid, text, messageTimestamp);
      this._toast.showSucces('CONFIRMATION', 'Le message a été envoyé');
    } catch (error) {
      console.error(error);
      this.newMessage = text;
      this._toast.showError('ERREUR', "Le message n'a pas pu être envoyé");
    }
  }

  triggerSubmit(): void {
    this.submitButton?.nativeElement?.click();
  }
}
