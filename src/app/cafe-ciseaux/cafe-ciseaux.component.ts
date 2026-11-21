import { Component,OnInit,Input} from '@angular/core';
import {cafeCiseau} from '../models/cafe-ciseaux.model';
import { cafeCiseauxService } from '../services/cafe-ciseaux.service';
import { Router } from '@angular/router';
@Component({
  selector: 'app-cafe-ciseaux',
  templateUrl: './cafe-ciseaux.component.html',
  styleUrls: ['./cafe-ciseaux.component.scss']
})
export class CafeCiseauxComponent implements OnInit {
  @Input() cafeCiseau! : cafeCiseau  
  buttonText!: string;
  constructor(
  ){}
  ngOnInit(){
    
  }
}

