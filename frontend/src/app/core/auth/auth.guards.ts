import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/models';
import { AuthService } from './auth.service';

/** Réservé à un rôle : non connecté → /login (avec retour prévu), mauvais rôle → son propre espace. */
export const roleGuard = (role: Role): CanActivateFn => (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const user = auth.user();
  if (!user || !auth.token()) {
    return router.createUrlTree(['/login'], { queryParams: state.url && state.url !== '/' ? { redirect: state.url } : {} });
  }
  return user.role === role ? true : router.createUrlTree([auth.homeUrl()]);
};

/** Pages de connexion / inscription : un utilisateur déjà connecté va directement à son espace. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.token() ? inject(Router).createUrlTree([auth.homeUrl()]) : true;
};
