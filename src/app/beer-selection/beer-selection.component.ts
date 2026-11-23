import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { Bar } from '../models/bar.model';
import { cafeCiseauxService } from '../services/cafe-ciseaux.service';
import { BeersService } from '../services/beers.service';
import { Beer } from '../models/beer.model';

@Component({
  selector: 'app-beer-selection',
  templateUrl: './beer-selection.component.html',
  styleUrls: ['./beer-selection.component.scss']
})
export class BeerSelectionComponent implements OnInit, OnDestroy {
  public allBeers: any[] = [];
  public isLoading = true;
  beer!: Bar[];

  private beersSub?: Subscription;

  constructor(
    private cafeCiseauxService: cafeCiseauxService,
    private beersService: BeersService
  ) {}

  ngOnInit(): void {
    window.scrollTo(0, 0);
    this.beer = this.cafeCiseauxService.getAllBeer();
    this.fetchBeerSelection();
  }

  ngOnDestroy(): void {
    this.beersSub?.unsubscribe();
  }

  fetchBeerSelection(): void {
    this.beersSub = this.beersService.getBeers().subscribe({
      next: (beers: Beer[]) => {
        this.allBeers = beers || [];
        this.isLoading = false;
      },
      error: (error) => {
        console.error('Error fetching beer selection:', error);
        this.isLoading = false;
      }
    });
  }
}
