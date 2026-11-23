import { Component, OnInit } from '@angular/core';
import { AuthenticationService } from '../services/authentication.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  public nom = '';
  public prenom = '';
  public avatar = 'assets/AVATAR.svg';

  constructor(private authService: AuthenticationService) {}

  ngOnInit(): void {
    const userInfos: any = this.authService.getUserInfos();
    if (!userInfos) return;
    this.nom = userInfos.nom || '';
    this.prenom = userInfos.prenom || '';
    this.avatar = userInfos.avatar || 'assets/AVATAR.svg';
  }
}
