import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, combineLatest, forkJoin, map, of, switchMap } from 'rxjs';
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
  getUserMsg(userId:any):Observable<any>{  
    let newItem: any;
    return this.db.collection('messages', ref => ref
    .orderBy('date','desc')).snapshotChanges()
    .pipe(
      map(messages => {
        console.log(messages)
        return messages.map(a => {               
          const data =  a.payload.doc.data() as Message;      
          return data;          
        })
      })
    )
  }
  getChatMsg(userDetails: any): Observable<Chat[]> {
    const userId = userDetails.uid;
  
    const sentMessages$ = this.db.collection("messages", ref =>
      ref.where("from_id", "==", userId).orderBy("date", "desc")
    ).snapshotChanges();
  
    const receivedMessages$ = this.db.collection("messages", ref =>
      ref.where("to_id", "==", userId).orderBy("date", "desc")
    ).snapshotChanges();
    // On utilise la fonction combineLatest() de RxJS pour combiner les Observables de sentMessages et receivedMessages.
  // Une fois que les deux Observables sont terminés, on traite les messages reçus et envoyés en même temps.
  // En utilisant la fonction switchMap(), on peut retourner un nouvel Observable qui contiendra les données que nous souhaitons renvoyer.
  
    return combineLatest([sentMessages$, receivedMessages$]).pipe(
      switchMap(([sentMessages, receivedMessages]) => {
        const lastMessages: any = {};  
        // Process sent messages
        sentMessages.forEach(message => {
          const msgData: any = message.payload.doc.data();
          const otherUserId: any = msgData.to_id;  
          if (!lastMessages[otherUserId] || lastMessages[otherUserId].date < msgData.date) {
            lastMessages[otherUserId] = {
              msg: msgData.msg,
              date: msgData.date,
              from_id: msgData.from_id,
              to_id: msgData.to_id,
              is_read: msgData.is_read,
            };
          }
        });  
        // Process received messages
        receivedMessages.forEach(message => {
          const msgData: any = message.payload.doc.data();
          const otherUserId: any = msgData.from_id;  
          // Si le message est plus récent que le dernier message stocké de cette conversation, on le met à jour dans l'objet lastMessages.
          if (!lastMessages[otherUserId] || lastMessages[otherUserId].date < msgData.date) {
            lastMessages[otherUserId] = {
              msg: msgData.msg,
              date: msgData.date,
              from_id: msgData.from_id,
              to_id: msgData.to_id,
              is_read: msgData.is_read,
              hours:''
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
                const otherUserId:any = isMe ? msgData.to_id : msgData.from_id;
                const otherUser:any = users.find((user:any) => user[0].uid === otherUserId);
                console.log(msgData.is_read)
                return {
                  msg:msgData.msg,
                  date:msgData.date,
                  prenom: otherUser[0].prenom,
                  nom: otherUser[0].nom,
                  avatar: otherUser[0].avatar,
                  uid: otherUser[0].uid,                 
                  is_read:msgData.is_read,
                  from_id:msgData.from_id,
                  hours:''
                };
              });
            })
          );
      })
    );
  }
  async getConversation(otherUserId: any, userDetails: any): Promise<Observable<Chat[]>> {
    const userId = this.authService.getUserInfos().uid;
    const conversationRef = this.db.collection("messages", ref =>
    ref.where("from_id", "==", userId)
    .where("to_id", "==", otherUserId)
    .orderBy("date", "asc")
    .limit(10)
    ).snapshotChanges();

    const receivedMessagesRef = this.db.collection("messages", ref =>
        ref.where("from_id", "==", otherUserId)
        .where("to_id", "==", userId)
        .orderBy("date", "asc")
        .limit(10)
    ).snapshotChanges();

    const conversationRef$ = combineLatest([conversationRef, receivedMessagesRef]).pipe(
        map(([sentMessages, receivedMessages]) => {
            let messages:any = [...sentMessages, ...receivedMessages].sort((a:any, b:any) => a.payload.doc.data().date - b.payload.doc.data().date);
            messages = messages.map((message:any) => {
                const msgData = message.payload.doc.data();
                return {
                    msg: msgData.msg,
                    date: msgData.date,
                    prenom: msgData.from_id === userId ? userDetails.prenom : otherUser[0]?.prenom,
                    nom: msgData.from_id === userId ? userDetails.nom : otherUser[0]?.nom,
                    avatar: msgData.from_id === userId ? userDetails.avatar : otherUser[0]?.avatar,
                    uid: msgData.from_id === userId ? userId : otherUserId,
                    is_read: msgData.is_read,
                    hours:''
                };
            });
            return messages;
        })
    );

    const otherUser: any = await this.usersService.getSender(otherUserId);

    return conversationRef$;
}
// update is read messages
async updateIsRead(otherUserId: any, userDetails: any) {
  const senderId = otherUserId;
  const recipientId = userDetails.uid;
  const messages:any = await this.db.collection("messages", ref => {
    return ref.where("from_id", "==", senderId)
              .where("to_id", "==", recipientId)
              .where("is_read", "==", false);
  }).get().toPromise();
  
  const batch = this.db.firestore.batch();
  messages.forEach((messageDoc:any) => {
    const messageRef = messageDoc.ref;
    batch.update(messageRef, { is_read: true });
  });
  
  await batch.commit();
}




}
