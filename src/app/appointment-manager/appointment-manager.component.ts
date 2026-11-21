import { Component, HostListener } from '@angular/core';
import { RendezVousService } from '../services/rendez-vous.service';
import { DateService } from '../services/date.service';
import { debounceTime, distinctUntilChanged, from, map, of, Subject, switchMap, take, tap } from 'rxjs';
import { RendezVous } from '../models/rendez-vous';

@Component({
  selector: 'app-appointment-manager',
  templateUrl: './appointment-manager.component.html',
  styleUrls: ['./appointment-manager.component.scss']
})
export class AppointmentManagerComponent {
  lastVisibleRDV: any = null;
  limit = 20;   
  loading = false;  
  orderDirection:any ='desc'
  rendezVous: any = [];
  isDeleteDisabled:boolean
  searchSubject:any = new Subject<string>();
  constructor(private rdvService: RendezVousService,private  dateService:DateService) {
    this.isDeleteDisabled = false;   
  }

  ngOnInit() {
    this.loadAppointments();
    this.searchSubject
    .pipe(
      debounceTime(400),
      distinctUntilChanged(),
      switchMap((searchTerm: string) => {
        if (!searchTerm || searchTerm.trim() === '') {
          this.rendezVous = []
          this.lastVisibleRDV= null;
          this.loadAppointments();
          return of([]); // Retourne un Observable vide
        }
        // Utilise 'from' pour convertir la Promise en Observable
        return from(this.rdvService.searchRDV(searchTerm));
      }),
      map((results: RendezVous[]) => {
        return results.map((rdv:any) => {
          // ... formatage des dates (assurez-vous que rdv.date est un Timestamp ou un Date valide)
          const timestampInMs = rdv.date && typeof rdv.date.seconds === 'number' ? rdv.date.seconds * 1000 : rdv.date;
          const formattedDate = this.dateService.formatDate(timestampInMs);
          rdv.date = formattedDate.dateString;
          rdv.hours = formattedDate.hours;
          rdv.passed = formattedDate.passed;
          return rdv;
        });
      })
    )
    .subscribe({
      next: (rendezVous:any) => {
        if (rendezVous.length === 0) {
          this.rendezVous = []; // Assurer que la liste est réinitialisée si aucune donnée n'est trouvée
        } else {
          this.rendezVous = rendezVous; // Mets à jour la liste des utilisateurs
        }
      },
      error: (err:any) => console.error('Erreur lors de la recherche :', err),
    });
  }
  async removeRDV(event:Event){
    event.stopPropagation();

    if (this.isDeleteDisabled) {
      return;
    }
  
    // Désactiver la suppression pendant 5 secondes
    this.isDeleteDisabled = true;
    setTimeout(() => {
      this.isDeleteDisabled = false;
    }, 5000);
  
    const target = event.target as HTMLTextAreaElement;
    var RDV_id= target.id;
    this.rdvService.deleteAndUpdate(RDV_id)
    const rdvElement = document.getElementById('rdv-' + RDV_id);
    if (rdvElement) {
      rdvElement.remove();
    }
  }

  search(event: any): void {
    const input = event.target as HTMLInputElement; // Cast pour accéder à "value"
    const searchTerm = input.value; // La valeur saisie
    this.searchSubject.next(searchTerm); // Envoie le terme de recherche au Subject
    
  }
  /*async loadAppointments() {
    if (this.loading) return;  // Ne pas lancer un autre chargement si un est déjà en cours
  
    this.loading = true;  // Début du chargement
    this.rdvService.getAllRDVLazy(this.lastVisibleRDV ? this.lastVisibleRDV.date : null, this.limit).pipe(
      take(1),  // Limiter à une seule émission, ce qui garantit que l'Observable se complète
      tap(result => {
        if (result.length > 0) {
          // Éviter les doublons en filtrant les rendez-vous déjà chargés
          const uniqueRDVs = result.filter((rdv: any) => 
            !this.rendezVous.some((existingRDV: { uid: string; }) => existingRDV.uid === rdv.id)
          );
  
          // Formater la date pour chaque RDV
          uniqueRDVs.forEach((rdv: any) => {
            rdv.date = this.dateService.formatDate(rdv.date.seconds * 1000); // Formatée pour l'affichage
            rdv.hours = rdv.date.hours;
            rdv.passed = rdv.date.passed;
          });
  
          // Ajouter les nouveaux rendez-vous à la liste existante
          this.rendezVous = [...this.rendezVous, ...uniqueRDVs];
  
  
          // Stocker la référence du dernier rendez-vous pour la pagination
          this.lastVisibleRDV = result[result.length - 1];
        }
      })
    ).subscribe({
      complete: () => {
        this.loading = false;  // Une fois le chargement terminé, on change l'état de `loading`
        console.log('Chargement terminé:', this.loading);  // Vérifier si ce log apparaît
      },
      error: (err) => {
        console.error('❌ Erreur lors du chargement des rendez-vous:', err);
        this.loading = false;  // S'assurer que `loading` est remis à `false` en cas d'erreur
      }
    });
  }*/
  toggleOrder() {
    this.orderDirection = this.orderDirection === 'desc' ? 'asc' : 'desc';
    this.rendezVous = []; // Réinitialiser les rendez-vous chargés
    this.lastVisibleRDV = null; // Réinitialiser la pagination
    this.loadAppointments(); // Recharger avec le nouvel ordre
  }
  

  async loadAppointments() {
    if (this.loading) return;
  
    this.loading = true;
    this.rdvService.getAllRDVLazy(this.lastVisibleRDV ? this.lastVisibleRDV.date : null, this.limit, this.orderDirection).pipe(
      take(1),
      tap(result => {
        if (result.length > 0) {
          const uniqueRDVs = result.filter((rdv: any) => 
            !this.rendezVous.some((existingRDV: { uid: string; }) => existingRDV.uid === rdv.id)
          );
  
          uniqueRDVs.forEach((rdv: any) => {
            rdv.date = this.dateService.formatDate(rdv.date.seconds * 1000);
            rdv.hours = rdv.date.hours;
            rdv.passed = rdv.date.passed;
          });
  
          this.rendezVous = [...this.rendezVous, ...uniqueRDVs];
          this.lastVisibleRDV = result[result.length - 1];
        }
      })
    ).subscribe({
      complete: () => { this.loading = false; },
      error: (err) => { console.error('Erreur lors du chargement des rendez-vous:', err); this.loading = false; }
    });
  }
  
  
  
@HostListener('window:scroll', [])
onScroll(): void {
  const scrollPosition = window.innerHeight + window.scrollY;
  const pageHeight = document.body.offsetHeight;
  
  // Si l'utilisateur atteint le bas de la page et qu'aucun chargement n'est en cours
  if (scrollPosition >= pageHeight - 100 && this.loading == false) {
    // Appeler la fonction de chargement des utilisateurs
   this.loadAppointments();
   
  }
}

}
