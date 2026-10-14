import { Directive, ElementRef, Input, OnChanges, OnInit, Renderer2, SimpleChanges } from '@angular/core';
import { GlobalService } from '../../core/services';

@Directive({
  selector: '[appPermission]',
  standalone: true,
})
export class PermissionDirective implements OnInit, OnChanges {
  @Input('appPermission') permission: string | string[] = '';
  permissions: string[] = [];

  constructor(private elementRef: ElementRef, private renderer: Renderer2, private globalService: GlobalService) {

  }

  ngOnInit(): void {
    this.updatePermissions();
    this.applyVisibility();
  }

  ngOnChanges(_: SimpleChanges): void {
    this.updatePermissions();
    this.applyVisibility();
  }

  private updatePermissions(): void {
    this.permissions = this.globalService.getRightsUser();
  }

  private applyVisibility(): void {
    if (!this.hasPermission()) {
      this.renderer.setStyle(this.elementRef.nativeElement, 'display', 'none');
      return;
    }

    this.renderer.removeStyle(this.elementRef.nativeElement, 'display');
  }

  private hasPermission(): boolean {
    const requiredPermissions = Array.isArray(this.permission)
      ? this.permission.filter(Boolean)
      : [this.permission].filter(Boolean);

    if (requiredPermissions.length === 0) {
      return true;
    }

    if (!this.permissions || this.permissions.length === 0) {
      return false;
    }

    return requiredPermissions.some(permission => this.permissions.includes(permission));
  }
}
