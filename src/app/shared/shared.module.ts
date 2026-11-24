import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CalendarViewComponent } from '../calendar-view/calendar-view.component';

/** Composants utilisés à la fois par la partie client (profil) et par l'administration. */
@NgModule({
  declarations: [CalendarViewComponent],
  imports: [CommonModule, RouterModule],
  exports: [CalendarViewComponent],
})
export class SharedModule {}
