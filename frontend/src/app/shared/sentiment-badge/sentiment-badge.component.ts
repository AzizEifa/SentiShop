import { Component, input } from '@angular/core';
import { Sentiment } from '../../core/models/models';

const TEXT: Record<Sentiment, string> = {
  POSITIVE: 'Positif',
  NEUTRAL: 'Neutre',
  NEGATIVE: 'Négatif',
};

@Component({
  selector: 'app-sentiment-badge',
  standalone: true,
  template: `<span class="badge" [class]="label().toLowerCase()">{{ text() }}</span>`,
  styles: [`
    .badge { display: inline-flex; align-items: center; gap: 6px; padding: 5px 8px; border-radius: 4px; font-weight: 700; font-size: 9px; line-height: 1; white-space: nowrap; }
    .badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .positive { color: #287453; background: #e8f4ed; }
    .neutral { color: #906a2c; background: #f8f1e3; }
    .negative { color: #ac5149; background: #faeeec; }
  `],
})
export class SentimentBadgeComponent {
  label = input.required<Sentiment>();
  text() { return TEXT[this.label()]; }
}
