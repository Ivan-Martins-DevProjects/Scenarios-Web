import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Anexa o token JWT em todas as requisições para a API e
 * encerra a sessão automaticamente ao receber 401.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  const isApiRequest = req.url.startsWith(environment.apiUrl) || req.url.startsWith('/api');
  const isLoginRequest = req.url.includes('/auth/login');

  if (token && isApiRequest) {
    req = req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && isApiRequest && !isLoginRequest) {
        auth.logout();
      }
      return throwError(() => error);
    }),
  );
};
