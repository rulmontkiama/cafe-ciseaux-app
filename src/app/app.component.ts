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
        this.isMsgUserPage = event.urlAfterRedirects === '/user-message';
        this.isProfilePage = event.urlAfterRedirects === '/profile';
        this.isAdminMsgPage = event.urlAfterRedirects === '/admin/admin-message';
      }
    });
  }
}



