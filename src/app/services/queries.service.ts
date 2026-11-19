import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { collection, query, where, getDocs ,getFirestore} from "firebase/firestore";
import { Observable } from 'rxjs';
import { Users } from '../models/users';

@Injectable({
  providedIn: 'root'
})
export class QueryService {
  constructor(private db: AngularFirestore) { }

}
