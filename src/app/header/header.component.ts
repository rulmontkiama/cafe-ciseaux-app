import { Component, OnInit} from '@angular/core';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { UsersService } from '../services/users.service';
import { MessageService } from '../services/message.service';
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  isUserLoggedIn: boolean = false
  isFixedNavbar:boolean = false;
  public avatar!:string;
  public scissor!:number;
  public messages!:string;
  public msgCount!:number;
  public notifCount!:number;
  public nom!:string;
  public prenom!:string;
  private uid!:string;
  private userData!:any
  avatarBool= false
  constructor(
    private authService: AuthenticationService,
    private user_service:UsersService,
    private msgService:MessageService
    
    ) { 
      this.notifCount = 0
      this.msgCount = 0
      this.scissor = 0
  }
  ngOnInit() {
    this.authService.authState$.subscribe(async (user:any) => {
      this.isUserLoggedIn = !!user;
      if (this.isUserLoggedIn) {
        const uid = user.uid;
        this.user_service.userObserve(uid).subscribe((users) => {
          this.userData = users;
          for (const k in this.userData) {
            this.avatar = this.userData[k].avatar;
            this.scissor = this.userData[k].scissor;
            this.uid = this.userData[k].uid;
            this.nom = this.userData[k].nom;
            this.prenom = this.userData[k].prenom;
          }
        });
        await this.msgService
          .getUnreadMessageCount(uid)
          .subscribe((msgCount) => {
            this.msgCount = msgCount;
          });
      }
    });
  }
  isAdmin() {
    const adminId = this.authService.getAdminId();
    
    // Vérifier si adminId est défini et est un tableau
    if (Array.isArray(adminId) && adminId.length > 0) {
      let foundMatch = false; // Variable pour suivre si une correspondance est trouvée
      
      // Supposons que adminId contient un objet avec une propriété 'admin_id'
      // Vous pouvez vérifier chaque élément du tableau pour correspondre à this.uid
      for (const id of adminId) {
        
        if (id == this.uid) {
          foundMatch = true; // Définir foundMatch à true si une correspondance est trouvée
          break; // Sortir de la boucle dès qu'une correspondance est trouvée
        }
       
      }
  
      // Renvoyer false si aucune correspondance n'a été trouvée
      return foundMatch;
    }
  
  
  }
  
  
}
