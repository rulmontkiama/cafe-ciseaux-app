import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CalendarViewComponent } from '../calendar-view/calendar-view.component';

/** Composants utilisés à la fois par la partie client (profil) et par l'administration. */
@NgModule({
  declarations: [CalendarViewComponent],
  imports: [CommonModule],
  exports: [CalendarViewComponent],
})
export class SharedModule {}
