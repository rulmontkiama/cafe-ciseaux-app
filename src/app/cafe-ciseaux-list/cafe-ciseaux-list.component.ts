import { Component, OnInit } from '@angular/core';
import {cafeCiseau} from '../models/cafe-ciseaux.model';
import { cafeCiseauxService } from '../services/cafe-ciseaux.service';
@Component({
  selector: 'app-cafe-ciseaux-list',
  templateUrl: './cafe-ciseaux-list.component.html',
  styleUrls: ['./cafe-ciseaux-list.component.scss']
})
export class CafeCiseauComponentList implements OnInit{
  constructor(private cafeCiseauxService: cafeCiseauxService) { }
  cafeCiseaux!: cafeCiseau[];
  ngOnInit():void {
    this.cafeCiseaux = this.cafeCiseauxService.getAllBlocs();
  }
}