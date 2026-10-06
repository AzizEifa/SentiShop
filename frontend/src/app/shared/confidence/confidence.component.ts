import { Component, computed, input } from '@angular/core';
import { Sentiment } from '../../core/models/models';
import { SENTIMENT_CLASS } from '../../core/format';

/** Seuils d'affichage du niveau de confiance (libellé textuel : la couleur n'est jamais seule porteuse d'information). */
export const CONFIDENCE_LEVELS = [
  { min: 0.8, label: 'Élevée' },
  { min: 0.6, label: 'Moyenne' },
  { min: 0, label: 'Faible' },
];

export const confidenceLevel = (score: number) => CONFIDENCE_LEVELS.find((l) => score >= l.min)!.label;

/**
 * Confiance du modèle pour sa prédiction : une estimation (probabilité de la classe retenue),
 * pas une garantie que la prédiction est juste.
 */
@Component({
  selector: 'app-confidence',
  standalone: true,
  template: `
    <span class="conf" [class.lg]="size() === 'lg'" [title]="'Confiance estimée par le modèle : ' + percent() + ' % (' + level().toLowerCase() + '). Ce n’est pas une garantie de justesse.'">
      <span class="meter" [class]="'meter ' + tone()"><span [style.width.%]="percent()"></span></span>
      <span class="value tabular">{{ percent() }}&#8239;%</span>
      @if (showLevel()) { <span class="level">{{ level() }}</span> }
    </span>
  `,
  styles: [`
    :host { display: inline-flex; min-width: 0; }
    .conf { display: inline-grid; grid-template-columns: minmax(48px, 1fr) auto auto; align-items: center; gap: 8px; width: 100%; font-size: 13px; }
    .value { min-width: 38px; text-align: end; font-weight: 550; }
    .level { color: var(--text-3); font-size: 12px; }
    .conf.lg { grid-template-columns: minmax(80px, 1fr) auto auto; gap: 12px; font-size: 15px; }
    .conf.lg .meter { height: 8px; }
  `],
})
export class ConfidenceComponent {
  readonly score = input.required<number>();
  readonly label = input<Sentiment | null>(null);
  readonly size = input<'md' | 'lg'>('md');
  readonly showLevel = input(false);
  readonly percent = computed(() => Math.round(this.score() * 100));
  readonly level = computed(() => confidenceLevel(this.score()));
  readonly tone = computed(() => { const l = this.label(); return l ? SENTIMENT_CLASS[l] : ''; });
}
