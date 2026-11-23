import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { AngularFirestore, DocumentChangeAction } from '@angular/fire/compat/firestore';
import { Beer } from '../models/beer.model';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class BeersService {

  constructor(
    private db: AngularFirestore,
  ) { }

  getBeers(): Observable<Beer[]> {
    return this.db.collection<Beer>('beer-selection').snapshotChanges().pipe(
      map(actions => actions.map(a => {
        const data = a.payload.doc.data() as Beer;
        const id = a.payload.doc.id;
        return { id, ...data };
      }))
    );
  }
  addBeer(beer: Beer): Promise<any> {
    return this.db.collection('beer-selection').add({
      description: beer.description,
      nom: beer.name,
      imageUrl: beer.imageUrl
    });
  }
  removeBeer(id: string): Promise<void> {
    return this.db.collection('beer-selection').doc(id).delete();
  }
}
