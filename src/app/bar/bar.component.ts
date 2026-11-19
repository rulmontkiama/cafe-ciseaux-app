import { Component, OnInit } from '@angular/core';
import { cafeCiseauxService } from '../services/cafe-ciseaux.service';
@Component({
  selector: 'app-bar',
  templateUrl: './bar.component.html',
  styleUrls: ['./bar.component.scss']
})
export class BarComponent implements OnInit{
  public barDetails:any;
  constructor(
    private cafeCiseauxService: cafeCiseauxService
  ){}
  ngOnInit() {
    window.scrollTo(0, 0);
    this.barDetails = this.cafeCiseauxService.getBarDetails();
  }

}
