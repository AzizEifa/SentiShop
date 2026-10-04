import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PercentPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReviewApi } from '../../../core/api/review-api.service';
import { CompareResponse, Sentiment } from '../../../core/models/models';
import { SentimentBadgeComponent } from '../../../shared/sentiment-badge/sentiment-badge.component';

export interface CompareCase {
  text: string;
  expected: Sentiment;
  result?: CompareResponse;
  error?: boolean;
}

/** Jeu de test arabe avec le sentiment attendu (vérité terrain). */
export const ARABIC_CASES: CompareCase[] = [
  { text: 'المنتج رائع جدا وأنصح به', expected: 'POSITIVE' },
  { text: 'التوصيل كان سريعا والجودة ممتازة', expected: 'POSITIVE' },
  { text: 'الجودة سيئة جدا ولن أشتري مرة أخرى', expected: 'NEGATIVE' },
  { text: 'وصل المنتج مكسورا وخدمة العملاء لا ترد', expected: 'NEGATIVE' },
  { text: 'المنتج عادي، لا بأس به', expected: 'NEUTRAL' },
  { text: 'استلمت الطلب اليوم', expected: 'NEUTRAL' },
];

@Component({
  selector: 'app-compare-page',
  standalone: true,
  imports: [FormsModule, PercentPipe, MatProgressBarModule, SentimentBadgeComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Comparer les modèles</h1>
        <p class="subtitle">Un modèle multilingue face à un modèle entraîné uniquement sur l’anglais, sur des avis en arabe.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" (click)="runAll()" [disabled]="running() || !cases().length">
          <span class="icon">{{ running() ? 'hourglass_top' : 'play_arrow' }}</span>{{ running() ? 'Comparaison… ' + progress() + '%' : 'Lancer la comparaison' }}
        </button>
      </div>
    </header>

    <div class="alert alert-info intro"><span class="icon">science</span><div><strong>L’expérience.</strong> Chaque avis, dont on connaît le bon sentiment, est envoyé aux deux modèles. Un modèle qui n’a appris que l’anglais ne « comprend » pas l’arabe : il répond souvent neutre ou au hasard. Les résultats sont mis en cache.</div></div>

    <section class="score-grid">
      <article class="card score-card">
        <div class="score-head"><span class="model-tag multi">Multilingue</span><span class="muted">XLM-RoBERTa</span></div>
        <div class="score-value tabular">{{ accuracy().done ? accuracy().multi + ' / ' + accuracy().done : '—' }}</div>
        <div class="meter pos"><span [style.width.%]="pct(accuracy().multi)"></span></div>
        <div class="kpi-meta">{{ accuracy().done ? 'bonnes réponses · ' + pct(accuracy().multi) + '%' : 'Pas encore lancé' }}</div>
      </article>
      <article class="card score-card">
        <div class="score-head"><span class="model-tag en">Anglais seul</span><span class="muted">RoBERTa</span></div>
        <div class="score-value tabular">{{ accuracy().done ? accuracy().english + ' / ' + accuracy().done : '—' }}</div>
        <div class="meter neg"><span [style.width.%]="pct(accuracy().english)"></span></div>
        <div class="kpi-meta">{{ accuracy().done ? 'bonnes réponses · ' + pct(accuracy().english) + '%' : 'Pas encore lancé' }}</div>
      </article>
      <article class="card score-card">
        <div class="score-head"><span class="model-tag">Accord</span><span class="muted">même étiquette</span></div>
        <div class="score-value tabular">{{ accuracy().done ? accuracy().agree + ' / ' + accuracy().done : '—' }}</div>
        <div class="meter"><span [style.width.%]="pct(accuracy().agree)"></span></div>
        <div class="kpi-meta">les deux modèles sont d’accord</div>
      </article>
    </section>

    <section class="card">
      <div class="card-header"><div><h2>Jeu de test</h2><p class="card-subtitle">{{ cases().length }} avis · ajoutez les vôtres ci-dessous</p></div></div>
      @if (running()) { <mat-progress-bar mode="determinate" [value]="progress()" /> }
      <div class="table-wrap">
        <table class="table compare-table">
          <thead><tr><th>Avis</th><th>Attendu</th><th>Multilingue</th><th>Anglais seul</th><th></th></tr></thead>
          <tbody>
            @for (c of cases(); track $index) {
              <tr>
                <td class="text"><p class="review-text" dir="auto">{{ c.text }}</p></td>
                <td><app-sentiment-badge [label]="c.expected" /></td>
                <td>
                  @if (c.result; as r) { <div class="cell-result"><span class="icon verdict" [class.ok]="r.multilingual.label === c.expected">{{ r.multilingual.label === c.expected ? 'check_circle' : 'cancel' }}</span><app-sentiment-badge [label]="r.multilingual.label" /><span class="muted tabular">{{ r.multilingual.score | percent: '1.0-0' }}</span></div> }
                  @else if (c.error) { <span class="err">Erreur</span> } @else { <span class="muted">—</span> }
                </td>
                <td>
                  @if (c.result; as r) { <div class="cell-result"><span class="icon verdict" [class.ok]="r.english.label === c.expected">{{ r.english.label === c.expected ? 'check_circle' : 'cancel' }}</span><app-sentiment-badge [label]="r.english.label" /><span class="muted tabular">{{ r.english.score | percent: '1.0-0' }}</span></div> }
                  @else if (c.error) { <span class="err">Erreur</span> } @else { <span class="muted">—</span> }
                </td>
                <td class="actions-col"><button class="btn btn-ghost btn-icon" type="button" title="Retirer" aria-label="Retirer cet avis" (click)="remove($index)" [disabled]="running()"><span class="icon">delete</span></button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <form class="card-footer add-row" (submit)="add($event)">
        <input class="input" dir="auto" name="text" [(ngModel)]="newText" maxlength="2000" placeholder="Ajouter un avis (arabe, français ou anglais)…" aria-label="Texte de l'avis" />
        <select class="select" name="expected" [(ngModel)]="newExpected" aria-label="Sentiment attendu">
          <option value="POSITIVE">Positif</option><option value="NEUTRAL">Neutre</option><option value="NEGATIVE">Négatif</option>
        </select>
        <button class="btn btn-secondary" type="submit" [disabled]="!newText.trim() || running()"><span class="icon">add</span>Ajouter</button>
      </form>
    </section>
  `,
  styles: [`
    .intro { margin-bottom: 16px; }
    .score-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
    .score-card { display: grid; gap: 8px; padding: 18px 20px; }
    .score-head { display: flex; align-items: center; gap: 8px; font-size: 13px; }
    .model-tag { padding: 2px 8px; color: var(--text-2); background: var(--neu-soft); border-radius: 6px; font-size: 12px; font-weight: 600; }
    .model-tag.multi { color: var(--pos-text); background: var(--pos-soft); } .model-tag.en { color: var(--neg-text); background: var(--neg-soft); }
    .score-value { font-size: 28px; font-weight: 650; letter-spacing: -.02em; }
    .compare-table .text { min-width: 240px; font-size: 15px; }
    .cell-result { display: flex; align-items: center; gap: 8px; white-space: nowrap; font-size: 13px; }
    .verdict { color: var(--neg); font-size: 20px; font-variation-settings: 'FILL' 1; } .verdict.ok { color: var(--pos); }
    .err { color: var(--neg-text); font-size: 13px; font-weight: 600; }
    .actions-col { width: 52px; }
    .add-row { display: flex; gap: 10px; }
    .add-row .select { width: 150px; flex: 0 0 auto; }
    @media (max-width: 760px) { .score-grid { grid-template-columns: 1fr; } .add-row { flex-direction: column; } .add-row .select { width: 100%; } }
  `],
})
export class ComparePageComponent {
  private readonly api = inject(ReviewApi);
  readonly cases = signal<CompareCase[]>(ARABIC_CASES.map((c) => ({ ...c })));
  readonly running = signal(false);
  readonly progress = signal(0);
  newText = '';
  newExpected: Sentiment = 'POSITIVE';

  readonly pct = (n: number) => { const d = this.accuracy().done; return d ? Math.round((n / d) * 100) : 0; };

  readonly accuracy = computed(() => {
    const done = this.cases().filter((c) => c.result);
    return {
      done: done.length,
      multi: done.filter((c) => c.result!.multilingual.label === c.expected).length,
      english: done.filter((c) => c.result!.english.label === c.expected).length,
      agree: done.filter((c) => c.result!.agree).length,
    };
  });

  add(event: Event) {
    event.preventDefault();
    const text = this.newText.trim();
    if (!text) return;
    this.cases.update((list) => [...list, { text, expected: this.newExpected }]);
    this.newText = '';
  }

  remove(index: number) {
    this.cases.update((list) => list.filter((_, i) => i !== index));
  }

  /** Avis envoyés un par un : respecte le quota HF, et un échec n'arrête pas les autres. */
  async runAll() {
    const total = this.cases().length;
    this.running.set(true);
    this.progress.set(0);
    for (let i = 0; i < total; i++) {
      const c = this.cases()[i];
      try {
        const result = await firstValueFrom(this.api.compare(c.text));
        this.patch(i, { result, error: false });
      } catch (e: unknown) {
        this.patch(i, { result: undefined, error: true });
        if ((e as { status?: number }).status === 429) break; // quota épuisé : inutile d'insister
      }
      this.progress.set(Math.round(((i + 1) / total) * 100));
    }
    this.running.set(false);
  }

  private patch(index: number, change: Partial<CompareCase>) {
    this.cases.update((list) => list.map((c, i) => (i === index ? { ...c, ...change } : c)));
  }
}
