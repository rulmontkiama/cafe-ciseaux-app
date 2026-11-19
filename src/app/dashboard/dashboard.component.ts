import { Component } from '@angular/core';
import { AuthenticationService } from '../services/authentication.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent {
  public nom!:string;
  public prenom!:string;
  public avatar!: string;
 constructor(
  private authService:AuthenticationService,
 ){}
 async ngOnInit(){
  var userInfos:any = this.authService.getUserInfos()
  console.log(userInfos);
  
  this.nom = userInfos.nom
  this.prenom = userInfos.prenom 
  this.avatar = userInfos.avatar 
 }
}
