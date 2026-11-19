import { Component, ViewEncapsulation} from '@angular/core';
@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss'],
  encapsulation: ViewEncapsulation.Emulated
})
export class AdminComponent  {
  public avatarBool= false
  public uploadBool!: boolean
  constructor(
  ) { 

  }
  uploadChangedHandler(upload: any) {
    this.avatarBool= false; 
    this.uploadBool = upload;    
  }
}
