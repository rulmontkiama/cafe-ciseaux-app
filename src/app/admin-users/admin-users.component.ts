import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UsersService } from '../services/users.service';
import { forkJoin, of, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, take, tap } from 'rxjs/operators';
@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  users: any = []; // Stocker les utilisateurs avec le compte RDV
  lastVisibleUser: any = null;    // Stocker la dernière référence pour la pagination
  loading = false;                // Bloquer les chargements multiples
  limit = 20;                     // Nombre d'utilisateurs à charger par page
  searchSubject:any = new Subject<string>();

  constructor(private usersService: UsersService) {}
  term:any
  ngOnInit() {
    this.loadUsers();
    this.searchSubject
      .pipe(
        debounceTime(400), // Débounce de 400 ms
        distinctUntilChanged(), // Ne pas traiter les mêmes recherches successives
        switchMap((searchTerm: string) => {
          console.log(searchTerm);
          
          if (!searchTerm || searchTerm.trim() === '') {
            console.log('posey');
            this.users = []
            this.lastVisibleUser= null;
            // Si la recherche est vide, appeler la méthode loadUsers pour recharger les utilisateurs
            this.loadUsers();
            return []; // Retourne un tableau vide pour éviter d'ajouter des résultats de recherche
          }
          // Si ce n'est pas vide, effectuer la recherche
          return this.usersService.searchUsers(searchTerm);
        })
      )
      .subscribe({
        next: (users:any) => {
          console.log('Résultats de recherche :', users);
          if (users.length === 0) {
            this.users = []; // Assurer que la liste est réinitialisée si aucune donnée n'est trouvée
          } else {
            this.users = users; // Mets à jour la liste des utilisateurs
          }
        },
        error: (err:any) => console.error('Erreur lors de la recherche :', err),
      });
  }
  
  
  
  

  /**
   * Charge une page d'utilisateurs à partir du dernier utilisateur visible.
   */
  loadUsers(): void {
    if (this.loading) return;
  
    this.loading = true;
  
    this.usersService.getUsersLazy(this.lastVisibleUser, this.limit).pipe(

      switchMap(result => {
        if (result.length > 0) {
          return forkJoin(
            result.map(user_unit => this.usersService.getRdvCountForUser(user_unit.uid).pipe(
              map(rdvCount => ({ ...user_unit, rdvCount }))
            ))
          );
        } else {
          return of([]); // Return an empty observable if no users
        }
      }),
      take(1),  
      tap(usersWithRdv => {
        // Filter for unique users        
        const uniqueUsers = usersWithRdv.filter(user => !this.users.some((existingUser: { uid: string; }) => existingUser.uid === user.uid));
  
        this.users = [...this.users, ...uniqueUsers];
        this.lastVisibleUser = usersWithRdv[usersWithRdv.length - 1];
      })
    ).subscribe({
      complete: () => {
        this.loading = false
      
      },
      error: (err) => {
        console.error('Error loading users:', err);
        this.loading = false;
      }
    });
  }

  /**
   * Détection du scroll pour charger les utilisateurs supplémentaires.
   */
  
  @HostListener('window:scroll', [])
  onScroll(): void {
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.body.offsetHeight;
    
    // Si l'utilisateur atteint le bas de la page et qu'aucun chargement n'est en cours
    if (scrollPosition >= pageHeight - 100 && ! this.loading) {
      // Appeler la fonction de chargement des utilisateurs
      this.loadUsers();
    }
  }
  search(event: any): void {
    const input = event.target as HTMLInputElement; // Cast pour accéder à "value"
    const searchTerm = input.value; // La valeur saisie
    this.searchSubject.next(searchTerm); // Envoie le terme de recherche au Subject
  }
  
  
}
