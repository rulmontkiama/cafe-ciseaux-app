import {  Component,ElementRef,OnDestroy,OnInit, ViewChild} from '@angular/core';
import { types } from 'src/app/models/types';
import {FormBuilder, Validators,FormGroup } from '@angular/forms';
import { monthLong } from 'src/app/interface/month-long';
import { monthNames } from 'src/app/interface/month-names';
import { dayNames } from 'src/app/interface/day-names';
import { AlertService } from 'src/app/services/alert.service';
import { RendezVousService } from 'src/app/services/rendez-vous.service';
import { AuthenticationService } from 'src/app/services/authentication.service';
import { Router } from '@angular/router';
import { ScheduleService } from 'src/app/services/schedule.service';
import { MyHammerConfig } from 'src/app/config/my-hammer-config';
import { animate, AUTO_STYLE, state, style, transition, trigger } from '@angular/animations';
import { UsersService } from 'src/app/services/users.service';
import { Injectable } from '@angular/core';
import { DateTime } from 'luxon';
import { Subscription, firstValueFrom } from 'rxjs';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-rendez-vous',
  templateUrl: './rendez-vous.component.html',
  styleUrls: ['./rendez-vous.component.scss'],
  styles:[ `
    li{
    margin: auto,
    }
  `],
  animations: [
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
export class RendezVousComponent implements OnInit, OnDestroy { 
  types = types
  date = new Date(); 
  collapsed = true
  //références pour suivre le mouvement du doigt
  private xDown: number | null = null;
  private xDownHours: number | null = null;

  @ViewChild('daysScroll') daysScroll!: ElementRef;   // Pour manipuler le scroll des jours
  @ViewChild('hoursScroll') hoursScroll!: ElementRef;

  public rdvForm!: FormGroup;
  public protectedData: any
  constructor(    
    public formBuilder: FormBuilder,
    private _toast:AlertService,
    private rendez_vous:RendezVousService,
    private authService: AuthenticationService,
    private userService: UsersService,
    public router: Router,
    private scheduleService: ScheduleService,
    ) { 
  }
  private hoursSubscription?: Subscription;
  ngOnDestroy(): void {
    // Ferme l'écouteur Firestore des heures prises. (Avant : "throw new Error('Method not implemented.')"
    // cassait la navigation à chaque sortie de la page, y compris juste après une réservation.)
    this.hoursSubscription?.unsubscribe();
  }
  monthName!: string; // NOM DU COURANT MOIS OU SLECTIONNÉ EN MAJUSCULE
  monthNames: any;
  dayNum!: number
  dayNames: any;
  dayName!: string;
  dayChoose!:any;
  currentMonthNum = this.date.getMonth()
  monthNum = this.date.getMonth();//numero du mois à partir de 0 à 11
  monthDays!: number // nombre de jour dans le mois choisi
  monthDaysArray: any // nombre de jour dans le mois choisi
  monthDaysName:any =  [];
  id!:any
  year = this.date.getFullYear();
  currentYear = this.date.getFullYear();
  currentMonth: any; // NOM DU MOIS EN MAJUSCULE
  currentDay:any ; //NUMERO DU JOUR DANS LE MOIS
  currentHours:any; // HEURES AU FORMAT HH:MM
  currentType!:any;
  schedule:any;
  daySchedule:any;
  monthsLong:any 
  submitted:any;

  passedDaysArray:any = []
  closedDaysArray:any = []
  userDetails:any
  scissor!: any;
  avatar!:any;
  available_date!:any;
  containerDays!:any;
  containerHours!:any;
  async ngOnInit() {   
        
    this.userDetails = this.authService.getUserInfos();
    this.avatar = this.userDetails?.avatar;
    this.monthNames = monthNames;
    this.submitted = false;
    this.dayNames = dayNames;
    this.monthName = this.monthNames[this.monthNum];
    this.currentMonth = this.monthName;
    this.monthDays = this.daysInMonth(this.year, this.monthNum);
    this.monthDaysArray = this.numSequence();
    this.dayName = 'lun';
    this.monthsLong = monthLong; 

    this.rdvForm = this.formBuilder.group({    
      month: ['', Validators.required],
      day: ['', Validators.required],
      hours: ['', Validators.required],
      type: ['', Validators.required],
      date: [],
      user_id: []
    });

    this.containerDays = document.querySelector(".days_scroll");

    let xDown:any = null;
    
   /* function handleTouchStart(event:any) {
        xDown = event.touches[0].clientX;
    }*/

    
   /* const handleTouchMove = (event:any) => {
        if (!xDown) {
            return;
        }
    
        let xUp = event.touches[0].clientX;
        let xDiff = xDown - xUp;
    
        if (Math.abs(xDiff) > 0) {
            if (xDiff > 0) {
              // Swipe vers la gauche  
              this.containerDays.scrollLeft += 50; // Unité de défilement plus petite
            } else {
              // Swipe vers la droite
              this.containerDays.scrollLeft -= 50; // Unité de défilement plus petite
            }
        }
    
        xDown = null;
    };*/
    
    this.containerHours = document.querySelector(".hours_scroll");
    this.containerHours.addEventListener('touchmove', (event:any) => {
        handleTouchMoveHours.call(this, event);
    }, false);
    this.containerHours.addEventListener('touchstart', handleTouchStartHours.bind(this), false);

    let hourDown:any = null;

    function handleTouchStartHours(event:any) {
        hourDown = event.touches[0].clientX;
    }

    const handleTouchMoveHours = (event:any) => {
        if (!hourDown) {
            return;
        }

        let xUp = event.touches[0].clientX;
        let xDiff = hourDown - xUp;

        const scrollAmount = 50; // Unité de défilement plus petite

        if (Math.abs(xDiff) > 0) {
            if (xDiff > 0) {
                // Swipe vers le haut       
                this.containerHours.scrollLeft +=  50;
            } else {
                // Swipe vers le bas
                this.containerHours.scrollLeft -= 50;
              
            }
        }

        hourDown = null;
    };

    await this.loadBlockedDays();
    const schedules = await firstValueFrom(this.scheduleService.getSchedule().pipe(take(1)));
    if (schedules) {
      this.schedule = schedules[0];
      this.setDays();
    }
  }
  handleTouchStart(event: TouchEvent, type: 'days' | 'hours') {
    // On enregistre la position X (horizontale) au moment où le doigt touche l'écran
    if (type === 'days') {
      this.xDown = event.touches[0].clientX;
    } else {
      this.xDownHours = event.touches[0].clientX;
    }
  }

    // Calcule le mouvement et déplace le scroll
  handleTouchMove(event: TouchEvent, type: 'days' | 'hours') {
    const xDownRef = type === 'days' ? this.xDown : this.xDownHours;
    if (!xDownRef) return;

    const xUp = event.touches[0].clientX;
    const xDiff = xDownRef - xUp; // Différence entre le départ et l'actuel

    // Sensibilité : on ne bouge que si le mouvement est franc (> 10px)
    if (Math.abs(xDiff) > 10) {
      const container = type === 'days' ? this.daysScroll.nativeElement : this.hoursScroll.nativeElement;
      
      // On applique le défilement
      container.scrollLeft += (xDiff > 0 ? 80 : -80); 

      // On réinitialise pour le prochain segment de mouvement
      if (type === 'days') this.xDown = null;
      else this.xDownHours = null;
    }
  }

  get month() {
    return this.rdvForm.get('month');
  }
  get day() {
    return this.rdvForm.get('day');
  }
  get hours() {
    return this.rdvForm.get('hours');
  }
  get type() {
    return this.rdvForm.get('type');
  }
  get f() {
    return this.rdvForm.controls;
  }
  // Jours bloqués par l'admin (collection blocked_days), sous la forme 'AAAA-M-J' en heure de Paris
  private blockedKeys = new Set<string>();
  private blockKey(year: number, month1to12: number, day: number): string {
    return `${year}-${month1to12}-${day}`;
  }
  async loadBlockedDays() {
    try {
      const blocked: any[] = await firstValueFrom(this.scheduleService.getAllBlocked().pipe(take(1)));
      this.blockedKeys = new Set(
        (blocked || [])
          .filter(b => b?.date?.seconds != null)
          .map(b => {
            const d = DateTime.fromSeconds(b.date.seconds, { zone: 'Europe/Paris' });
            return this.blockKey(d.year, d.month, d.day);
          })
      );
    } catch (error) {
      // Sans cette liste on ne bloque rien, mais la réservation reste possible
      console.error('Impossible de charger les jours bloqués', error);
    }
  }
  /** monthIndex : 0 = janvier, comme this.monthNum */
  isBlockedDay(year: number, monthIndex: number, day: number): boolean {
    return this.blockedKeys.has(this.blockKey(year, monthIndex + 1, day));
  }
  isBlockedDate(date: Date): boolean {
    const d = DateTime.fromJSDate(date, { zone: 'Europe/Paris' });
    return this.blockedKeys.has(this.blockKey(d.year, d.month, d.day));
  }
  getScheduleHours(){
    if (this.schedule) {
      return this.schedule
    }
  }
  changeType(e: any) {
    this.type?.setValue(e.target.value.toLowerCase());
  }
  sending: boolean = false;
  async onSubmit() {
    // 'submitted' sert uniquement à afficher les erreurs de validation pendant 7 s.
    // (Avant, il bloquait aussi tout nouvel envoi pendant 7 s après une 1re tentative invalide.)
    this.submitted = true;
    var that = this;
    setTimeout(function(){
      that.submitted = false;
    },7000);
    if (!this.rdvForm.valid) {
      this._toast.showWarning('INVALIDE','le formulaire est invalide')
      return false;
    }
    if (this.sending) {
      return false; // évite le double envoi
    }
    if (!this.userDetails?.uid) {
      this._toast.showWarning('PAGE PRIVÉE', "vous n'êtes pas connecté");
      this.router.navigate(['login']);
      return false;
    }
    this.sending = true;
    try {
      await this.loadBlockedDays();
      if (this.isBlockedDate(this.constructDate())) {
        this._toast.showWarning('INDISPONIBLE', "ce jour n'est plus disponible, choisissez une autre date");
        this.setCurrentMonth(); // reconstruit le calendrier sans le jour bloqué
        return false;
      }
      this.rdvForm.value.user_id = this.userDetails.uid;
      this.rdvForm.value.date = await this.constructDate()
      this.rdvForm.value.avatar = this.avatar
      this.rdvForm.value.nom = this.userDetails.nom
      this.rdvForm.value.prenom = this.userDetails.prenom
      let rdvLength:any = await this.rendez_vous.getRendezVousDataLength(this.rdvForm.value.user_id)

      this.scissor = await this.rendez_vous.getScissor(this.rdvForm.value.user_id)
      this.scissor = Number(this.scissor[0].scissor)
      if(this.scissor == 5 ){
        this.scissor = 1
      }else{
        this.scissor = this.scissor + 1
      }
      this.rdvForm.value.scissor = this.scissor
      await this.rendez_vous.updateUserScissor(this.rdvForm.value)
      let nextRDV:any = await this.rendez_vous.rdvTransaction(this.rdvForm.value)

      if(nextRDV != null){
        if(nextRDV == 1){
          if(rdvLength >= 5){
            this.scissor = 5
          }else{
            this.scissor = 1
          }
        }else{
          this.scissor = nextRDV
        }
      }
      this.rdvForm.value.scissor = this.scissor
      // On attend vraiment l'écriture avant d'annoncer « validé » (avant : succès affiché même en cas d'échec)
      await this.rendez_vous.addRDV(this.rdvForm.value)
      this.router.navigate(['profile']);
      this._toast.showSucces('CONFIRMATION','Votre rendez-vous à bien été validé')
    } catch (error) {
      console.error(error);
      this._toast.showError('ERREUR', "Le rendez-vous n'a pas pu être enregistré, réessayez");
    } finally {
      this.sending = false;
    }
    return true;
  }
 monthStatus:boolean = true
 setCurrentMonthEvent(event:Event) {
    event.stopPropagation()
    const target = event.target as HTMLTextAreaElement;
    this.monthName = target.id; 
    this.setCurrentMonth()

  }
  setCurrentMonth(){
    this.dayStatus = false
    this.currentDay = ''
    this.currentHours = ''
    //if(this.currentMonth != this.monthName  /*|| this.currentYear != this.year*/ ){   
      this.monthNum = Number(this.monthsLong[this.monthName.toLowerCase()])
      
      this.monthStatus = true
      this.monthDays = this.daysInMonth(this.year,this.monthNum)
      this.monthDaysArray = this.numSequence()    
      this.monthDaysName= []
      this.passedDaysArray = []
      this.closedDaysArray = []
      this.setDays()
    /*}else{
      this.monthStatus = !this.monthStatus
    }*/
  }

  dayStatus:boolean = false
  scheduleArray:any = []
  availableArray:any = []



constructDate() {
  
  const year = this.year
  const month = parseInt(this.rdvForm.value.month, 10) + 1; // 1 = janvier, 12 = décembre
  
  const day = parseInt(this.rdvForm.value.day, 10);
  const [hours, minutes] = this.rdvForm.value.hours.split(':').map(Number);

  // 1. Crée la date en Europe/Paris pour l’heure choisie
  const parisDateTime = DateTime.fromObject(
    { year, month, day, hour: hours, minute: minutes },
    { zone: 'Europe/Paris' }
  );

  // 2. Convertit en UTC pour Firestore
  const futureDateUTC = parisDateTime.toUTC().toJSDate();


  return futureDateUTC;
}
  
  async setCurrentDay(event:Event,i:number) {
    event.stopPropagation()
    console.log('monsta');
    
    this.dayStatus = false
    this.currentHours = ''
    var firstDate = new Date(this.year, this.monthNum, i+1);
    firstDate.setDate( firstDate.getDate() ); 
    // set days names
    
    this.dayNum = firstDate.getDay() 
    const target = event.target as HTMLTextAreaElement;
    this.dayChoose = Number(target.id);
    this.dayName = this.dayNames[this.dayNum]     
    this.schedule = this.getScheduleHours()
    this.daySchedule = this.schedule[this.dayName]
    
    if(this.currentDay != this.dayChoose){ 
      this.currentDay = this.dayChoose
      this.dayStatus = true
    }else{
      this.currentDay = ''
      this.dayStatus = !this.dayStatus
    }
    this.getAvailableHours()

  } 
// Incrémentation de l'année
incrementYear() {
  this.year++;
  this.setCurrentMonth()
}

// Décrémentation de l'année avec une condition
decrementYear() {
  if (this.year > this.currentYear) {
    this.year--;
    this.setCurrentMonth()
  }
}

  setDays(){  
    
    var daySchedule
    this.schedule = this.getScheduleHours()
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

      if(
        (
          this.monthNum > this.currentMonthNum &&  this.year == this.currentYear 
        )
        &&
          (
            daySchedule[0].start1.length == 0 && 
            daySchedule[0].start2.length == 0 && 
            daySchedule[0].end1.length == 0 && 
            daySchedule[0].end2.length == 0
          )  
        ||
        daySchedule[0].isBook == false 
        ){
        this.closedDaysArray.push(false)
      }else{
        // jour ouvert sauf s'il a été bloqué par l'admin
        this.closedDaysArray.push(this.isBlockedDay(this.year, this.monthNum, i) ? false : true)
      }
    }
    
  }
  minStatus: boolean = false;
  daysInMonth (year:number,month:number) {
    //retourne le nombre de jours dans le mois
    month = month +1
    return new Date(year,month, 0).getDate();

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
hourStatus:boolean = false
toggleHour(i:number){
  if(this.availableArray[i] == true){
    this._toast.showWarning('INDISPONIBLE','l\'heure choisie est indisponible')
  }else{
    var newHour = this.scheduleArray[i]
    if(this.currentHours != newHour){
      this.currentHours = newHour
      this.hourStatus = true
    }else{
      this.currentHours = ''
      this.hourStatus = !this.hourStatus
    }
  }
}
hoursSequence(): Array<number> {
  return Array(24);
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
generateTimeIntervals(start:any, end:any) {
  let intervals:any = [];

  if (start && end) {
    let [startHour, startMinute] = start.split(":").map(Number);
    let [endHour, endMinute] = end.split(":").map(Number);

    let currentHour = startHour;
    let currentMinute = startMinute;

    while (currentHour < endHour || (currentHour === endHour && currentMinute <= endMinute)) {
      let formattedTime = `${currentHour.toString().padStart(2, "0")}:${currentMinute.toString().padStart(2, "0")}`;
      intervals.push(formattedTime);

      // Incrementer de 20 minutes
      currentMinute += 20;

      // Gérer le cas où les minutes dépassent 60
      if (currentMinute >= 60) {
        currentHour++;
        currentMinute %= 60;
      }
    }
  }

  return intervals;
}
async getAvailableHours(){


  this.scheduleArray =  []
  this.availableArray = []
  let start1 = this.daySchedule[0].start1;
  let start2 = this.daySchedule[0].start2;
  let end1 = this.daySchedule[0].end1;
  let end2 = this.daySchedule[0].end2; 
  
  if (start1 && end1) {
    this.scheduleArray = this.scheduleArray.concat(this.generateTimeIntervals(start1, end1));
  }
  
  // Générer les intervalles de 20 minutes pour start2 et end2
  if (start2 && end2) {
    this.scheduleArray = this.scheduleArray.concat(this.generateTimeIntervals(start2, end2));
  }

  var current_date: any = '' + this.year + '-' + 
  (this.monthNum + 1 < 10 ? '0' : '') + (this.monthNum + 1) + '-' + 
  (this.dayChoose < 10 ? '0' : '') + this.dayChoose;

  
  // Un seul écouteur à la fois : celui du jour précédent est fermé avant d'ouvrir le nouveau
  // (avant, chaque clic en laissait un ouvert, et les anciens jours écrasaient les heures affichées).
  this.hoursSubscription?.unsubscribe();
  const slots: string[] = this.scheduleArray;
  this.hoursSubscription = this.rendez_vous.available_date(current_date).subscribe(availableDate=> {
    this.available_date = availableDate
    // Heures déjà prises ce jour-là, même fuseau (Europe/Paris) et même format (HH:mm) que les créneaux
    const taken = new Set<string>(
      availableDate.map((rdv:any) =>
        DateTime.fromSeconds(rdv.date.seconds, { zone: 'Europe/Paris' }).toFormat('HH:mm'))
    );
    // Le tableau est reconstruit d'un bloc (pas de push progressif qui s'accumulait à chaque mise à jour)
    this.availableArray = slots.map(hour => taken.has(hour));
  });
  /*
  Notez que nous avons ajouté une variable foundMatch initialisée à false 
  pour indiquer si une égalité a été trouvée. Dans la boucle interne, 
  nous vérifions si foundMatch est false avant de continuer à comparer 
  les autres éléments, et si une égalité est trouvée, 
  nous mettons foundMatch à true, ce qui arrête la boucle interne.
  */  
}
}
