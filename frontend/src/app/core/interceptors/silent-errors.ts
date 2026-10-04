import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Requête dont l'appelant affiche lui-même l'erreur (formulaire, vérification de fond) : pas de message global. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

export const silentErrors = () => ({ context: new HttpContext().set(SILENT_ERRORS, true) });
