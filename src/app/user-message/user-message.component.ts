import { Component, OnDestroy, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, map } from 'rxjs';
import {
  DEFAULT_MESSAGE_TTL_DAYS,
  MESSAGE_TTL_OPTIONS,
  MessageService
} from '../services/message.service';
import { AuthenticationService } from '../services/authentication.service';
import { Message } from '../models/message.model';
import { AlertService } from '../services/alert.service';
import { DateService } from '../services/date.service';
import { UsersService } from '../services/users.service';

@Component({
  selector: 'app-user-message',
  templateUrl: './user-message.component.html',
  styleUrls: ['./user-message.component.scss']
})
export class UserMessageComponent implements OnDestroy {
  @ViewChild('submitButton') submitButton: any;
  messageListing!: Message[];
  newMessage = '';
  selectedMessage: Message | undefined;
  conversation: any[] = [];
  userDetails: any;
  currentMsg: any;
  isRead: any;
  adminUser: any;
  isLoading = true;
  noRecipient = false;

  readonly ttlOptions = MESSAGE_TTL_OPTIONS;
  selectedTtlDays = DEFAULT_MESSAGE_TTL_DAYS;

  private convSub?: Subscription;

  constructor(
    private authService: AuthenticationService,
    private msgService: MessageService,
    private _toast: AlertService,
    private dateService: DateService,
    private userService: UsersService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.userDetails = await this.authService.getUserInfos();
    const adminIds = this.authService.getAdminId();
    if (this.userDetails?.uid && Array.isArray(adminIds) && adminIds.includes(this.userDetails.uid)) {
      this.router.navigate(['/admin/admin-message'], { replaceUrl: true });
      return;
    }
    const adminId = this.authService.getFirstAdminId();
    if (!adminId || adminId === this.userDetails?.uid) {
      if (adminId && adminId === this.userDetails?.uid) {
        this.router.navigate(['/admin/admin-message'], { replaceUrl: true });
        return;
      }
      this.isLoading = false;
      this.noRecipient = true;
      this._toast.showWarning('MESSAGERIE', 'Aucun destinataire disponible pour le moment');
      return;
    }

    this.adminUser = await this.userService.getSender(adminId);
    if (Array.isArray(this.adminUser)) {
      this.adminUser = this.adminUser[0];
    }

    this.convSub = (await this.msgService.getConversation(adminId, this.userDetails))
      .pipe(
        map((conversation) =>
          (conversation || []).map((message) => {
            const ms = message.dateMs || this.msgService.toMs(message.date) || Date.now();
            const formattedDate = this.dateService.formatDate(ms);
            return {
              ...message,
              date: formattedDate.dateString,
              hours: formattedDate.hours
            };
          })
        )
      )
      .subscribe({
        next: (conversation) => {
          this.conversation = conversation || [];
          this.isLoading = false;
          this.msgService.updateIsRead(adminId, this.userDetails).catch(() => {});
          setTimeout(() => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
          }, 60);
        },
        error: (error) => {
          console.error(error);
          this.isLoading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.convSub?.unsubscribe();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.onSendMessage();
    }
  }

  async onSendMessage(): Promise<boolean> {
    const adminId = this.authService.getFirstAdminId();
    if (!this.newMessage || !adminId) {
      return false;
    }
    const textToSend = this.newMessage.trim();
    if (!textToSend) {
      return false;
    }
    if (textToSend.length > 2000) {
      this._toast.showWarning('MESSAGE TROP LONG', 'Maximum 2000 caractères par message');
      return false;
    }
    const messageTimestamp = new Date();
    let demoId: any = null;
    try {
      const demoData = await this.userService.getDemo();
      demoId = demoData?.[0]?.demo_id ?? null;
    } catch {
      demoId = null;
    }
    this.newMessage = '';
    if (demoId && demoId == this.userDetails.uid) {
      this._toast.showSucces('CONFIRMATION', 'Le message a été envoyé (démo)');
      return false;
    }
    try {
      await this.msgService.onSendMessage(
        this.userDetails.uid,
        adminId,
        textToSend,
        messageTimestamp,
        this.selectedTtlDays
      );
    } catch (error) {
      console.error(error);
      this.newMessage = textToSend;
      this._toast.showError('ERREUR', "Le message n'a pas pu être envoyé");
    }
    return true;
  }

  triggerSubmit(): void {
    this.submitButton.nativeElement.click();
  }
}
