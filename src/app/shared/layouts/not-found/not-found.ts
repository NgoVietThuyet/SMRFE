import { Component  } from '@angular/core';
import { Router } from '@angular/router';

import { SharedModules } from '../../ng-zorro.module';

@Component({
  selector: 'app-not-found',
  imports: [SharedModules],
  standalone: true,
  templateUrl: './not-found.html',
  styleUrl: './not-found.scss'
})
export class NotFound {
  constructor(private router: Router) { }

  backToHome(): void {
    this.router.navigate(['/']);
  }
}
