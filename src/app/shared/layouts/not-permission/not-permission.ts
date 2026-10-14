import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { SharedModules } from '../../ng-zorro.module';

@Component({
  selector: 'app-not-permission',
  imports: [SharedModules],
  standalone: true,
  templateUrl: './not-permission.html',
  styleUrls: ['./not-permission.scss']
})
export class NotPermission {
  constructor(private router: Router) { }

  backToHome(): void {
    this.router.navigate(['/']);
  }
}