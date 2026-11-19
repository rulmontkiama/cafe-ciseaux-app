import { Injectable } from '@angular/core';
import { DateTime } from 'luxon';
@Injectable({
  providedIn: 'root'
})
export class DateService {
  constructor() { }

  formatDate(timestampMs: number) {
    // Convertir le timestamp Firestore en UTC → puis en Europe/Paris
    const paris = DateTime
      .fromMillis(timestampMs, { zone: 'utc' }) // timestamp Firestore est toujours UTC
      .setZone('Europe/Paris');                 // conversion pour l’affichage

    return {
      dateString: paris.toFormat("dd/MM/yyyy"),
      hours: paris.toFormat("HH:mm"),
      passed: paris < DateTime.now().setZone("Europe/Paris")
    };
  }

  private formatDateToString(date: any): any {
    const year = date.getFullYear();
    const month = date.getMonth()+1;
    const day = date.getDate();
    return `${day}/${month}/${year}`;
  }

  private formatHours(date: any): any{
    const hours = date.getHours();
    const minutes = (date.getMinutes()<10?'0':'') + date.getMinutes();
    return `${hours}:${minutes}`;
  }
  private hasPassed(date: any): boolean {
    const now = new Date();
    return date <= now;
  
  }
  convertToDate(lastVisibleDate: any): Date {
    if (lastVisibleDate && lastVisibleDate.dateString && lastVisibleDate.hours) {
      const [day, month, year] = lastVisibleDate.dateString.split('/');
      const [hour, minute] = lastVisibleDate.hours.split(':');
      
      // Construire un objet Date avec les informations
      return new Date(`${month}/${day}/${year} ${hour}:${minute}:00`);
    }
    return new Date();  // Si date non valide, retourner une date actuelle
  }
}
