import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom, map } from 'rxjs';
@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(
    private db: AngularFirestore
  ) {

   }
  // Lecture unique : se désabonne après la 1re réponse et rejette en cas d'erreur
  // (avant, une erreur de lecture laissait la promesse en attente indéfiniment).
  // admin_id = ID du document : c'est lui que lisent les règles de sécurité, donc l'app et les
  // règles reconnaissent toujours les mêmes admins (même si le champ admin_id du document est faux).
  getAdmin(): Promise<any[]> {
    return firstValueFrom(
      this.db.collection('admin').snapshotChanges().pipe(
        map(docs => docs.map(d => ({ ...(d.payload.doc.data() as object), admin_id: d.payload.doc.id })))
      )
    );
  }

}
