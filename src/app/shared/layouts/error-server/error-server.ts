import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { SharedModules } from '../../ng-zorro.module';

@Component({
  selector: 'app-error-server',
  imports: [SharedModules],
  standalone: true,
  templateUrl: './error-server.html',
  styleUrl: './error-server.scss'
})
export class ErrorServer {
  constructor(private router: Router) { }

  backToHome(): void {
    this.router.navigate(['/']);
  }
}
