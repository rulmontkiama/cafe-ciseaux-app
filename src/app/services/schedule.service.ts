import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { map, Observable } from 'rxjs';
import { Schedule } from '../models/schedule';
import firebase from 'firebase/compat/app';
import { log } from 'console';
@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  constructor(private db: AngularFirestore) { }
  getSchedule():Observable<any>{  
    return this.db.collection<Schedule>('horaires', ref => ref)
    .snapshotChanges()
    .pipe(
      map(Schedule => {
        return Schedule.map(a => {
          const data = a.payload.doc.data() as Schedule;
          return data;
        });
      })
    );    
  }
  addBlockDay(blockDay:any) { 
    this.db.collection('blocked_days').add({
      date: firebase.firestore.Timestamp.fromDate(new Date(blockDay))
    });
  }
  async removeBlockDay(date: any) {
    const timestamp = firebase.firestore.Timestamp.fromDate(new Date(date));
    const rdvDoc = await this.db.collection('blocked_days').ref.where('date', '==', timestamp).get();
    rdvDoc.forEach((doc:any) => {
      doc.ref.delete();
    });
  }
  updateReservationDay(day:string,key:any,value:any) {
    this.db.collection<Schedule>('horaires')
      .get()
      .toPromise()
      .then((querySnapshot:any) => {
        console.log(day);
        console.log(key);
        console.log(value);
        
        
        
        querySnapshot.forEach((doc:any) => {
          const data = doc.data();
          const id = doc.id;      
          data[day][0][key] = value;
          this.db.collection('horaires').doc(id).update({ [day]: data[day] });
        });
      })
      .catch((error) => {
        console.log("Error getting documents: ", error);
      });
  }
  updateSchedule(jour: string, key: string, valeur: string) {
    this.db.collection<Schedule>('horaires')
      .get()
      .toPromise()
      .then((querySnapshot:any) => {
        querySnapshot.forEach((doc:any) => {
          const data = doc.data();
          const id = doc.id;
          console.log(id)
          console.log(key)         
          data[jour][0][key] = valeur;
          console.log( data[jour])
          this.db.collection('horaires').doc(id).update({ [jour]: data[jour] });
        });
      })
      .catch((error) => {
        console.log("Error getting documents: ", error);
      });
  }

  
  
  
  
  
  getAllBlocked():Observable<any>{  
    let newItem: any;
    return this.db.collection('blocked_days', ref => ref
    .orderBy('date','desc')).snapshotChanges()
    .pipe(
      map(blockedDays => {
        return blockedDays.map(a => {               
         newItem = a.payload.doc.data()
         newItem.id = a.payload.doc.id         
          const data = newItem ;
          return data;          
        })
      })
    )
  }
}
