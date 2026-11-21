import { Injectable } from '@angular/core';
import { AngularFirestore, QueryDocumentSnapshot } from '@angular/fire/compat/firestore';
import { Users, UsersWithRdvCount,UsersWithRdvSnap }  from '../models/users';
import {   first,  firstValueFrom,  map, Observable, of,} from 'rxjs';
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
    if (!term.trim()) {
      // Si aucun terme n'est fourni, retourne un Observable vide
      return of([]);
    }
  
    // Recherche parmi plusieurs champs (nom, prénom, email, uid) avec une limitation de 20 résultats
    return this.db.collection<Users>('users', ref => 
      ref
        .orderBy('nom') // Tri selon un champ (tu peux ajuster cela selon tes besoins)
        .limit(20)       // Limite à 20 résultats
        .where('nom', '>=', term)  // Rechercher les utilisateurs dont le nom est supérieur ou égal au terme de recherche
    ).snapshotChanges().pipe(
      map(users =>
        users
          .map(a => {
            let newItem = a.payload.doc.data();
            newItem.uid = a.payload.doc.id; // Assigner l'ID du document
            return newItem as Users;
          })
          .filter(user => {
            // Filtrer par les champs pertinents
            const searchTerm = term.toLowerCase();
            return (
              user.nom?.toLowerCase().includes(searchTerm) ||
              user.prenom?.toLowerCase().includes(searchTerm) ||
              user.email?.toLowerCase().includes(searchTerm) ||
              user.uid?.toLowerCase().includes(searchTerm)
            );
          })
      )
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
    return this.db.collection<UsersWithRdvSnap>('users', ref => {
      let query = ref.orderBy('nom').limit(limit);
      
      if (startAfter) {
        
        // Utilisation de startAfter avec le dernier DocumentSnapshot
        query = query.startAfter(startAfter.documentSnapshot);
      }
  
      return query;
    }).snapshotChanges().pipe(
      map(users => {
        return users.map(a => {
          const newItem = a.payload.doc.data();
          newItem.uid = a.payload.doc.id;
          const userWithRdvCount: UsersWithRdvSnap = {
            ...newItem as Users,
            rdvCount: 0, // Tu peux calculer ou récupérer rdvCount ici si nécessaire
            documentSnapshot: a.payload.doc // Ajoute le DocumentSnapshot complet
          };
          return userWithRdvCount;
        });
      })
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