import { Component } from '@angular/core';
import { ScheduleService } from '../services/schedule.service';
import { weekdays } from 'src/app/models/weekdays.model';


@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.component.html',
  styleUrls: ['./schedule.component.scss']
})
export class ScheduleComponent {
  weekdays = weekdays
  scheduleArray!: { [key: string]: any[] | string };
  days!: [string, string | any[]][];
  constructor(
    private scheduleService: ScheduleService
  ) {}
  async ngOnInit() {  
    await this.scheduleService.getSchedule().subscribe(schedule => {
     this.scheduleArray = schedule[0];
     console.log(this.scheduleArray)
     this.days = Object.entries(this.scheduleArray)
  .sort((a, b) => this.weekdays.indexOf(a[0]) - this.weekdays.indexOf(b[0]));


   });
  }
}