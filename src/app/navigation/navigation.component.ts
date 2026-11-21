import { Component, OnInit,Directive, HostBinding, HostListener } from '@angular/core';
import { cafeCiseauxService } from '../services/cafe-ciseaux.service';
import {
  trigger,
  state,
  style,
  animate,
  transition,
  AUTO_STYLE
} from '@angular/animations';
@Component({
  selector: 'app-navigation',
  templateUrl: './navigation.component.html',
  styleUrls: ['./navigation.component.scss'],
  animations: [
    trigger('collapse', [
      state('false', style({ 
        height: '-webkit-fill-available', 
        width:'100vw',
        visibility: AUTO_STYLE
      })),
      state('true', style({     
        visibility: 'hidden' ,
        height: '-webkit-fill-available',
      })),
      transition('false => true', animate('300ms ease-in')),
      transition('true => false', animate('300ms ease-out'))
    ])
  ]
 
})
export class NavigationComponent implements OnInit {  
  collapsed = true
  public scheduleBool= false
  public contactDetails: any;
  constructor(private cafeCiseauxService: cafeCiseauxService){}
  ngOnInit(): void {
    this.contactDetails = this.cafeCiseauxService.getContactDetails();
  }
  toggle() {
    this.collapsed = !this.collapsed;
   
  }
  expand() {
    this.collapsed = false;
  }
  collapse() {
    this.collapsed = true;

  }
 

}
