import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { firstValueFrom } from 'rxjs';
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
  getAdmin(): Promise<any[]> {
    return firstValueFrom(this.db.collection('admin').valueChanges());
  }

}