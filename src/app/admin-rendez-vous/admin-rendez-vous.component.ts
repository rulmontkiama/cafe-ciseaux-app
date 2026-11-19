import { Component } from '@angular/core';
import { RendezVousService } from '../services/rendez-vous.service';
import { DateService } from '../services/date.service';
@Component({
  selector: 'app-admin-rendez-vous',
  templateUrl: './admin-rendez-vous.component.html',
  styleUrls: ['./admin-rendez-vous.component.scss']
})
export class AdminRendezVousComponent {
  public RDVData: any;
  constructor(
    private rendez_vous:RendezVousService,
    private dateService:DateService,
  ){}
  async ngOnInit(){ 

  }  
  removeRDV(event:Event){
    event.stopPropagation();
    const target = event.target as HTMLTextAreaElement;
    var RDV_id= target.id;
    this.rendez_vous.deleteAndUpdate(RDV_id)
  }
}
