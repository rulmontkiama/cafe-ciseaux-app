import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { Observable, combineLatest, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';
import { Chat } from '../models/chat.model';
import { UsersService } from './users.service';
import { AuthenticationService } from './authentication.service';
import { environment } from 'src/environments/environment';

export const DEFAULT_MESSAGE_TTL_DAYS = 7;

export interface MessageTtlOption {
  days: number;
  label: string;
}

export const MESSAGE_TTL_OPTIONS: MessageTtlOption[] = [
  { days: 1, label: '24 h' },
  { days: 7, label: '7 j' },
  { days: 30, label: '30 j' },
];

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BATCH_LIMIT = 400;

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  private purgingIds = new Set<string>();

  constructor(
    private db: AngularFirestore,
    private usersService: UsersService,
    private authService: AuthenticationService,
  ) {}

  /**
   * Envoie un message temporaire avec date d'expiration (`expiresAt`).
   * Compatible avec la suppression automatique côté client ET la politique TTL native Firestore.
   */
  onSendMessage(
    fromId: any,
    toId: any,
    msg: any,
    date: any,
    ttlDays: number = DEFAULT_MESSAGE_TTL_DAYS
  ) {
    const safeTtl = [1, 7, 30].includes(Number(ttlDays)) ? Number(ttlDays) : DEFAULT_MESSAGE_TTL_DAYS;
    const sendDate = date instanceof Date ? date : new Date(this.toMs(date) || Date.now());
    const expiresAt = new Date(sendDate.getTime() + safeTtl * MS_PER_DAY);

    return this.db.collection('messages').add({
      from_id: fromId,
      to_id: toId,
      msg: msg,
      date: sendDate,
      is_read: false,
      ttl_days: safeTtl,
      expiresAt,
    }).then((docRef) => {
      // Déclenche la notification push en arrière-plan (ne bloque ni n'échoue l'envoi du message)
      this.triggerPushNotification(String(toId || ''), String(msg || ''));
      return docRef;
    });
  }

  private async triggerPushNotification(toUid: string, rawMsg: string): Promise<void> {
    const endpoint = environment.pushWorkerUrl;
    if (!endpoint || !toUid) return;
    try {
      const user = await this.authService.afAuth.currentUser;
      if (!user || user.uid === toUid) return;
      const idToken = await user.getIdToken();
      if (!idToken) return;
      const preview = rawMsg.replace(/\s+/g, ' ').trim().slice(0, 140);
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ toUid, preview }),
      });
    } catch {
      // Silencieux : le message est déjà enregistré dans Firestore
    }
  }

  getUnreadMessageCount(userId: string): Observable<number> {
    return this.db.collection('messages', ref => ref
      .where('to_id', '==', userId)
      .where('is_read', '==', false)
    )
    .snapshotChanges()
    .pipe(
      map(actions => {
        const { active, expiredRefs } = this.partitionExpired(actions);
        if (expiredRefs.length > 0) {
          this.purgeExpiredRefs(expiredRefs);
        }
        return active.length;
      })
    );
  }

  toMs(d: any): number {
    if (!d) return 0;
    if (typeof d.toMillis === 'function') return d.toMillis();
    if (typeof d.seconds === 'number') return d.seconds * 1000;
    if (d instanceof Date) return d.getTime();
    return Number(d) || 0;
  }

  isExpired(msgData: any, nowMs: number = Date.now()): boolean {
    if (!msgData?.expiresAt) return false;
    const expMs = this.toMs(msgData.expiresAt);
    return expMs > 0 && expMs <= nowMs;
  }

  formatExpiryHint(expiresAt: any): string {
    if (!expiresAt) return '';
    const diffMs = this.toMs(expiresAt) - Date.now();
    if (diffMs <= 0) return 'Expiré';
    const hours = Math.ceil(diffMs / (60 * 60 * 1000));
    if (hours < 24) {
      return hours <= 1 ? 'Expire < 1 h' : `Expire dans ${hours} h`;
    }
    const days = Math.ceil(diffMs / MS_PER_DAY);
    return `Expire dans ${days} j`;
  }

  formatDayDivider(ms: number): string {
    if (!ms) return '';
    const d = new Date(ms);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfTarget = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const diffDays = Math.round((startOfToday - startOfTarget) / MS_PER_DAY);
    if (diffDays === 0) return "Aujourd'hui";
    if (diffDays === 1) return 'Hier';
    return d.toLocaleDateString('fr-BE', { day: 'numeric', month: 'short' });
  }

  private partitionExpired(actions: any[]): { active: any[]; expiredRefs: Array<{ id: string; ref: any }> } {
    const nowMs = Date.now();
    const active: any[] = [];
    const expiredRefs: Array<{ id: string; ref: any }> = [];
    for (const a of actions || []) {
      const data = a.payload?.doc?.data();
      if (this.isExpired(data, nowMs)) {
        expiredRefs.push({ id: a.payload.doc.id, ref: a.payload.doc.ref });
      } else {
        active.push(a);
      }
    }
    return { active, expiredRefs };
  }

  private purgeExpiredRefs(refs: Array<{ id: string; ref: any }>): void {
    const toDelete = refs.filter(item => !this.purgingIds.has(item.id));
    if (toDelete.length === 0) return;

    toDelete.forEach(item => this.purgingIds.add(item.id));

    (async () => {
      try {
        for (let i = 0; i < toDelete.length; i += BATCH_LIMIT) {
          const chunk = toDelete.slice(i, i + BATCH_LIMIT);
          const batch = this.db.firestore.batch();
          chunk.forEach(item => batch.delete(item.ref));
          await batch.commit();
        }
      } catch {
        // Silencieux si un message a déjà été supprimé ou si le réseau est hors ligne
      } finally {
        toDelete.forEach(item => this.purgingIds.delete(item.id));
      }
    })();
  }

  getChatMsg(userDetails: any): Observable<Chat[]> {
    const userId = userDetails.uid;

    const sentMessages$ = this.db.collection('messages', ref =>
      ref.where('from_id', '==', userId)
    ).snapshotChanges();

    const receivedMessages$ = this.db.collection('messages', ref =>
      ref.where('to_id', '==', userId)
    ).snapshotChanges();

    return combineLatest([sentMessages$, receivedMessages$]).pipe(
      switchMap(([sentRaw, receivedRaw]) => {
        const sentPart = this.partitionExpired(sentRaw);
        const recvPart = this.partitionExpired(receivedRaw);
        const allExpired = [...sentPart.expiredRefs, ...recvPart.expiredRefs];
        if (allExpired.length > 0) {
          this.purgeExpiredRefs(allExpired);
        }

        const lastMessages: Record<string, any> = {};
        sentPart.active.forEach(message => {
          const msgData: any = message.payload.doc.data();
          const otherUserId: string = msgData.to_id;
          if (!lastMessages[otherUserId] || this.toMs(lastMessages[otherUserId].date) < this.toMs(msgData.date)) {
            lastMessages[otherUserId] = {
              id: message.payload.doc.id,
              msg: msgData.msg,
              date: msgData.date,
              dateMs: this.toMs(msgData.date),
              from_id: msgData.from_id,
              to_id: msgData.to_id,
              is_read: msgData.is_read,
              expiresAt: msgData.expiresAt,
              ttl_days: msgData.ttl_days,
            };
          }
        });
        recvPart.active.forEach(message => {
          const msgData: any = message.payload.doc.data();
          const otherUserId: string = msgData.from_id;
          if (!lastMessages[otherUserId] || this.toMs(lastMessages[otherUserId].date) < this.toMs(msgData.date)) {
            lastMessages[otherUserId] = {
              id: message.payload.doc.id,
              msg: msgData.msg,
              date: msgData.date,
              dateMs: this.toMs(msgData.date),
              from_id: msgData.from_id,
              to_id: msgData.to_id,
              is_read: msgData.is_read,
              expiresAt: msgData.expiresAt,
              ttl_days: msgData.ttl_days,
              hours: ''
            };
          }
        });

        const otherUserIds = Object.keys(lastMessages);
        const users$ = otherUserIds.length > 0
          ? forkJoin(otherUserIds.map(id => this.usersService.getSender(id)))
          : of([]);

        return users$.pipe(
          map(users => {
            return Object.values(lastMessages).map((msgData: any) => {
              const isMe = msgData.from_id === userId;
              const otherUserId: any = isMe ? msgData.to_id : msgData.from_id;
              const otherUser: any = users.find((user: any) => user && user[0] && user[0].uid === otherUserId);
              if (!otherUser) { return null; }
              return {
                id: msgData.id,
                msg: msgData.msg,
                date: msgData.date,
                dateMs: msgData.dateMs,
                prenom: otherUser[0].prenom,
                nom: otherUser[0].nom,
                avatar: otherUser[0].avatar,
                uid: otherUser[0].uid,
                is_read: msgData.is_read,
                from_id: msgData.from_id,
                expiresAt: msgData.expiresAt,
                ttl_days: msgData.ttl_days,
                expiryHint: this.formatExpiryHint(msgData.expiresAt),
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

    const conversationRef = this.db.collection('messages', ref =>
      ref.where('from_id', '==', userId)
        .where('to_id', '==', otherUserId)
    ).snapshotChanges();

    const receivedMessagesRef = this.db.collection('messages', ref =>
      ref.where('from_id', '==', otherUserId)
        .where('to_id', '==', userId)
    ).snapshotChanges();

    const otherUser: any = await this.usersService.getSender(otherUserId);

    const conversationRef$ = combineLatest([conversationRef, receivedMessagesRef]).pipe(
      map(([sentRaw, receivedRaw]) => {
        const sentPart = this.partitionExpired(sentRaw);
        const recvPart = this.partitionExpired(receivedRaw);
        const allExpired = [...sentPart.expiredRefs, ...recvPart.expiredRefs];
        if (allExpired.length > 0) {
          this.purgeExpiredRefs(allExpired);
        }

        const merged = [...sentPart.active, ...recvPart.active]
          .sort((a: any, b: any) => this.toMs(a.payload.doc.data()?.date) - this.toMs(b.payload.doc.data()?.date))
          .slice(-100);

        let lastGroupLabel = '';
        return merged.map((message: any) => {
          const msgData = message.payload.doc.data();
          const dateMs = this.toMs(msgData.date) || Date.now();
          const dayGroupLabel = this.formatDayDivider(dateMs);
          const showDayDivider = dayGroupLabel !== lastGroupLabel;
          lastGroupLabel = dayGroupLabel;

          return {
            id: message.payload.doc.id,
            msg: msgData.msg,
            date: msgData.date,
            dateMs,
            prenom: msgData.from_id === userId ? userDetails.prenom : otherUser?.[0]?.prenom,
            nom: msgData.from_id === userId ? userDetails.nom : otherUser?.[0]?.nom,
            avatar: msgData.from_id === userId ? userDetails.avatar : otherUser?.[0]?.avatar,
            uid: msgData.from_id === userId ? userId : otherUserId,
            is_read: msgData.is_read,
            hours: '',
            from_id: msgData.from_id,
            expiresAt: msgData.expiresAt,
            ttl_days: msgData.ttl_days,
            expiryHint: this.formatExpiryHint(msgData.expiresAt),
            dayGroupLabel,
            showDayDivider,
          };
        });
      })
    );

    return conversationRef$;
  }

  /** Supprime toute une conversation entre deux utilisateurs (réservé à l'admin dans firestore.rules). */
  async deleteConversation(otherUserId: string, myUid: string): Promise<number> {
    if (!otherUserId || !myUid) return 0;
    const [sentSnap, recvSnap] = await Promise.all([
      firstValueFrom(
        this.db.collection('messages', ref =>
          ref.where('from_id', '==', myUid).where('to_id', '==', otherUserId)
        ).get()
      ),
      firstValueFrom(
        this.db.collection('messages', ref =>
          ref.where('from_id', '==', otherUserId).where('to_id', '==', myUid)
        ).get()
      ),
    ]);

    const docs = [...(sentSnap?.docs || []), ...(recvSnap?.docs || [])];
    if (docs.length === 0) return 0;

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = this.db.firestore.batch();
      docs.slice(i, i + BATCH_LIMIT).forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
    return docs.length;
  }

  // Marque les messages reçus comme lus
  async updateIsRead(otherUserId: any, userDetails: any): Promise<void> {
    if (!otherUserId || !userDetails?.uid) return;
    const senderId = otherUserId;
    const recipientId = userDetails.uid;
    const messages: any = await firstValueFrom(
      this.db.collection('messages', ref =>
        ref.where('from_id', '==', senderId)
          .where('to_id', '==', recipientId)
          .where('is_read', '==', false)
      ).get()
    );

    if (!messages || messages.empty) return;

    const batch = this.db.firestore.batch();
    let ops = 0;
    messages.forEach((messageDoc: any) => {
      if (!this.isExpired(messageDoc.data())) {
        batch.update(messageDoc.ref, { is_read: true });
        ops++;
      }
    });
    if (ops > 0) {
      await batch.commit();
    }
  }
}
