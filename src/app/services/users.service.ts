import { Injectable } from '@angular/core';
import { AngularFirestore, QueryDocumentSnapshot } from '@angular/fire/compat/firestore';
import { Users, UsersWithRdvSnap } from '../models/users';
import { first, firstValueFrom, from, map, Observable, of } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class UsersService {
  lastVisibleUser: QueryDocumentSnapshot<Users> | undefined;

  constructor(
    private db: AngularFirestore
  ) {}
  users: UsersWithRdvSnap[] = []; 
  // Lecture unique : se désabonne après la 1re réponse et rejette en cas d'erreur.
  getUser(id: string): Promise<any[]> {
    return firstValueFrom(this.db.collection('users', ref => ref.where('uid', '==', id)).valueChanges());
  }
  getRdvCountForUser(uid: string): Observable<number> {
    return this.db.collection('rendez_vous', ref => ref.where('user_id', '==', uid)).get().pipe(
      map(snapshot => snapshot.size)  // `snapshot.size` donne le nombre de documents
    );
  }
  searchUsers(term: string): Observable<Users[]> {
    const cleaned = (term || '').trim();
    if (!cleaned) {
      return of([]);
    }
    const lower = cleaned.toLowerCase();
    const limitPerField = 20;

    const runPrefixQuery = (field: string, value: string) =>
      firstValueFrom(
        this.db.collection<Users>('users', ref =>
          ref.orderBy(field).where(field, '>=', value).where(field, '<=', value + '\uf8ff').limit(limitPerField)
        ).get()
      ).catch(() => null);

    const queries = [
      runPrefixQuery('nom', lower),
      runPrefixQuery('prenom', lower),
      runPrefixQuery('email', lower)
    ];

    if (/^[+0-9]/.test(cleaned)) {
      queries.push(runPrefixQuery('phone', cleaned));
    }

    return from(Promise.all(queries)).pipe(
      map((snapshots) => {
        const unique = new Map<string, Users>();
        for (const snap of snapshots) {
          if (!snap) continue;
          snap.docs.forEach((doc) => {
            const data = doc.data() as Users;
            const uid = data.uid || doc.id;
            unique.set(uid, { ...data, uid });
          });
        }
        return Array.from(unique.values()).slice(0, 30);
      })
    );
  }
  
  
  getAllUsers(): Observable<any> {  
    let newItem: any;
    // Modifier la requête pour trier par "nom" et limiter à 20 résultats
    return this.db.collection<Users>('users', ref => 
      ref.orderBy('nom').limit(20)  // Trier par "nom" et limiter à 20 résultats
    ).snapshotChanges()
      .pipe(
        map(users => {
          return users.map(a => {               
            newItem = a.payload.doc.data();
            newItem.id = a.payload.doc.id;  // Assigner l'ID du document
            const data = newItem as Users;
            return data;
          });
        })
      );
  }
  getUsersLazy(startAfter?: any, limit: number = 20): Observable<UsersWithRdvSnap[]> {
    // Lecture ponctuelle .get() pour toujours charger la liste complète depuis Firestore
    // (snapshotChanges + take(1) pouvait ne renvoyer que l'admin déjà présent dans le cache local)
    return this.db.collection<UsersWithRdvSnap>('users', ref => {
      let query = ref.orderBy('nom').limit(limit);
      if (startAfter?.documentSnapshot) {
        query = query.startAfter(startAfter.documentSnapshot);
      }
      return query;
    }).get().pipe(
      map(snapshot =>
        snapshot.docs.map(doc => {
          const newItem = doc.data() as Users;
          return {
            ...newItem,
            uid: newItem.uid || doc.id,
            rdvCount: 0,
            documentSnapshot: doc
          } as UsersWithRdvSnap;
        })
      )
    );
  }
  
  
  getSender(id: string) {
    return this.db.collection('users', ref => ref.where('uid', '==', id))
      .valueChanges()
      .pipe(first()) // prendre la première valeur émise et se désabonner automatiquement
      .toPromise(); // transformer en Promise
  }
  userObserve(uid: string):Observable<any>{  
    return this.db.collection<Users>('users', ref => ref.where('uid', '==', uid)).snapshotChanges()
    .pipe(
      map(RendezVous => {
        return RendezVous.map(a => {
          const data = a.payload.doc.data() as Users;
          return data;
        });
      })
    );  
  }
  getDemo(): Promise<any[]> {
    return firstValueFrom(this.db.collection('demo').valueChanges());
  }
}