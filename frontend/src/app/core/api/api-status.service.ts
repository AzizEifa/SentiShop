import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap, timer } from 'rxjs';
import { SILENT_ERRORS } from '../interceptors/silent-errors';

export type ApiStatus = 'checking' | 'online' | 'offline';

/** Vérifie toutes les 20 s que le backend répond (indicateur dans la barre latérale). */
@Injectable({ providedIn: 'root' })
export class ApiStatusService {
  private readonly http = inject(HttpClient);

  readonly status = toSignal(
    timer(0, 20_000).pipe(
      switchMap(() =>
        this.http.get('/actuator/health', { context: new HttpContext().set(SILENT_ERRORS, true) }).pipe(
          map((): ApiStatus => 'online'),
          catchError(() => of<ApiStatus>('offline'))
        )
      ),
      startWith<ApiStatus>('checking')
    ),
    { initialValue: 'checking' as ApiStatus }
  );
}
