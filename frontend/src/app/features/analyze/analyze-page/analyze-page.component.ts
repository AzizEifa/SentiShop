import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReviewApi } from '../../../core/api/review-api.service';
import { DashboardApi } from '../../../core/api/dashboard-api.service';
import { AnalyzeResponse, Sentiment } from '../../../core/models/models';
import { SENTIMENT_CLASS, formatRelative } from '../../../core/format';
import { SentimentBadgeComponent } from '../../../shared/sentiment-badge/sentiment-badge.component';

export interface HistoryItem extends AnalyzeResponse { text: string; product: string; at: string; }

const HISTORY_KEY = 'sentishop.analyze.history';
const MAX_TEXT = 2000;

/** Exemples prêts à l'emploi pour la démonstration (FR / EN / AR). */
export const EXAMPLES = [
  { lang: 'FR', text: 'Livraison rapide et produit conforme à la description, je recommande !', product: 'Casque Bluetooth' },
  { lang: 'EN', text: 'The strap broke after one week. Very disappointed with the quality.', product: 'Montre connectée' },
  { lang: 'AR', text: 'المنتج عادي، لا بأس به', product: 'Tapis de yoga' },
];

const INTERPRETATION: Record<Sentiment, string> = {
  POSITIVE: 'Le client exprime une expérience globalement positive.',
  NEUTRAL: 'Le ton est neutre ou factuel, sans émotion marquée.',
  NEGATIVE: 'Le client exprime une insatisfaction : avis à traiter en priorité.',
};

@Component({
  selector: 'app-analyze-page',
  standalone: true,
  imports: [FormsModule, PercentPipe, RouterLink, MatProgressBarModule, SentimentBadgeComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Analyser un avis</h1>
        <p class="subtitle">Collez un commentaire client en français, anglais ou arabe : l’IA en détecte le sentiment.</p>
      </div>
    </header>

    <div class="layout">
      <section class="card">
        <form class="card-body form" (submit)="$event.preventDefault(); analyze()">
          <div class="field">
            <label class="label" for="review-text">Avis client <span class="optional tabular">{{ text.length }} / {{ maxText }}</span></label>
            <textarea id="review-text" class="textarea" dir="auto" rows="7" [maxlength]="maxText" name="text" [(ngModel)]="text"
                      (keydown.control.enter)="analyze()" (keydown.meta.enter)="analyze()"
                      placeholder="Ex. La livraison était rapide et le produit conforme à mes attentes…"></textarea>
          </div>
          <div class="examples">
            <span class="hint">Essayer un exemple :</span>
            @for (ex of examples; track ex.lang) {
              <button class="chip" type="button" (click)="useExample(ex)" [title]="ex.text"><span class="lang">{{ ex.lang }}</span>{{ ex.text.length > 26 ? ex.text.slice(0, 26) + '…' : ex.text }}</button>
            }
          </div>
          <div class="field">
            <label class="label" for="product">Produit <span class="optional">facultatif</span></label>
            <input id="product" class="input" name="product" list="product-list" [(ngModel)]="product" placeholder="Ex. Casque Bluetooth" maxlength="120" />
            <datalist id="product-list">@for (p of products(); track p) { <option [value]="p"></option> }</datalist>
            <span class="hint">Associer un produit permet de le suivre dans le tableau de bord.</span>
          </div>
          <div class="actions">
            <button class="btn btn-primary btn-lg" type="submit" [disabled]="!text.trim() || loading()">
              <span class="icon">{{ loading() ? 'hourglass_top' : 'auto_awesome' }}</span>{{ loading() ? 'Analyse en cours…' : 'Analyser le sentiment' }}
            </button>
            <span class="hint shortcut"><kbd>Ctrl</kbd> + <kbd>Entrée</kbd></span>
          </div>
          @if (loading()) { <mat-progress-bar mode="indeterminate" /> }
        </form>
      </section>

      <aside class="side">
        @if (result(); as r) {
          <section class="card result fade-in" [class]="'card result fade-in ' + tone(r.label)">
            <div class="card-body">
              <span class="eyebrow">Résultat</span>
              <div class="result-head">
                <app-sentiment-badge [label]="r.label" size="lg" />
                <span class="confidence tabular">{{ r.score | percent: '1.0-0' }}<small>confiance</small></span>
              </div>
              <div class="meter big" [class]="'meter big ' + tone(r.label)"><span [style.width.%]="r.score * 100"></span></div>
              <p class="interpretation">{{ interpretation(r.label) }}</p>
              <div class="source" [class.cached]="r.cached">
                <span class="icon">{{ r.cached ? 'bolt' : 'cloud_done' }}</span>
                {{ r.cached ? 'Résultat du cache : aucun crédit Hugging Face consommé' : 'Analysé par Hugging Face (XLM-RoBERTa)' }}
              </div>
            </div>
            <div class="card-footer result-actions">
              <button class="btn btn-ghost btn-sm" type="button" (click)="reset()"><span class="icon">add</span>Nouvel avis</button>
              <a class="link-btn" routerLink="/dashboard">Voir le tableau de bord<span class="icon">arrow_forward</span></a>
            </div>
          </section>
        } @else {
          <section class="card placeholder">
            <div class="empty-state">
              <div class="empty-icon"><span class="icon">psychology</span></div>
              <h3>Le résultat s’affichera ici</h3>
              <p>Sentiment détecté (positif, neutre ou négatif) et niveau de confiance du modèle.</p>
              <div class="legend"><span><span class="dot pos"></span>Positif</span><span><span class="dot neu"></span>Neutre</span><span><span class="dot neg"></span>Négatif</span></div>
            </div>
          </section>
        }

        @if (history().length) {
          <section class="card">
            <div class="card-header"><h2>Analyses récentes</h2><button class="link-btn" type="button" (click)="clearHistory()">Effacer</button></div>
            <ul class="history">
              @for (h of history(); track h.at) {
                <li><button type="button" (click)="reuse(h)" title="Réutiliser ce texte">
                  <span class="dot" [class]="'dot ' + tone(h.label)"></span>
                  <span class="history-text" dir="auto">{{ h.text }}</span>
                  <span class="muted nowrap">{{ relative(h.at) }}</span>
                </button></li>
              }
            </ul>
          </section>
        }
      </aside>
    </div>
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(300px, 1fr); align-items: start; gap: 20px; }
    .form { display: grid; gap: 20px; }
    .examples { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: -8px; }
    .lang { color: var(--brand-600); font-size: 11.5px; font-weight: 700; }
    .actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .layout > * { min-width: 0; }
    .side { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; }
    .placeholder .legend { display: flex; gap: 16px; margin-top: 8px; color: var(--text-3); font-size: 13px; }
    .placeholder .legend > span { display: inline-flex; align-items: center; gap: 6px; }
    .result { border-top: 3px solid var(--neu); } .result.pos { border-top-color: var(--pos); } .result.neg { border-top-color: var(--neg); }
    .eyebrow { color: var(--text-3); font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    .result-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 12px 0 14px; }
    .confidence { display: grid; justify-items: end; font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
    .confidence small { color: var(--text-3); font-size: 12px; font-weight: 500; letter-spacing: 0; }
    .meter.big { height: 8px; }
    .interpretation { margin-top: 14px; color: var(--text-2); }
    .source { display: flex; align-items: center; gap: 8px; margin-top: 16px; padding: 10px 12px; color: var(--text-2); background: var(--surface-2); border-radius: 8px; font-size: 13px; }
    .source .icon { font-size: 18px; color: var(--text-3); }
    .source.cached { color: var(--brand-600); background: var(--brand-50); } .source.cached .icon { color: var(--brand); }
    .result-actions { display: flex; align-items: center; justify-content: space-between; }
    .history { margin: 0; padding: 6px; list-style: none; }
    .history button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; background: none; border: 0; border-radius: 8px; text-align: start; font-size: 13.5px; }
    .history button:hover { background: var(--surface-2); }
    .history-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .history .muted { font-size: 12px; }
    @media (max-width: 960px) { .layout { grid-template-columns: 1fr; } .shortcut { display: none; } }
  `],
})
export class AnalyzePageComponent implements OnInit {
  private readonly api = inject(ReviewApi);
  private readonly dashboard = inject(DashboardApi);
  readonly maxText = MAX_TEXT;
  readonly examples = EXAMPLES;
  text = '';
  product = '';
  readonly loading = signal(false);
  readonly result = signal<AnalyzeResponse | null>(null);
  readonly products = signal<string[]>([]);
  readonly history = signal<HistoryItem[]>(loadHistory());

  readonly tone = (l: Sentiment) => SENTIMENT_CLASS[l];
  readonly interpretation = (l: Sentiment) => INTERPRETATION[l];
  readonly relative = (iso: string) => formatRelative(iso);

  ngOnInit() {
    this.dashboard.products().subscribe({ next: (p) => this.products.set(p), error: () => {} });
  }

  analyze() {
    const text = this.text.trim();
    if (!text || this.loading()) return;
    const product = this.product.trim();
    this.loading.set(true);
    this.result.set(null);
    this.api.analyze(text, product || undefined)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.result.set(response);
          this.pushHistory({ ...response, text, product, at: new Date().toISOString() });
        },
        error: () => {},
      });
  }

  useExample(ex: (typeof EXAMPLES)[number]) {
    this.text = ex.text;
    this.product = ex.product;
    this.result.set(null);
  }

  reuse(h: HistoryItem) {
    this.text = h.text;
    this.product = h.product;
    this.result.set(h);
  }

  reset() {
    this.text = '';
    this.result.set(null);
  }

  clearHistory() { this.history.set([]); saveHistory([]); }

  private pushHistory(item: HistoryItem) {
    const next = [item, ...this.history().filter((h) => h.text !== item.text)].slice(0, 6);
    this.history.set(next);
    saveHistory(next);
  }
}

/** Historique conservé pendant la session du navigateur (sessionStorage peut être indisponible). */
function loadHistory(): HistoryItem[] {
  try { return JSON.parse(sessionStorage.getItem(HISTORY_KEY) ?? '[]'); } catch { return []; }
}
function saveHistory(items: HistoryItem[]) {
  try { sessionStorage.setItem(HISTORY_KEY, JSON.stringify(items)); } catch { /* navigation privée */ }
}
