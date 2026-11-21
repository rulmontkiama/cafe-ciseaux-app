import { Component } from '@angular/core';
import { Bar } from '../models/bar.model';
import { cafeCiseauxService } from '../services/cafe-ciseaux.service';
import { BeersService } from '../services/beers.service';
import { Beer } from '../models/beer.model'; 
@Component({
  selector: 'app-beer-selection',
  templateUrl: './beer-selection.component.html',
  styleUrls: ['./beer-selection.component.scss']
})
export class BeerSelectionComponent {
  public allBeers: any // Utilisez le type Beer pour typer allBeers
  constructor(
    private cafeCiseauxService: cafeCiseauxService,
    private beersService: BeersService,   
  ){

  }
  beer!: Bar[];
  
  ngOnInit():void {
    window.scrollTo(0, 0);
    this.beer = this.cafeCiseauxService.getAllBeer();    
    this.fetchBeerSelection();
  }
  fetchBeerSelection(): void {
    this.beersService.getBeers().subscribe(
      (beers: Beer[]) => {
        this.allBeers = beers;
        
      },
      error => {
        console.error('Error fetching beer selection:', error);
      }
    );
  }
}
