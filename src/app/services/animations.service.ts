import { trigger, state, style, transition, animate } from '@angular/animations';

export const collapseAnimation = trigger('collapse', [
  state('false', style({         
    height: 'auto',
    visibility: 'visible'
  })),
  state('true', style({     
    visibility: 'hidden',
    height: '0vw'
  })),
  transition('false => true', animate('700ms ease-in')),
  transition('true => false', animate('700ms ease-out'))
]);