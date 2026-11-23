import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  isMsgUserPage = false;
  isProfilePage = false;
  isAdminMsgPage = false;
  constructor(private router: Router) {}
  ngOnInit(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const path = event.urlAfterRedirects.split('?')[0];
        this.isMsgUserPage = path === '/user-message';
        this.isProfilePage = path === '/profile';
        this.isAdminMsgPage = path === '/admin/admin-message';
      }
    });
  }
}



