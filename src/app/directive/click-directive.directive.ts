import { Directive, HostListener ,ViewChild} from '@angular/core';

@Directive({
  selector: '[appClickDirective]'
})
export class ClickDirectiveDirective {

    constructor() {
    }
    ngOnInit() {}
    @ViewChild("insideElement") insideElement:any;
    @HostListener('document:click', ['$event.target'])
  
    public onClick(targetElement:any) {
      console.log(targetElement)
      const clickedInside = this.insideElement.nativeElement.contains(targetElement);
      if (!clickedInside) {
        console.log('outside clicked');
      }
    }
   
  

}
