import { Component, OnDestroy, OnInit} from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { UsersService } from '../services/users.service';
import { MessageService } from '../services/message.service';
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit, OnDestroy {
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
  // Écouteurs Firestore du profil et des messages non lus : fermés à la déconnexion,
  // au changement de compte et à la destruction du composant (avant : ils s'empilaient).
  private authSub?: Subscription;
  private liveSub?: Subscription;
  ngOnInit() {
    this.authSub = this.authService.authState$.subscribe((user:any) => {
      this.liveSub?.unsubscribe();
      this.isUserLoggedIn = !!user;
      if (!user) {
        this.msgCount = 0;
        this.scissor = 0;
        return;
      }
      this.liveSub = new Subscription();
      this.liveSub.add(this.user_service.userObserve(user.uid).subscribe((users) => {
        const profile = users && users[users.length - 1];
        if (profile) {
          this.avatar = profile.avatar;
          this.scissor = profile.scissor;
          this.uid = profile.uid;
          this.nom = profile.nom;
          this.prenom = profile.prenom;
        }
      }));
      this.liveSub.add(this.msgService.getUnreadMessageCount(user.uid).subscribe((msgCount) => {
        this.msgCount = msgCount;
      }));
    });
  }
  ngOnDestroy() {
    this.authSub?.unsubscribe();
    this.liveSub?.unsubscribe();
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
