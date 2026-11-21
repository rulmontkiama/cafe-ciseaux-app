import { Component, OnInit } from '@angular/core';
import{Router, ActivatedRoute, NavigationEnd} from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-landing-page',
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss']
})
export class LandingPageComponent implements OnInit {
  
  showHeader = true;
  constructor(private router: Router, private activatedRoute: ActivatedRoute) {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd)
  ).subscribe(() => {
    (    e: { url: string; }) => this.modifyHeader(e);
  });
  }
  ngOnInit(): void {
  }
  onContinue() : void{
    this.router.navigateByUrl('cafeCiseaux');    
  }
  modifyHeader(location: { url: string; }) { // This method is called many times
    if (location.url === '/') {
        this.showHeader = false;
    } else {
        this.showHeader = true;
    }
}

}
