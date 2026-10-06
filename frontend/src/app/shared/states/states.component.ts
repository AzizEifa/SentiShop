import { Component, input, output } from '@angular/core';

/** État vide : icône, titre, explication et actions (contenu projeté). */
@Component({
  selector: 'app-empty-state',
  standalone: true,
  template: `
    <div class="empty-state" [class.compact]="compact()">
      <div class="empty-icon"><span class="icon">{{ icon() }}</span></div>
      <h3>{{ title() }}</h3>
      @if (message()) { <p>{{ message() }}</p> }
      <div class="page-actions"><ng-content /></div>
    </div>
  `,
  styles: [`:host { display: block; } .page-actions:empty { display: none; }`],
})
export class EmptyStateComponent {
  readonly icon = input('inbox');
  readonly title = input.required<string>();
  readonly message = input('');
  readonly compact = input(false);
}

/** État d'erreur : message compréhensible et bouton « Réessayer ». */
@Component({
  selector: 'app-error-state',
  standalone: true,
  template: `
    <div class="empty-state" [class.compact]="compact()" role="alert">
      <div class="empty-icon error"><span class="icon">{{ icon() }}</span></div>
      <h3>{{ title() }}</h3>
      <p>{{ message() }}</p>
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" (click)="retry.emit()"><span class="icon">refresh</span>Réessayer</button>
      </div>
    </div>
  `,
  styles: [`:host { display: block; }`],
})
export class ErrorStateComponent {
  readonly icon = input('cloud_off');
  readonly title = input('Serveur injoignable');
  readonly message = input('Le backend Spring Boot ne répond pas. Vérifiez qu’il est démarré puis réessayez.');
  readonly compact = input(false);
  readonly retry = output<void>();
}
