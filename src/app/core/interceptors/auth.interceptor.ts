import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { JwtUtils } from '../../shared/utils';
import { TokenService } from '../services/token.service';

export const AuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('X-Bypass-Auth')) {
    const newHeaders = req.headers.delete('X-Bypass-Auth');
    const cleanReq = req.clone({ headers: newHeaders });
    return next(cleanReq);
  }

  const authToken = inject(TokenService).getAccessToken();

  if (!JwtUtils.isUsable(authToken)) {
    return next(req);
  }

  const authReq = req.clone({
    setHeaders: {
      Authorization: `Bearer ${authToken}`,
    },
  });

  return next(authReq);
};
