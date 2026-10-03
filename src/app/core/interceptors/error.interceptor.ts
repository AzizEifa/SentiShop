// src/app/core/interceptors/error.interceptor.ts

import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  return next(req).pipe(
    catchError((e: HttpErrorResponse) => {
      // le backend renvoie un ProblemDetail : { detail: "..." }
      const msg =
        e.status === 0
          ? 'Serveur injoignable'
          : e.error?.detail ?? `Erreur ${e.status}`;
      snack.open(msg, 'OK', { duration: 6000 });
      return throwError(() => e);
    })
  );
};