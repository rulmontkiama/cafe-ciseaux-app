// calendar-view.component.ts
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { dayNames } from 'src/app/interface/day-names';
import { RendezVousService } from '../services/rendez-vous.service';
import { DateService } from '../services/date.service';
import { ActivatedRoute } from '@angular/router';
import { AuthenticationService } from 'src/app/services/authentication.service'; 
import { Observable,Subscription} from 'rxjs';
import { DateTime } from 'luxon';

interface RendezVous {
  id: string;
  nom: string;
  prenom: string;
  avatar: string;
  type: string;
  date: string;
  hours: string;
  passed: boolean; 
}


@Component({
  selector: 'app-calendar-view',
  templateUrl: './calendar-view.component.html',
  styleUrls: ['./calendar-view.component.scss'],
})
export class CalendarViewComponent implements OnInit {

  currentYear: number;
  currentMonth: number;
  daysInMonth: any
  selectedDay: any
  dayNames: any;
  monthCount:any;
  isCalendarVisible:any
  isDeleteDisabled:boolean

  monthNames = [
    'Janvier',
    'Février',
    'Mars',
    'Avril',
    'Mai',
    'Juin',
    'Juillet',
    'Août',
    'Septembre',
    'Octobre',
    'Novembre',
    'Décembre',
  ];
  public RDVData: any;
  private appointmentsSubscription: Subscription | null = null;

  constructor(
    private rendez_vous:RendezVousService,
    private dateService:DateService,
    private route: ActivatedRoute,
    private authService: AuthenticationService,
    private cdRef: ChangeDetectorRef,
    
  ) {
    const today = new Date();
    this.currentYear = today.getFullYear();
    this.currentMonth = today.getMonth();
    this.dayNames = dayNames;
    this.isCalendarVisible = true
    this.isDeleteDisabled = false;    
  }

  ngOnInit() {
    this.loadAppointments();
  }

async loadAppointments() {
    const currentRoute = this.route.snapshot.url.join('/');
    let appointmentsData: any[] | null = null; // Nous allons stocker directement les données
    const userId: any = this.authService.getId();
    console.log(this.currentYear);
    
    try {
        if (currentRoute.includes('admin')) {
            // Appel à la version ponctuelle du service
            appointmentsData = await this.rendez_vous.getRDVForCurrentMonthOnce(this.currentYear, this.currentMonth);
        } else {
          console.log(this.currentMonth);
            // Appel à la version ponctuelle du service
            appointmentsData = await this.rendez_vous.getRDVForCurrentUserMonthOnce(userId, this.currentYear, this.currentMonth);
        }
        
        this.RDVData = appointmentsData || [];
        this.monthCount = this.RDVData.length;

        for (const rdv of this.RDVData) {
            // Assurez-vous que rdv.date est bien un objet Timestamp de Firestore
            // et accédez à .seconds si nécessaire, ou convertissez-le si c'est déjà un Date JS
            const timestampInMs = rdv.date && typeof rdv.date.seconds === 'number' ? rdv.date.seconds * 1000 : rdv.date;
            const formattedDate = this.dateService.formatDate(timestampInMs);
            rdv.date = formattedDate.dateString;
            rdv.hours = formattedDate.hours;
            rdv.passed = formattedDate.passed;
        }

        this.updateDaysInMonth();
        this.cdRef.detectChanges(); // Forcer la détection des changements

    } catch (error) {
        console.error('Error handling appointments:', error);
    }
    // Note: this.appointmentsSubscription n'est plus nécessaire car il n'y a plus d'abonnement actif.
    // console.log(this.appointmentsSubscription); // Cette ligne peut être supprimée
}

updateDaysInMonth() {
  const lastDayOfMonth = new Date(this.currentYear, this.currentMonth + 1, 0);
  const numberOfDays = lastDayOfMonth.getDate();

  this.daysInMonth = [];

  for (let day = 1; day <= numberOfDays; day++) {
    const dayDate = new Date(this.currentYear, this.currentMonth, day);
    
    // On crée une date de référence à minuit pour la comparaison
    const referenceDate = new Date(this.currentYear, this.currentMonth, day);
    referenceDate.setHours(0, 0, 0, 0);

    const rendezVousForDay = this.RDVData.filter((rdv: any) => {
      // Si rdv.date est déjà une string formatée par loadAppointments
      // On s'assure que le format match EXACTEMENT (ex: "05/01/2026")
      const formattedDay = day.toString().padStart(2, '0');
      const formattedMonth = (this.currentMonth + 1).toString().padStart(2, '0');
      const expectedStr = `${formattedDay}/${formattedMonth}/${this.currentYear}`;
      
      return rdv.date === expectedStr;
    });

    this.daysInMonth.push({
      date: day,
      dayName: this.dayNames[dayDate.getDay()].slice(0, 3),
      rdvCount: rendezVousForDay.length,
      rendezVous: rendezVousForDay,
    });
  }
  this.cdRef.detectChanges();
}
  previousMonth() {
    if (this.currentMonth === 0) {
      this.currentYear--;
      this.currentMonth = 11;
    } else {
      this.currentMonth--;
    }
    this.loadAppointments();
  }

  nextMonth() {
    if (this.currentMonth === 11) {
      this.currentYear++;
      this.currentMonth = 0;
    } else {
      this.currentMonth++;
    }
    this.loadAppointments();
  }

  selectDay(day: any) {
    this.selectedDay = day;
    // Display the popup here
    this.showPopup(day);
    this.isCalendarVisible = false; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  showPopup(day: any) {
    let message = `Rendez-vous pour le ${day.date} :\n\n`;

    if (day.rendezVous.length === 0) {
        message += "Aucun rendez-vous ce jour-là.";
    } else {
        day.rendezVous.forEach((rdv: any, index: number) => {
            message += `${index + 1}. Nom: ${rdv.nom} ${rdv.prenom}\n`;
            message += `   Heure: ${rdv.hours}\n`;
            message += `   Type: ${rdv.type}\n`;
            // Ajoutez d'autres informations pertinentes ici
            message += `\n`;
        });
    }


}
removeRDV(event:Event){
  
  event.stopPropagation();

  if (this.isDeleteDisabled) {
    console.log("La suppression est temporairement désactivée. Veuillez réessayer dans quelques secondes.");
    return;
  }

  // Désactiver la suppression pendant 5 secondes
  this.isDeleteDisabled = true;
  setTimeout(() => {
    this.isDeleteDisabled = false;
  }, 5000);

  const target = event.target as HTMLTextAreaElement;
  var RDV_id= target.id;
  this.rendez_vous.deleteAndUpdate(RDV_id)
  const rdvElement = document.getElementById('rdv-' + RDV_id);
  if (rdvElement) {
    rdvElement.remove();
  }
}
showCalendar() {
  this.isCalendarVisible = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

}
