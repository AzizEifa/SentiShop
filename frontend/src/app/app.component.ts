import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './shared/confirm-dialog/confirm-dialog.component';
import { LightboxComponent } from './shared/lightbox/lightbox.component';

/** Racine : chaque espace (connexion, back-office admin, espace client) a sa propre mise en page. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ConfirmDialogComponent, LightboxComponent],
  template: `<router-outlet /><app-confirm-dialog /><app-lightbox />`,
})
export class AppComponent {}
