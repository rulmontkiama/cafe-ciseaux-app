import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, combineLatest, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';
import { Message } from '../models/message.model';
import { Chat } from '../models/chat.model';
import { UsersService } from './users.service';
import { AuthenticationService } from './authentication.service';
@Injectable({
  providedIn: 'root'
})
export class MessageService {
  constructor(
    private db: AngularFirestore,
    private usersService: UsersService,
    private authService: AuthenticationService,
  ) { }
  onSendMessage(fromId:any,toId:any,msg:any,date:any) {
    return this.db.collection('messages').add({
      from_id:fromId,
      to_id:toId,
      msg:msg,
      date: date,
      is_read:false
    });
  }
  getUnreadMessageCount(userId: string): Observable<number> {
    return this.db.collection('messages', ref => ref
      .where('to_id', '==', userId)
      .where('is_read', '==', false)
    )
    .valueChanges()
    .pipe(
      map(messages => messages.length)
    );
  }
  private toMs(d: any): number {
    if (!d) return 0;
    if (typeof d.toMillis === 'function') return d.toMillis();
    if (typeof d.seconds === 'number') return d.seconds * 1000;
    if (d instanceof Date) return d.getTime();
    return Number(d) || 0;
  }

  getChatMsg(userDetails: any): Observable<Chat[]> {
    const userId = userDetails.uid;

    // Requêtes par égalité simple (aucun index composite requis) + comparaison fiable en ms
    const sentMessages$ = this.db.collection("messages", ref =>
      ref.where("from_id", "==", userId)
    ).snapshotChanges();

    const receivedMessages$ = this.db.collection("messages", ref =>
      ref.where("to_id", "==", userId)
    ).snapshotChanges();

    return combineLatest([sentMessages$, receivedMessages$]).pipe(
      switchMap(([sentMessages, receivedMessages]) => {
        const lastMessages: Record<string, any> = {};
        sentMessages.forEach(message => {
          const msgData: any = message.payload.doc.data();
          const otherUserId: string = msgData.to_id;
          if (!lastMessages[otherUserId] || this.toMs(lastMessages[otherUserId].date) < this.toMs(msgData.date)) {
            lastMessages[otherUserId] = {
              msg: msgData.msg,
              date: msgData.date,
              from_id: msgData.from_id,
              to_id: msgData.to_id,
              is_read: msgData.is_read,
            };
          }
        });
        receivedMessages.forEach(message => {
          const msgData: any = message.payload.doc.data();
          const otherUserId: string = msgData.from_id;
          if (!lastMessages[otherUserId] || this.toMs(lastMessages[otherUserId].date) < this.toMs(msgData.date)) {
            lastMessages[otherUserId] = {
              msg: msgData.msg,
              date: msgData.date,
              from_id: msgData.from_id,
              to_id: msgData.to_id,
              is_read: msgData.is_read,
              hours: ''
            };
          }
        });
        const otherUserIds = Object.keys(lastMessages);
        const users$ = otherUserIds.length > 0 ?
          forkJoin(otherUserIds.map(id => this.usersService.getSender(id))) :
          of([]);
        return users$.pipe(
          map(users => {
            return Object.values(lastMessages).map((msgData: any) => {
              const isMe = msgData.from_id === userId;
              const otherUserId: any = isMe ? msgData.to_id : msgData.from_id;
              const otherUser: any = users.find((user: any) => user && user[0] && user[0].uid === otherUserId);
              if (!otherUser) { return null; }
              return {
                msg: msgData.msg,
                date: msgData.date,
                prenom: otherUser[0].prenom,
                nom: otherUser[0].nom,
                avatar: otherUser[0].avatar,
                uid: otherUser[0].uid,
                is_read: msgData.is_read,
                from_id: msgData.from_id,
                hours: ''
              };
            }).filter((chat: any) => chat !== null) as Chat[];
          })
        );
      })
    );
  }

  async getConversation(otherUserId: any, userDetails: any): Promise<Observable<Chat[]>> {
    const userId = this.authService.getUserInfos().uid;
    // Requêtes par égalités uniquement (fusion d'index automatiques Firestore, aucun index composite requis)
    const conversationRef = this.db.collection("messages", ref =>
      ref.where("from_id", "==", userId)
        .where("to_id", "==", otherUserId)
    ).snapshotChanges();

    const receivedMessagesRef = this.db.collection("messages", ref =>
      ref.where("from_id", "==", otherUserId)
        .where("to_id", "==", userId)
    ).snapshotChanges();

    const otherUser: any = await this.usersService.getSender(otherUserId);

    const conversationRef$ = combineLatest([conversationRef, receivedMessagesRef]).pipe(
      map(([sentMessages, receivedMessages]) => {
        const merged = [...sentMessages, ...receivedMessages]
          .sort((a: any, b: any) => this.toMs(a.payload.doc.data()?.date) - this.toMs(b.payload.doc.data()?.date))
          .slice(-100);
        return merged.map((message: any) => {
          const msgData = message.payload.doc.data();
          return {
            msg: msgData.msg,
            date: msgData.date,
            prenom: msgData.from_id === userId ? userDetails.prenom : otherUser?.[0]?.prenom,
            nom: msgData.from_id === userId ? userDetails.nom : otherUser?.[0]?.nom,
            avatar: msgData.from_id === userId ? userDetails.avatar : otherUser?.[0]?.avatar,
            uid: msgData.from_id === userId ? userId : otherUserId,
            is_read: msgData.is_read,
            hours: '',
            from_id: msgData.from_id
          };
        });
      })
    );

    return conversationRef$;
  }

  // Marque les messages reçus comme lus
  async updateIsRead(otherUserId: any, userDetails: any): Promise<void> {
    if (!otherUserId || !userDetails?.uid) return;
    const senderId = otherUserId;
    const recipientId = userDetails.uid;
    const messages: any = await firstValueFrom(
      this.db.collection("messages", ref =>
        ref.where("from_id", "==", senderId)
          .where("to_id", "==", recipientId)
          .where("is_read", "==", false)
      ).get()
    );

    if (!messages || messages.empty) return;

    const batch = this.db.firestore.batch();
    messages.forEach((messageDoc: any) => {
      batch.update(messageDoc.ref, { is_read: true });
    });
    await batch.commit();
  }




}
