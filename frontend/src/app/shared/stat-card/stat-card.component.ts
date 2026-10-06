import { Component, input } from '@angular/core';

/** Carte d'indicateur : libellé, valeur, précision et barre facultative. */
@Component({
  selector: 'app-stat-card',
  standalone: true,
  template: `
    <article class="card kpi" [class]="'card kpi ' + (tone() ?? '')">
      <div class="kpi-label">
        @if (tone()) { <span class="dot" [class]="'dot ' + tone()"></span> } @else if (icon()) { <span class="icon">{{ icon() }}</span> }
        {{ label() }}
      </div>
      <div class="kpi-value">{{ value() }}</div>
      @if (bar() !== null) { <div class="meter" [class]="'meter ' + (tone() ?? '')"><span [style.width.%]="bar()"></span></div> }
      @if (meta()) { <div class="kpi-meta">{{ meta() }}</div> }
    </article>
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .kpi { height: 100%; }
    .meter { margin-top: 12px; }
    .kpi.pos .kpi-value { color: var(--pos-text); } .kpi.neu .kpi-value { color: var(--neu-text); } .kpi.neg .kpi-value { color: var(--neg-text); }
  `],
})
export class StatCardComponent {
  readonly label = input.required<string>();
  readonly value = input.required<string>();
  readonly meta = input('');
  readonly icon = input('');
  readonly tone = input<'pos' | 'neu' | 'neg' | null>(null);
  /** Remplissage de la barre (0 à 100) ; null = pas de barre. */
  readonly bar = input<number | null>(null);
}
