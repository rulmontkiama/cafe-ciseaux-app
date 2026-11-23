import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { Subject, Subscription, debounceTime, distinctUntilChanged, from, map, of, switchMap, take, tap } from 'rxjs';
import { RendezVousService } from '../services/rendez-vous.service';
import { DateService } from '../services/date.service';
import { AlertService } from '../services/alert.service';
import { UsersService } from '../services/users.service';

@Component({
  selector: 'app-appointment-manager',
  templateUrl: './appointment-manager.component.html',
  styleUrls: ['./appointment-manager.component.scss']
})
export class AppointmentManagerComponent implements OnInit, OnDestroy {
  lastVisibleCursor: any = null;
  limit = 20;
  loading = false;
  hasMore = true;
  isSearching = false;
  orderDirection: 'asc' | 'desc' = 'desc';
  rendezVous: any[] = [];
  isDeleteDisabled = false;
  searchTerm = '';

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;
  private phoneCache = new Map<string, string>();

  constructor(
    private rdvService: RendezVousService,
    private dateService: DateService,
    private usersService: UsersService,
    private _toast: AlertService
  ) {}

  ngOnInit(): void {
    this.loadAppointments();
    this.searchSub = this.searchSubject
      .pipe(
        debounceTime(350),
        distinctUntilChanged(),
        switchMap((term: string) => {
          const cleaned = (term || '').trim();
          if (!cleaned) {
            this.isSearching = false;
            this.resetAndLoad();
            return of(null);
          }
          this.isSearching = true;
          this.loading = true;
          return from(this.rdvService.searchRDV(cleaned));
        }),
        map((results: any[] | null) => {
          if (results === null) return null;
          return results.map((rdv: any) => this.normalizeRdv(rdv));
        })
      )
      .subscribe({
        next: (results: any[] | null) => {
          if (results === null) return;
          this.rendezVous = results;
          this.hydratePhones(this.rendezVous);
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

  private normalizeRdv(rdv: any): any {
    const rawDate = rdv.date;
    const timestampInMs = rawDate && typeof rawDate.seconds === 'number' ? rawDate.seconds * 1000 : Number(rawDate);
    const formatted = this.dateService.formatDate(timestampInMs);
    return {
      ...rdv,
      rawDate,
      dateString: formatted.dateString,
      hours: formatted.hours,
      passed: formatted.passed
    };
  }

  private resetAndLoad(): void {
    this.rendezVous = [];
    this.lastVisibleCursor = null;
    this.hasMore = true;
    this.loadAppointments();
  }

  async removeRDV(event: Event, explicitId?: string): Promise<void> {
    event.stopPropagation();
    if (this.isDeleteDisabled) return;

    const target = event.target as HTMLElement;
    const rdvId = explicitId || target.getAttribute('data-id') || target.id || target.closest('[id]')?.id || '';
    if (!rdvId) return;

    if (!window.confirm('Supprimer ce rendez-vous ?')) return;

    this.isDeleteDisabled = true;
    try {
      await this.rdvService.deleteAndUpdate(rdvId);
      this.rendezVous = this.rendezVous.filter((r) => r.id !== rdvId);
      this._toast.showSucces('SUPPRESSION', 'Rendez-vous supprimé');
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', 'Impossible de supprimer ce rendez-vous');
    } finally {
      setTimeout(() => {
        this.isDeleteDisabled = false;
      }, 1500);
    }
  }

  search(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchTerm = input.value;
    this.searchSubject.next(this.searchTerm);
  }

  toggleOrder(): void {
    this.orderDirection = this.orderDirection === 'desc' ? 'asc' : 'desc';
    this.resetAndLoad();
  }

  loadAppointments(): void {
    if (this.loading || !this.hasMore || this.isSearching) return;

    this.loading = true;
    this.rdvService
      .getAllRDVLazy(this.lastVisibleCursor, this.limit, this.orderDirection)
      .pipe(
        take(1),
        tap((result: any[]) => {
          if (!result || result.length === 0) {
            this.hasMore = false;
            return;
          }
          if (result.length < this.limit) {
            this.hasMore = false;
          }
          // Garde le Timestamp Firestore brut comme curseur de pagination
          const lastItem = result[result.length - 1];
          this.lastVisibleCursor = lastItem.date;

          const unique = result
            .filter((rdv: any) => !this.rendezVous.some((existing) => existing.id === rdv.id))
            .map((rdv: any) => this.normalizeRdv(rdv));

          this.rendezVous = [...this.rendezVous, ...unique];
          this.hydratePhones(unique);
        })
      )
      .subscribe({
        complete: () => {
          this.loading = false;
        },
        error: (err) => {
          console.error('Erreur lors du chargement des rendez-vous:', err);
          this.loading = false;
        }
      });
  }

  @HostListener('window:scroll', [])
  onScroll(): void {
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.body.offsetHeight;
    if (scrollPosition >= pageHeight - 120 && !this.loading && this.hasMore && !this.isSearching) {
      this.loadAppointments();
    }
  }

  private async hydratePhones(items: any[]): Promise<void> {
    const missingUids = Array.from(
      new Set(
        items
          .filter((r) => !r.phone && r.user_id && r.user_id !== 'walk-in' && !this.phoneCache.has(r.user_id))
          .map((r) => String(r.user_id))
      )
    );

    if (missingUids.length > 0) {
      await Promise.all(
        missingUids.map(async (uid) => {
          try {
            const list = await this.usersService.getUser(uid);
            this.phoneCache.set(uid, (list?.[0]?.phone || '').trim());
          } catch {
            this.phoneCache.set(uid, '');
          }
        })
      );
    }

    for (const r of items) {
      if (!r.phone && r.user_id && this.phoneCache.get(r.user_id)) {
        r.phone = this.phoneCache.get(r.user_id);
      }
    }
  }
}
