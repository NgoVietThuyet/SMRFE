import {Directive, Input, ElementRef, OnChanges, SimpleChanges} from '@angular/core';

@Directive({
  selector: '[appAutofocus]',
  standalone: true,
})
export class AutofocusDirective implements OnChanges {
  @Input() appAutofocus: boolean = false;

  constructor(private el: ElementRef) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.appAutofocus) {
      setTimeout(() => {
        this.el.nativeElement.focus();
      }, 100);
    }
  }
}
