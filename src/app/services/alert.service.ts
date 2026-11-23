import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
@Injectable({
  providedIn: 'root'
})
export class AlertService {

  constructor(private toastr:ToastrService) { 
    
  }
  showSucces(title:any,msg:any){
    this.toastr.success(msg,title, { positionClass:'inline', timeOut: 4500 })
  }
  showError(title:any,msg:any){
    this.toastr.error(msg,title, { positionClass:'inline', timeOut: 6000 })
  }
  showWarning(title:any,msg:any){
    this.toastr.warning(msg,title, { positionClass:'inline', timeOut: 6000 })
  }
}
