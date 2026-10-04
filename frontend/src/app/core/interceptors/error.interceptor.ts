// src/app/core/interceptors/error.interceptor.ts

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';

import { SILENT_ERRORS } from './silent-errors';

export { SILENT_ERRORS } from './silent-errors';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  const auth = inject(AuthService);
  return next(req).pipe(
    catchError((e: HttpErrorResponse) => {
      // Jeton expiré ou révoqué pendant la navigation : retour à la connexion avec un message clair
      if (e.status === 401 && req.url.startsWith('/api/') && !req.url.startsWith('/api/auth/')) {
        auth.logout('expired');
        return throwError(() => e);
      }
      if (!req.context.get(SILENT_ERRORS)) {
        // le backend renvoie un ProblemDetail : { detail: "..." }
        const msg =
          e.status === 0 || e.status === 504
            ? 'Le serveur ne répond pas. Vérifiez que le backend est démarré.'
            : e.error?.detail ?? `Erreur ${e.status}`;
        snack.open(msg, 'Fermer', { duration: 6000 });
      }
      return throwError(() => e);
    })
  );
};
