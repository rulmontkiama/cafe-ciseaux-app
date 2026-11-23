import { Component, HostListener, Input } from '@angular/core';
import { cafeCiseauxService } from '../services/cafe-ciseaux.service';
import { AuthenticationService } from '../services/authentication.service';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent {
  @Input() hideMovingPart = false;
  public scheduleBool = false;
  public contactDetails: any;
  public uid: any;
  public userDetails: any;

  constructor(
    private cafeCiseauxService: cafeCiseauxService,
    private authService: AuthenticationService
  ) {}

  ngOnInit(): void {
    this.contactDetails = this.cafeCiseauxService.getContactDetails();
    this.contactDetails[0].nameComplete = this.contactDetails[0].name + '  ' + this.contactDetails[0].surname;
    this.contactDetails[0].adressComplete = this.contactDetails[0].street + '  ' + this.contactDetails[0].city + ' ' + this.contactDetails[0].zip_code;
    // getUserInfos() est null tant que personne n'est connecté
    this.uid = this.authService.getUserInfos()?.uid ?? null;
  }

  get phoneHref(): string {
    const raw = (this.contactDetails?.[0]?.phone_n || '').replace(/\s+/g, '');
    if (!raw) return 'tel:+32497991226';
    return raw.startsWith('0') ? `tel:+32${raw.slice(1)}` : `tel:${raw}`;
  }

  viewSchedule(): void {
    this.scheduleBool = !this.scheduleBool;
  }

  closeSchedule(): void {
    this.scheduleBool = false;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.scheduleBool) {
      this.scheduleBool = false;
    }
  }
}
