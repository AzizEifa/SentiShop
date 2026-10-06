import { Component, computed, input } from '@angular/core';
import { Sentiment } from '../../core/models/models';
import { SENTIMENT_CLASS, SENTIMENT_LABEL } from '../../core/format';

/** Icône propre à chaque sentiment : l'information ne repose pas sur la seule couleur. */
export const SENTIMENT_ICON: Record<Sentiment, string> = {
  POSITIVE: 'sentiment_satisfied',
  NEUTRAL: 'sentiment_neutral',
  NEGATIVE: 'sentiment_dissatisfied',
};

@Component({
  selector: 'app-sentiment-badge',
  standalone: true,
  template: `<span class="badge" [class]="'badge ' + tone() + (size() === 'lg' ? ' lg' : '')"><span class="icon fill" aria-hidden="true">{{ icon() }}</span>{{ text() }}</span>`,
  styles: [`
    :host { display: inline-flex; }
    .badge { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px 0 6px; border: 1px solid; border-radius: 99px; font-size: 12px; font-weight: 600; white-space: nowrap; }
    .badge .icon { font-size: 15px; }
    .badge.lg { height: 34px; padding: 0 14px 0 10px; gap: 6px; font-size: 14.5px; }
    .badge.lg .icon { font-size: 20px; }
    .pos { color: var(--pos-text); background: var(--pos-soft); border-color: var(--pos-border); }
    .neu { color: var(--neu-text); background: var(--neu-soft); border-color: var(--neu-border); }
    .neg { color: var(--neg-text); background: var(--neg-soft); border-color: var(--neg-border); }
  `],
})
export class SentimentBadgeComponent {
  label = input.required<Sentiment>();
  size = input<'md' | 'lg'>('md');
  readonly text = computed(() => SENTIMENT_LABEL[this.label()]);
  readonly tone = computed(() => SENTIMENT_CLASS[this.label()]);
  readonly icon = computed(() => SENTIMENT_ICON[this.label()]);
}
