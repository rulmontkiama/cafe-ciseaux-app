import { Injectable } from '@angular/core';
import { initializeApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private firestoreInstance: Firestore;

  constructor() {
    const firebaseApp = initializeApp(environment.firebase);
    this.firestoreInstance = getFirestore(firebaseApp);
  }

  getFirestoreInstance(): Firestore {
    return this.firestoreInstance;
  }
}
