import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import {Observable, map, of ,Subscription, first,firstValueFrom} from 'rxjs';
import { RendezVous } from '../models/rendez-vous';
import { FirebaseService } from './fire-base-service.service';
import { Users } from '../models/users';
import { DateService } from './date.service';
import { collection, query, where, getDocs, QuerySnapshot, orderBy } from '@angular/fire/firestore';
import { DateTime } from 'luxon';
@Injectable({
  providedIn: 'root'
})
export class RendezVousService {
  constructor(
    private db: AngularFirestore,
    private firebaseService: FirebaseService,
    private dateService:DateService
    
  ) {    
  }
  getUserRDV(uid: string): Observable<RendezVous[]> {  
    return this.db.collection<RendezVous>('rendez_vous', ref => ref
        .where('user_id', '==', uid)
        .orderBy('date', 'desc'))
        .snapshotChanges()
        .pipe(
            map(RendezVous => {
                return RendezVous.map(a => {
                    const data = a.payload.doc.data() as RendezVous;
                    data.id = a.payload.doc.id  
                    return data;
                });
            })
        );    
}

  getScissor(uid: string): Promise<any> {
    // Lecture unique (avant : écoute qui ne se fermait jamais, et promesse bloquée en cas d'erreur)
    return firstValueFrom(this.db.collection<Users>('users', ref => ref.where('uid', '==', uid)).valueChanges());
}

  getAllRDV():Observable<any>{  
    console.log('getAllRDV');
    
    let newItem: any;
    return this.db.collection<RendezVous>('rendez_vous', ref => ref
    .orderBy('date','desc')).snapshotChanges()
    .pipe(
      map(RendezVous => {
        return RendezVous.map(a => {               
         newItem = a.payload.doc.data()
         newItem.id = a.payload.doc.id         
          const data = newItem as RendezVous;
          return data;          
        })
      })
    )
  }


async searchRDV(term: string): Promise<RendezVous[]> {
    if (!term.trim()) {
      return []; // Retourne un tableau vide directement si le terme est vide
    }

    const lowerSearchTerm = term.toLowerCase();
    const queryLimit = 20; // Définir une limite de requête pour chaque recherche

    // --- Requête 1: Recherche par préfixe sur le champ 'nom' ---
    const nomQueryPromise = firstValueFrom(
      this.db.collection<RendezVous>('rendez_vous', ref =>
        ref
          .orderBy('nom')
          .where('nom', '>=', lowerSearchTerm)
          .where('nom', '<=', lowerSearchTerm + '\uf8ff')
          .limit(queryLimit)
      ).get()
    );

    // --- Requête 2: Recherche par préfixe sur le champ 'prenom' ---
    const prenomQueryPromise = firstValueFrom(
      this.db.collection<RendezVous>('rendez_vous', ref =>
        ref
          .orderBy('prenom')
          .where('prenom', '>=', lowerSearchTerm)
          .where('prenom', '<=', lowerSearchTerm + '\uf8ff')
          .limit(queryLimit)
      ).get()
    );

    // --- Exécuter les deux requêtes en parallèle ---
    const [nomSnapshot, prenomSnapshot] = await Promise.all([
      nomQueryPromise,
      prenomQueryPromise
    ]);

    // --- Traiter les résultats de la requête 'nom' ---
    const nomResults = nomSnapshot.docs.map(doc => {
      const data = doc.data() as RendezVous;
      const id = doc.id;
      const { id: _, ...restOfData } = data;
      return { id, ...restOfData };
    });

    // --- Traiter les résultats de la requête 'prenom' ---
    const prenomResults = prenomSnapshot.docs.map(doc => {
      const data = doc.data() as RendezVous;
      const id = doc.id;
      const { id: _, ...restOfData } = data;
      return { id, ...restOfData };
    });

    // --- Fusionner et dédupliquer les résultats ---
    const combinedResults = [...nomResults, ...prenomResults];

    // Utiliser un Map pour dédupliquer par 'id' (chaque doc Firestore a un id unique)
    const uniqueResultsMap = new Map<string, RendezVous>();
    combinedResults.forEach(rdv => {
      if (rdv.id) { // Assurez-vous que l'ID existe
        uniqueResultsMap.set(rdv.id, rdv);
      }
    });

    // Convertir le Map en tableau et limiter le nombre total de résultats si nécessaire
    // On pourrait vouloir limiter à 20 résultats finaux, pas 20 par requête.
    const finalResults = Array.from(uniqueResultsMap.values()).slice(0, queryLimit); // Limite globale à 20 ici

    return finalResults;
}
  
  /*getAllRDVLazy(lastVisibleDate: any, limit: number): Observable<any> {
    let newItem: any;
  
    // Si lastVisibleDate est un objet personnalisé, convertir en timestamp
    let query = this.db.collection<RendezVous>('rendez_vous', ref => 
      ref.orderBy('date', 'desc')
         .limit(limit)
    );
  
    if (lastVisibleDate) {
      // Assurez-vous que lastVisibleDate est un objet Date ou Timestamp
      const dateTimestamp = this.dateService.convertToDate(lastVisibleDate); // Convertir en date ou timestamp
  
      query = this.db.collection<RendezVous>('rendez_vous', ref => 
        ref.orderBy('date', 'desc')
           .startAfter(dateTimestamp)  // Passer un objet Date ou Timestamp
           .limit(limit)
      );
    }
  
    return query.snapshotChanges().pipe(
      map(RendezVous => {
        return RendezVous.map(a => {               
          newItem = a.payload.doc.data();
          newItem.id = a.payload.doc.id;         
          return newItem as RendezVous;          
        });
      })
    );
  }*/

  getAllRDVLazy(lastVisibleDate: any, limit: number, orderDirection: 'asc' | 'desc'): Observable<any> {
    console.log('rdv lazy');
    
    let newItem: any;
    let query = this.db.collection<RendezVous>('rendez_vous', ref => 
      ref.orderBy('date', orderDirection).limit(limit)
    );
  
    if (lastVisibleDate) {
      const dateTimestamp = this.dateService.convertToDate(lastVisibleDate); // Convertir en date ou timestamp
      query = this.db.collection<RendezVous>('rendez_vous', ref => 
        ref.orderBy('date', orderDirection)
           .startAfter(dateTimestamp)
           .limit(limit)
      );
    }
  
    return query.snapshotChanges().pipe(
      map(RendezVous => {
        return RendezVous.map(a => {               
          newItem = a.payload.doc.data();
          newItem.id = a.payload.doc.id;         
          return newItem as RendezVous;          
        });
      })
    );
  }
  
async getRDVForCurrentMonthOnce(year: number, month: number): Promise<RendezVous[]> {
  // Avec Luxon, month est de 1 à 12 (pas besoin de faire -1)
// Si month arrive en tant qu'index 0-11 (ex: 11 pour décembre)
    // On ajoute +1 pour que Luxon comprenne "Mois 12"
    const luxonMonth = month + 1; 
    
    const startOfMonth = DateTime.fromObject({ year, month: luxonMonth }).startOf('month').toJSDate();
    const endOfMonth = DateTime.fromObject({ year, month: luxonMonth }).endOf('month').toJSDate();

    const q = this.db.collection<RendezVous>('rendez_vous', ref => ref
      .where('date', '>=', startOfMonth)
      .where('date', '<=', endOfMonth)
      .orderBy('date', 'asc'));

    // Utilisez firstValueFrom
    const snapshot = await firstValueFrom(q.get()); // `.get()` retourne un Observable<QuerySnapshot<RendezVous>>

    return snapshot.docs.map(doc => {
      const data = doc.data() as RendezVous;
      const id = doc.id;
      // ... résoudre l'erreur d'ID ici ...
      const { id: _, ...restOfData } = data; // Exclure 'id' si elle est dans 'data'
      return { id, ...restOfData };
    });
  }

  async getRDVForCurrentUserMonthOnce(userId: string, year: number, month: number): Promise<RendezVous[]> {
    const startOfMonth = new Date(year, month, 1);
    const endOfMonth = new Date(year, month + 1, 0,23, 59, 59);
    console.log(userId);
    console.log(userId);
    console.log(startOfMonth);
    console.log(endOfMonth);
    
    
    const q = this.db.collection<RendezVous>('rendez_vous', ref => ref
      .where('user_id', '==', userId)
      .where('date', '>=', startOfMonth)
      .where('date', '<=', endOfMonth)
      .orderBy('date', 'asc'));

    // Utilisez firstValueFrom
    const snapshot = await firstValueFrom(q.get());

    return snapshot.docs.map(doc => {
      const data = doc.data() as RendezVous;
      const id = doc.id;
      // ... résoudre l'erreur d'ID ici ...
      const { id: _, ...restOfData } = data; // Exclure 'id' si elle est dans 'data'
      return { id, ...restOfData };
    });
  }
  
  getRDVForCurrentMonth(currentYear: any, currentMonth: any): Observable<any> {
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    return this.db.collection<RendezVous>('rendez_vous', ref => ref
        .where('date', '>=', startOfMonth)
        .where('date', '<=', endOfMonth)
        .orderBy('date', 'asc'))
        .snapshotChanges()
        .pipe(
            map(RendezVous => {
                return RendezVous.map(a => {
                    let newItem: any = a.payload.doc.data();
                    newItem.id = a.payload.doc.id;
                    return newItem;
                });
            })
        );
}


getRDVForCurrentUserMonth(userId: string, currentYear: any, currentMonth: any): Observable<any> {
    const startOfMonth = new Date(currentYear, currentMonth, 1);
    const endOfMonth = new Date(currentYear, currentMonth + 1, 0);

    return this.db.collection('rendez_vous', ref => ref
        .where('user_id', '==', userId)
        .where('date', '>=', startOfMonth)
        .where('date', '<=', endOfMonth)
        .orderBy('date', 'asc'))
        .snapshotChanges()
        .pipe(
            map(RendezVous => {
                return RendezVous.map(a => {
                    let newItem: any = a.payload.doc.data();
                    newItem.id = a.payload.doc.id;
                    return newItem;
                });
            })
        );
}


  deleteRDV(uid: string): Promise<void> {
    return this.db.collection('rendez_vous').doc(uid).delete();
  }
  async deleteAndUpdate(rdv_id: string) {
    /*
    scissor du rdv supprimé : 3
    si supprimé les rendez_vous supéreieur si il y en à :
      le premier rdv supérieur
    */ 
    try {
      // Récupération de l'user_id du RDV supprimé
      console.log(rdv_id)
      const rdvDoc:any = await this.db.collection('rendez_vous').doc(rdv_id).get().toPromise();
      const rdvData = rdvDoc.data();
      console.log(rdvData)
      const user_id = rdvData.user_id;
      const date = rdvData.date;
      const oldScissor = rdvData.scissor;
      console.log(user_id)
      console.log(oldScissor)
  
      // Suppression du rendez-vous
      await this.deleteRDV(rdv_id);
  
      // Mise à jour du champ scissor dans la collection users
      const userRef = this.db.collection('users').doc(user_id);
      const userDoc:any = await userRef.get().toPromise();
      const userScissor = userDoc.data()?.scissor;
      await userRef.update({ scissor: userScissor-1 });
  
      // Récupère les rendez_vous supérieur au rendez_vous supprimé
      const rdvRef = this.db.collection('rendez_vous').ref;
      const rdvQuery = rdvRef.where('user_id', '==', user_id).where('date', '>', date);
      const rdvDocs = await rdvQuery.get();
      const rdvBatch = this.db.firestore.batch();
      let scissorCount = oldScissor || 0;
  
      // Boucle des rendez_vous supérieur au rendez_vous supprimé
      let isFirstPass = true;      
      rdvDocs.forEach(rdvDoc => {
        if (isFirstPass) {
          isFirstPass = false;
        } else {
          scissorCount = scissorCount >= 5 ? 1 : scissorCount + 1;
        }      
        // Mise à jour du champ scissor dans la collection rendez-vous
        rdvBatch.update(rdvRef.doc(rdvDoc.id), { scissor: scissorCount });
      });
      await rdvBatch.commit();
  
    } catch (error) {
      console.error(error);
    }
  }
  async addRDV(rdvForm:any) { 
    const dateTimestamp = rdvForm.date;  
    console.log(dateTimestamp);
      
    const firestore = this.firebaseService.getFirestoreInstance(); 
    if (!firestore) {
      console.error('Erreur: Instance Firestore non disponible.');
      return;
    }
   
    // Créer un référence à la collection "rendez_vous"
    const rendezVousRef = this.db.collection('rendez_vous');

    // Ajouter le document avec les données converties
    await rendezVousRef.doc().set({
      date: dateTimestamp,
      type: rdvForm.type,
      user_id: rdvForm.user_id,
      nom: rdvForm.nom,
      prenom: rdvForm.prenom,
      scissor: rdvForm.scissor,
      avatar: rdvForm.avatar
    });
  }
  
  async getRendezVousDataLength(uid: string): Promise<number> {
      // 1. Construire la requête avec un filtre côté serveur
      const query = this.db.collection<RendezVous>('rendez_vous', ref =>
          ref.where('user_id', '==', uid) // <--- C'est la clé ! Filtre directement sur le serveur
      );

      // 2. Exécuter la requête en tant que lecture ponctuelle (get())
      // firstValueFrom convertit l'Observable de .get() en une Promise
      const snapshot = await firstValueFrom(query.get());

      // 3. Utiliser la propriété .size du QuerySnapshot pour obtenir le nombre de documents
      return snapshot.size;
  }
/*
à jour la valeur de data.scissor du rendez-vous le plus proche 
du timestamp à la date la plus éloignée, vous pouvez trier les 
rendez-vous par ordre croissant de leur date,
 en utilisant orderBy('date', 'asc') au lieu de orderBy('date', 'desc'). Ensuite, vous pouvez simplement incrémenter data.scissor pour chaque rendez-vous en vérifiant si la valeur est égale à 5.

Enfin, pour renvoyer la valeur de data.scissor pour le rendez-vous 
le plus proche du timestamp, vous pouvez stocker la première valeur 
de data.scissor dans une variable avant de mettre à jour 
le rendez-vous.
*/
  /* rdvTransaction(rdvForm:any) {

    const timestamp = new Date(rdvForm.date);
    let closestScissor: any = null;
    let lastScissor: any = null;
    return new Promise((resolve, reject) => {
      const subscription = this.db.collection('rendez_vous', ref => ref
        .where('date', '>', timestamp)
        .where('user_id', '==', rdvForm.user_id)
        .orderBy('date','asc'))
        .snapshotChanges()
        .pipe(
          map(actions => {
            return actions.map(a => {
              const data = a.payload.doc.data();
              const id = a.payload.doc.id;
              return { id, data };
            });
          })
        )
        .subscribe(rendezvous => {
          rendezvous.forEach(rdv => {
            let data: any = rdv.data;
            if (closestScissor == null) {
              closestScissor = data.scissor;
            }
            if (data.scissor === 5) {
              data.scissor =  1
              this.db.doc(`rendez_vous/${rdv.id}`).update({
                scissor: data.scissor
              });
            } else {
              data.scissor = data.scissor + 1
              this.db.doc(`rendez_vous/${rdv.id}`).update({
                scissor: data.scissor 
              });
            }
            lastScissor = data.scissor;
          });
          subscription.unsubscribe();
          resolve(closestScissor);
        });
    });
  }*/
    async rdvTransaction(rdvForm: any): Promise<any> {
        const timestamp = new Date(rdvForm.date);

        // 1. Lecture ponctuelle des rendez-vous futurs (moins cher que le listener continu ici)
        const queryRef = this.db.collection<RendezVous>('rendez_vous', ref => ref
            .where('date', '>', timestamp)
            .where('user_id', '==', rdvForm.user_id)
            .orderBy('date', 'asc'));

        const snapshot = await firstValueFrom(queryRef.get()); // Une seule lecture des documents correspondants

        let closestScissor: any = null;
        const batch = this.db.firestore.batch(); // Crée une opération d'écriture par lot

        snapshot.docs.forEach(doc => {
            let data: any = doc.data(); // Récupère les données du document
            const docRef = this.db.collection('rendez_vous').doc(doc.id).ref; // Obtient la référence Firestore native

            if (closestScissor == null) {
                closestScissor = data.scissor; // Capture la valeur du premier ciseau trouvé
            }

            let newScissorValue: number;
            if (data.scissor === 5) {
                newScissorValue = 1;
            } else {
                newScissorValue = data.scissor + 1;
            }

            // Ajoute l'opération d'update au lot, au lieu de l'exécuter immédiatement
            batch.update(docRef, { scissor: newScissorValue });
        });

        await batch.commit(); // Exécute toutes les opérations du lot en une seule fois

        return closestScissor;
    }


  updateUserScissor(rdvForm:any): Promise<void> {
    return this.db.collection('users').doc(rdvForm.user_id).update({ scissor: rdvForm.scissor });
  }
  available_date(date: string):Observable<any> {
    const timestamp = new Date(date);
    const startOfDay = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate());
    const endOfDay = new Date(timestamp.getFullYear(), timestamp.getMonth(), timestamp.getDate() );
    endOfDay.setHours(23,59,0)
    return this.db.collection('rendez_vous', ref => ref
    .where('date', '>=', startOfDay)
    .where('date', '<', endOfDay)
    .orderBy('date','desc')).snapshotChanges()
    .pipe(
      map(RendezVous => {
        return RendezVous.map(a => {               
         const data:any = a.payload.doc.data()    
          return data;          
        })
      })
    )
  }
}
function subscribe(arg0: (supplier: any) => void) {
  throw new Error('Function not implemented.');
}

