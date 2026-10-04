import { Component, computed, input } from '@angular/core';
import { Sentiment } from '../../core/models/models';
import { SENTIMENT_CLASS, SENTIMENT_LABEL } from '../../core/format';

const ICON: Record<Sentiment, string> = {
  POSITIVE: 'sentiment_satisfied',
  NEUTRAL: 'sentiment_neutral',
  NEGATIVE: 'sentiment_dissatisfied',
};

@Component({
  selector: 'app-sentiment-badge',
  standalone: true,
  template: `<span class="badge" [class]="'badge ' + tone() + (size() === 'lg' ? ' lg' : '')"><span class="icon fill">{{ icon() }}</span>{{ text() }}</span>`,
  styles: [`
    :host { display: inline-flex; }
    .badge { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px 0 6px; border-radius: 99px; font-size: 12.5px; font-weight: 600; white-space: nowrap; }
    .badge .icon { font-size: 16px; }
    .badge.lg { height: 32px; padding: 0 14px 0 10px; font-size: 15px; gap: 6px; }
    .badge.lg .icon { font-size: 20px; }
    .pos { color: var(--pos-text); background: var(--pos-soft); }
    .neu { color: var(--neu-text); background: var(--neu-soft); }
    .neg { color: var(--neg-text); background: var(--neg-soft); }
  `],
})
export class SentimentBadgeComponent {
  label = input.required<Sentiment>();
  size = input<'md' | 'lg'>('md');
  readonly text = computed(() => SENTIMENT_LABEL[this.label()]);
  readonly tone = computed(() => SENTIMENT_CLASS[this.label()]);
  readonly icon = computed(() => ICON[this.label()]);
}
