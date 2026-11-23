import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UsersService } from '../services/users.service';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap, take, tap } from 'rxjs/operators';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit, OnDestroy {
  users: any[] = [];
  lastVisibleUser: any = null;
  loading = false;
  hasMore = true;
  isSearching = false;
  limit = 20;
  searchTerm = '';

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private usersService: UsersService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadUsers();
    this.searchSub = this.searchSubject
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((term: string) => {
          const cleaned = (term || '').trim();
          if (!cleaned) {
            this.isSearching = false;
            this.users = [];
            this.lastVisibleUser = null;
            this.hasMore = true;
            this.loadUsers();
            return of(null);
          }
          this.isSearching = true;
          this.loading = true;
          return this.usersService.searchUsers(cleaned).pipe(
            take(1),
            switchMap((found) => {
              if (!found || found.length === 0) {
                return of([]);
              }
              return forkJoin(
                found.map((u) =>
                  this.usersService.getRdvCountForUser(u.uid).pipe(
                    map((rdvCount) => ({ ...u, rdvCount }))
                  )
                )
              );
            })
          );
        })
      )
      .subscribe({
        next: (users: any[] | null) => {
          if (users === null) return;
          this.users = users || [];
          this.loading = false;
        },
        error: (err: any) => {
          console.error('Erreur lors de la recherche :', err);
          this.loading = false;
        }
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  loadUsers(): void {
    if (this.loading || !this.hasMore || this.isSearching) return;

    this.loading = true;
    this.usersService
      .getUsersLazy(this.lastVisibleUser, this.limit)
      .pipe(
        take(1),
        switchMap((result) => {
          if (!result || result.length === 0) {
            this.hasMore = false;
            return of([]);
          }
          if (result.length < this.limit) {
            this.hasMore = false;
          }
          return forkJoin(
            result.map((user_unit) =>
              this.usersService.getRdvCountForUser(user_unit.uid).pipe(
                map((rdvCount) => ({ ...user_unit, rdvCount }))
              )
            )
          );
        }),
        tap((usersWithRdv: any[]) => {
          if (usersWithRdv.length === 0) return;
          const uniqueUsers = usersWithRdv.filter(
            (user) => !this.users.some((existing) => existing.uid === user.uid)
          );
          this.users = [...this.users, ...uniqueUsers];
          this.lastVisibleUser = usersWithRdv[usersWithRdv.length - 1];
        })
      )
      .subscribe({
        complete: () => {
          this.loading = false;
        },
        error: (err) => {
          console.error('Error loading users:', err);
          this.loading = false;
        }
      });
  }

  @HostListener('window:scroll', [])
  onScroll(): void {
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.body.offsetHeight;
    if (scrollPosition >= pageHeight - 120 && !this.loading && this.hasMore && !this.isSearching) {
      this.loadUsers();
    }
  }

  search(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.searchSubject.next(this.searchTerm);
  }

  openMessage(user: any): void {
    if (!user?.uid) return;
    this.router.navigate(['/admin', 'admin-message'], {
      queryParams: { uid: user.uid }
    });
  }
}
