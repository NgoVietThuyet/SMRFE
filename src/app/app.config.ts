import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, RouteReuseStrategy, withComponentInputBinding } from '@angular/router';
import { registerLocaleData } from '@angular/common';
import vi from '@angular/common/locales/vi';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { vi_VN, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import { firstValueFrom, of, switchMap } from 'rxjs';
import { routes } from './app.routes';
import { ApiRequestInterceptor, AuthInterceptor } from './core/interceptors';
import { APP_ICONS, ReuseStrategyConfig } from './core/config';
import { SessionService, TokenService } from './core/services';

registerLocaleData(vi);

/** F5: khôi phục access token bằng refresh token rồi nạp lại hồ sơ + quyền trước khi router chạy. */
function initAuthSession(): Promise<unknown> {
  const tokenService = inject(TokenService);
  const session = inject(SessionService);
  return firstValueFrom(
    tokenService.ensureSession().pipe(switchMap(ok => (ok ? session.load() : of(false)))),
  ).catch(() => false);
}

export const appConfig: ApplicationConfig = {
  providers: [
    { provide: RouteReuseStrategy, useClass: ReuseStrategyConfig },
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideNzI18n(vi_VN),
    provideNzIcons(APP_ICONS),
    provideAnimationsAsync(),
    provideHttpClient(withInterceptors([ApiRequestInterceptor, AuthInterceptor])),
    NzModalService,
    provideAppInitializer(initAuthSession),
  ]
};
