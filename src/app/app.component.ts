import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { AuthenticationService } from './services/authentication.service';
import { PushNotificationsService } from './services/push-notifications.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  isMsgUserPage = false;
  isProfilePage = false;
  isAdminMsgPage = false;

  constructor(
    private router: Router,
    private authService: AuthenticationService,
    private pushService: PushNotificationsService
  ) {}

  ngOnInit(): void {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        const path = event.urlAfterRedirects.split('?')[0];
        this.isMsgUserPage = path === '/user-message';
        this.isProfilePage = path === '/profile';
        this.isAdminMsgPage = path === '/admin/admin-message';
      }
    });

    // Enregistre automatiquement les notifications push sur iOS/Android dès qu'une session est active
    this.authService.authState$.subscribe((user) => {
      if (user?.uid) {
        this.pushService.initForUser(user.uid).catch(() => {});
      }
    });
  }
}
