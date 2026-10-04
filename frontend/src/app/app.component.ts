import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Racine : chaque espace (connexion, back-office admin, espace client) a sa propre mise en page. */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`,
})
export class AppComponent {}
