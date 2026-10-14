import { HttpInterceptorFn } from '@angular/common/http';

/** Custom header required by API CSRF middleware for cookie-auth endpoints. */
export const API_CSRF_HEADER = 'X-Requested-With';
export const API_CSRF_VALUE = 'XMLHttpRequest';

/** Attach CSRF-safe header on API calls (blocks cross-site form POST). */
export const ApiRequestInterceptor: HttpInterceptorFn = (req, next) => {
  const url = req.url.toLowerCase();
  const isApiCall = url.includes('/api/');

  if (!isApiCall) {
    return next(req);
  }

  if (req.headers.has(API_CSRF_HEADER)) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: { [API_CSRF_HEADER]: API_CSRF_VALUE },
    }),
  );
};
