// src/app/core/interceptors/error.interceptor.ts

import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

/** À mettre sur une requête de fond (ex. vérification de l'API) pour ne pas afficher de message. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  return next(req).pipe(
    catchError((e: HttpErrorResponse) => {
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
