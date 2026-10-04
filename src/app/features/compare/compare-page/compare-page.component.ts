import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PercentPipe } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReviewApi } from '../../../core/api/review-api.service';
import { CompareResponse, Sentiment } from '../../../models/models';
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
    <header class="page-heading">
      <div><span class="eyebrow">BONUS · AVIS EN ARABE</span><h1>Comparer les modèles.</h1><p>Le modèle multilingue face à un modèle entraîné uniquement sur l'anglais.</p></div>
      <button class="primary-action" type="button" (click)="runAll()" [disabled]="running() || !cases().length"><span class="material-icons">play_arrow</span>{{ running() ? 'Comparaison…' : 'Lancer la comparaison' }}</button>
    </header>

    <section class="score-grid">
      <article class="panel score-card"><span>Multilingue <small>XLM-RoBERTa</small></span><strong>{{ accuracy().multi }} / {{ accuracy().done }}</strong><small>bonnes réponses</small></article>
      <article class="panel score-card"><span>Anglais seul <small>RoBERTa</small></span><strong>{{ accuracy().english }} / {{ accuracy().done }}</strong><small>bonnes réponses</small></article>
      <article class="panel score-card"><span>Accord</span><strong>{{ accuracy().agree }} / {{ accuracy().done }}</strong><small>même étiquette</small></article>
    </section>

    <section class="panel">
      <div class="panel-title"><div><h2>Avis de test</h2><p>Chaque avis est envoyé aux deux modèles. Les résultats sont mis en cache.</p></div></div>
      @if (running()) { <mat-progress-bar mode="determinate" [value]="progress()" /> }
      <div class="table-scroll">
        <table class="compare-table">
          <thead><tr><th>AVIS</th><th>ATTENDU</th><th>MULTILINGUE</th><th>ANGLAIS SEUL</th><th></th></tr></thead>
          <tbody>
            @for (c of cases(); track $index) {
              <tr>
                <td dir="auto" class="text">{{ c.text }}</td>
                <td><app-sentiment-badge [label]="c.expected" /></td>
                <td>@if (c.result; as r) { <app-sentiment-badge [label]="r.multilingual.label" /> <small [class.ok]="r.multilingual.label === c.expected" [class.ko]="r.multilingual.label !== c.expected">{{ r.multilingual.score | percent: '1.0-0' }}</small> } @else if (c.error) { <small class="ko">erreur</small> } @else { <small>—</small> }</td>
                <td>@if (c.result; as r) { <app-sentiment-badge [label]="r.english.label" /> <small [class.ok]="r.english.label === c.expected" [class.ko]="r.english.label !== c.expected">{{ r.english.score | percent: '1.0-0' }}</small> } @else if (c.error) { <small class="ko">erreur</small> } @else { <small>—</small> }</td>
                <td><button class="icon-button" type="button" title="Retirer" (click)="remove($index)" [disabled]="running()"><span class="material-icons">close</span></button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <form class="add-row" (submit)="add($event)">
        <input class="input-control" dir="auto" name="text" [(ngModel)]="newText" maxlength="2000" placeholder="Ajouter un avis (arabe, français, anglais)…" />
        <select class="input-control" name="expected" [(ngModel)]="newExpected" aria-label="Sentiment attendu">
          <option value="POSITIVE">Positif</option><option value="NEUTRAL">Neutre</option><option value="NEGATIVE">Négatif</option>
        </select>
        <button class="secondary-action" type="submit" [disabled]="!newText.trim() || running()"><span class="material-icons">add</span>Ajouter</button>
      </form>
    </section>

    <p class="note"><span class="material-icons">info</span>Modèle multilingue : cardiffnlp/twitter-xlm-roberta-base-sentiment. Modèle anglais : cardiffnlp/twitter-roberta-base-sentiment-latest. Un modèle anglais ne « comprend » pas l'arabe : il répond souvent neutre ou au hasard.</p>
  `,
  styles: [`
    :host { display: block; }
    .score-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
    .score-card { padding: 17px 18px; }.score-card > span { color: #77827d; font-size: 11px; font-weight: 600; }.score-card > span small { color: #a0aaa4; font-weight: 500; }
    .score-card > strong { display: block; margin-top: 10px; font: 700 26px/1.15 Manrope, sans-serif; }.score-card > small { color: #919b95; font-size: 10px; }
    .table-scroll { overflow-x: auto; }
    .compare-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .compare-table th { padding: 10px 16px; color: #8a958f; background: #f8faf8; font-size: 9px; letter-spacing: .6px; text-align: start; }
    .compare-table td { padding: 11px 16px; border-top: 1px solid var(--line); white-space: nowrap; }
    .compare-table td.text { min-width: 220px; white-space: normal; font-size: 13px; }
    small.ok { color: #267b5e; font-weight: 700; }small.ko { color: var(--red); font-weight: 700; }
    .icon-button { display: grid; place-items: center; width: 28px; height: 28px; color: #8a958f; background: none; border: 0; border-radius: 5px; }.icon-button:hover { background: #f2f5f3; }.icon-button .material-icons { font-size: 16px; }
    .add-row { display: flex; gap: 10px; padding: 14px 16px; border-top: 1px solid var(--line); }.add-row select { width: 130px; flex: 0 0 auto; }
    .note { display: flex; gap: 8px; margin: 14px 2px 0; color: #87928c; font-size: 10px; line-height: 1.5; }.note .material-icons { color: #9c793f; font-size: 15px; }
    @media (max-width: 700px) { .score-grid { grid-template-columns: 1fr; }.add-row { flex-direction: column; }.add-row select { width: 100%; } }
  `],
})
export class ComparePageComponent {
  private readonly api = inject(ReviewApi);
  readonly cases = signal<CompareCase[]>(ARABIC_CASES.map((c) => ({ ...c })));
  readonly running = signal(false);
  readonly progress = signal(0);
  newText = '';
  newExpected: Sentiment = 'POSITIVE';

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
