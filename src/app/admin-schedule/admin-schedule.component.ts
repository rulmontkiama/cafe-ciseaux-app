import { Component } from '@angular/core';
import { animate, AUTO_STYLE, state, style, transition, trigger } from '@angular/animations';
import { monthLong } from 'src/app/interface/month-long';
import { monthNames } from 'src/app/interface/month-names';
import { dayNames } from 'src/app/interface/day-names';
import { ScheduleService } from '../services/schedule.service';
import { MyHammerConfig } from 'src/app/config/my-hammer-config';
import { weekdays } from 'src/app/models/weekdays.model';
import { AlertService } from '../services/alert.service';
@Component({
  selector: 'app-admin-schedule',
  templateUrl: './admin-schedule.component.html',
  styleUrls: ['./admin-schedule.component.scss'],  animations: [
    trigger('collapse', [
      state('false', style({         
        height:AUTO_STYLE,
        visibility: AUTO_STYLE
      })),
      state('true', style({     
        visibility: 'hidden' ,
        height: '0vw',
      })),
      transition('false => true', animate('700ms ease-in')),
      transition('true => false', animate('700ms ease-out'))
    ])
  ],
  providers: [MyHammerConfig]  
})
export class AdminScheduleComponent {
  public blockDays: any;
  weekdays = weekdays
  daysWithIsBook: any;
  constructor(
    private scheduleService: ScheduleService,
    private _toast:AlertService,
  ){}
  date = new Date(); 
  collapsed = true
  monthName!: string; // NOM DU COURANT MOIS OU SLECTIONNÉ EN MAJUSCULE
  monthNames: any;
  dayNum!: number
  dayNames: any;
  dayName!: string;
  dayChoose!:any;
  currentMonth: any; // NOM DU MOIS EN MAJUSCULE
  currentDay:any ; //NUMERO DU JOUR DANS LE MOIS
  currentHours:any; // HEURES AU FORMAT HH:MM
  schedule: any;
  scheduleKeys: string[] = [];
  daySchedule:any;
  monthNum = this.date.getMonth();//numero du mois à partir de 0 à 11
  monthDays!: number // nombre de jour dans le mois choisi
  monthDaysArray: any // nombre de jour dans le mois choisi
  monthDaysName:any =  [];
  passedDaysArray:any = []
  closedDaysArray:any = []
  blockedDaysArray:any = []
  year = this.date.getFullYear();
  monthsLong:any 
  async ngOnInit() { 
    await this.scheduleService.getAllBlocked().subscribe(blockDays=> {
      this.blockDays = blockDays
      for (const k in this.blockDays) {          
        this.blockDays[k].date = new Date (this.blockDays[k].date.seconds * 1000) 
        let blockYear = this.blockDays[k].date.getFullYear()
        let blockMonth= this.blockDays[k].date.getMonth()+1
        let blockDay= this.blockDays[k].date.getDate()
        this.blockDays[k].dateFull = blockYear+' - '+blockMonth+' - '+blockDay
        this.blockDays[k].id = blockYear+'_'+blockMonth+'_'+blockDay 
      }     
   });
    this.monthNames = monthNames
    this.dayNames = dayNames
    this.monthName = this.monthNames[this.monthNum]
    this.monthDays = this.daysInMonth(this.year,this.monthNum)
    console.log(this.monthDays)
    this.monthDaysArray = this.numSequence()
    console.log(this.monthDaysArray)
    this.monthsLong= monthLong;
    const container_days:any = document.querySelector(".days_scroll");
    const hammer1 = new Hammer(container_days, {
      touchAction: 'pan-y',
      domEvents: true,
    });
    hammer1.get('swipe').set({ direction: Hammer.DIRECTION_HORIZONTAL });
    hammer1.on('swipe', (event: any) => {
      if (event.direction === Hammer.DIRECTION_LEFT) {
        // Scroller vers la gauche
        container_days.scrollBy({
          left: 200,
          behavior: 'smooth'
        });
      } else if (event.direction === Hammer.DIRECTION_RIGHT) {
        // Scroller vers la droite
        container_days.scrollBy({
          left: -200,
          behavior: 'smooth'
        });
      }
    });
    this.dayName = 'lun'
    this.scheduleService.getSchedule().subscribe((schedule) => {
      this.schedule = schedule[0];
      
      this.scheduleKeys = Object.keys(this.schedule).sort((a, b) => {
        return this.weekdays.indexOf(a) - this.weekdays.indexOf(b);
      });

      // Parcourir chaque clé pour extraire le nom du jour et isBook correspondant
      this.daysWithIsBook = this.scheduleKeys.map((day) => ({
        dayName: day,
        isBook: this.schedule[day][0]?.isBook, // Récupérer isBook correspondant au jour
        reservationStatus: this.getReservationStatus(this.schedule[day][0]?.isBook,), // Déterminer le texte de réservation en fonction de isBook
        reservationClass: this.schedule[day][0]?.isBook ? 'reserved' : 'not-reserved' // Définir la classe CSS en fonction de isBook
      }));
      this.setDays()
    });
  }
  setReservationDay(day: any) {
    // Supposons que 'day' soit l'objet représentant le jour sur lequel vous avez cliqué
    day.isBook = !day.isBook; // Inverser la valeur de isBook (true devient false et vice versa)  
    // Recalculer la classe de réservation en fonction de la nouvelle valeur de isBook
    day.reservationClass = day.isBook ? 'reserved' : 'not-reserved';
    day.reservationStatus = this.getReservationStatus(day.isBook )
    this.scheduleService.updateReservationDay(day.dayName,'isBook',day.isBook)   
  }
  // Méthode pour déterminer le texte de réservation en fonction de isBook
  getReservationStatus(isBook: boolean): string {
    
    return isBook ? 'Réservé' : 'Non réservé';
  }
  monthStatus:boolean = true
  setCurrentMonth(event:Event) {
    event.stopPropagation()
    const target = event.target as HTMLTextAreaElement;
    this.monthName = target.id; 
    this.currentDay = ''
    this.currentHours = ''
    if(this.currentMonth != this.monthName){
      this.currentMonth = this.monthName
      this.monthNum = Number(this.monthsLong[this.monthName.toLowerCase()])
      this.monthStatus = true
      this.monthDays = this.daysInMonth(this.year,this.monthNum)
      this.monthDaysArray = this.numSequence()    
      console.log(this.monthDaysArray)
      this.monthDaysName= []
      this.passedDaysArray = []
      this.closedDaysArray = []
      this.blockedDaysArray = []
      this.setDays()
    }else{
      this.monthStatus = !this.monthStatus
    }
  }
  dayStatus:boolean = false
  async setCurrentDay(event:Event,i:number) {
    event.stopPropagation()
    this.currentHours = ''
    var firstDate = new Date(this.year, this.monthNum, i+1);
    firstDate.setDate( firstDate.getDate() ); 
    // set days names
    this.dayNum = firstDate.getDay() 
    const target = event.target as HTMLTextAreaElement;
    this.dayChoose = Number(target.id);
    this.dayName = this.dayNames[this.dayNum]     
      this.daySchedule = this.schedule[this.dayName]
      if(this.currentDay != this.dayChoose){ 
        this.currentDay = this.dayChoose
        this.dayStatus = true
        this.scheduleService.addBlockDay(firstDate)
      }else{
        this.scheduleService.removeBlockDay(firstDate)
        this.currentDay = ''
        this.dayStatus = !this.dayStatus
      }
  } 
  close_block_day(id: any){
    id = id.replace('remove_block_day','')
    id = id.split('_')
    var removeDate = new Date(id[0], id[1] - 1, id[2]);
    this.scheduleService.removeBlockDay(removeDate)
  }
  daysInMonth (year:number,month:number) {
    //retourne le nombre de jours dans le mois
    month = month +1
    return new Date(year,month, 0).getDate();

  }
  hoursSequence(): Array<number> {
    return Array(24);
  }
  getScheduleHours(){
    if (this.schedule) {
      return this.schedule
    }
  }

  setDays(){  
    var daySchedule
    for (let i = 1; i <= this.monthDaysArray.length; i++) {
      var firstDate = new Date(this.year, this.monthNum, i);
      firstDate.setDate( firstDate.getDate() ); 
      this.date.setHours(0, 0,0);
      firstDate.setHours(23,59,0)
      // set days names
      this.dayNum = firstDate.getDay()    
      this.dayName = this.dayNames[this.dayNum];
      // heure d'ouverture de chaque jour du mois       
      daySchedule = this.schedule[this.dayName]
      this.monthDaysName.push(this.dayName.slice(0, 3));
      // set passed days
      if(firstDate < this.date){
        this.passedDaysArray.push(true)
      }else{
        this.passedDaysArray.push(false)
      } 
      /*set closed days*/ 
      if(daySchedule[0].start1.length == 0 && 
        daySchedule[0].start2.length == 0 && 
        daySchedule[0].end1.length == 0 && 
        daySchedule[0].end2.length == 0 
        ){
        this.closedDaysArray.push(false)
      }else{
        this.closedDaysArray.push(true)
      }
      /*set blocked day*/
      let found = false;
      for (let i = 0; i < this.blockDays.length; i++) {
        this.blockDays[i].date.setHours(23,59,0)        
        if (this.blockDays[i].date.getTime() === firstDate.getTime()) {
          found = true;
          break;
        }
      }     

    }
  }
  
  /*
num sequence : set number in month into à array [1,2,3,...]
*/
numSequence() {
  let arr = [];
  for (let i = 1; i <= this.monthDays; i++) {
    arr.push(i);
  }
  return arr;
}
  toggle() {
    this.collapsed = !this.collapsed; 
  }
  expand() {
    this.collapsed = false;
  }
  collapse() {
    this.collapsed = true;
  }
  /*set horaires*/
  toggleLock(id:any) {  
    var hoursInput = document.getElementById('hours_'+id) as HTMLInputElement;
    var minutesInput = document.getElementById('minutes_'+id) as HTMLInputElement;
    const blockedImg = document.getElementById('block_img_'+id) as HTMLImageElement;
    const hours = hoursInput.value;
    const minutes = minutesInput.value; 
    if (hours === "" && minutes === "") {
      hoursInput.value = '00';
      minutesInput.value = '00';
      hoursInput.disabled = false
      minutesInput.disabled = false
      hoursInput.style.border = "1px solid rgba(255, 255, 255, 1)";
      minutesInput.style.border = "1px solid rgba(255, 255, 255, 1)";
      blockedImg.src = 'assets/BLOCKED.svg';
    }else{
      hoursInput.value = "";
      minutesInput.value = "";
      hoursInput.disabled = true
      minutesInput.disabled = true
      hoursInput.style.border = "1px solid rgba(255, 255, 255, 0.4)";
      minutesInput.style.border = "1px solid rgba(255, 255, 255, 0.4)";
      blockedImg.src = 'assets/BLOCKED_RED.svg';
    }
    this.setSchedule(id);
  }
  setSchedule(id:any){
    const day = id.split("_")[2]
    
    const key = id.split("_")[1]
    var setValue
    var hoursInput = document.getElementById('hours_'+id) as HTMLInputElement;
    var minutesInput = document.getElementById('minutes_'+id) as HTMLInputElement;
    const hours = hoursInput.value;
    const minutes = minutesInput.value;
    if (hours === "" && minutes === "") {
      setValue = ""
    }else{
      setValue = ''+hoursInput.value+':'+minutesInput.value+''
      const regex = /^(0?[0-9]|[1-5][0-9]|59)$/;
      if (!regex.test(hours)) {
        hoursInput.value = '00';
        this._toast.showWarning('INVALIDE','les heures du '+day+' sont invalides')
        return false;
      }
      if (!regex.test(minutes)) {
        this._toast.showWarning('INVALIDE','les minutes du '+day+' sont invalides')
        minutesInput.value = '00';
        return false;
      }
    }
    this._toast.showSucces('CONFIRMATION','Les horaires du '+day+' ont bien été validés')
    this.scheduleService.updateSchedule(day,key,setValue)    
  }
}
