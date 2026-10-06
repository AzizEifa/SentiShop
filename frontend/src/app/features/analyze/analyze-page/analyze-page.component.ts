import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ReviewApi } from '../../../core/api/review-api.service';
import { DashboardApi } from '../../../core/api/dashboard-api.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { AnalyzeResponse, Sentiment } from '../../../core/models/models';
import { SENTIMENT_CLASS, formatNumber, formatRelative } from '../../../core/format';
import { LANG_LABEL, Lang, detectLanguage } from '../../../core/language';
import { SentimentBadgeComponent } from '../../../shared/sentiment-badge/sentiment-badge.component';
import { ConfidenceComponent } from '../../../shared/confidence/confidence.component';

export interface HistoryItem extends AnalyzeResponse { text: string; product: string; at: string; }

/** État de l'écran : chaque cas a son affichage. */
export type AnalyzeState = 'initial' | 'invalid' | 'loading' | 'result' | 'error' | 'unavailable';

const HISTORY_KEY = 'sentishop.analyze.history';
/** Limite imposée par le backend (AnalyzeRequest). */
const MAX_TEXT = 2000;
const MIN_TEXT = 3;

/** Exemples prêts à l'emploi pour la démonstration (FR / EN / AR). */
export const EXAMPLES = [
  { lang: 'FR', text: 'Livraison rapide et produit conforme à la description, je recommande !', product: 'Casque Bluetooth' },
  { lang: 'EN', text: 'The strap broke after one week. Very disappointed with the quality.', product: 'Montre connectée' },
  { lang: 'AR', text: 'المنتج عادي، لا بأس به', product: 'Tapis de yoga' },
];

@Component({
  selector: 'app-analyze-page',
  standalone: true,
  imports: [FormsModule, RouterLink, SentimentBadgeComponent, ConfidenceComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Analyser un avis</h1>
        <p class="subtitle">Collez un commentaire client en français, anglais ou arabe : le modèle multilingue en détecte le sentiment.</p>
      </div>
      <span class="model-chip" title="Modèle de sentiment utilisé par le backend"><span class="icon">memory</span>cardiffnlp/twitter-xlm-roberta-base-sentiment</span>
    </header>

    <div class="layout">
      <section class="card input-card">
        <form class="form" (submit)="$event.preventDefault(); analyze()" novalidate>
          <div class="field">
            <label class="label" for="review-text">Texte de l’avis
              <span class="optional tabular" [class.warn]="text.length > maxText - 100">{{ fmt(text.length) }} / {{ fmt(maxText) }}</span>
            </label>
            <textarea id="review-text" class="textarea" dir="auto" rows="8" [maxlength]="maxText" name="text" [(ngModel)]="text" (ngModelChange)="onEdit()"
                      [class.invalid]="state() === 'invalid'" [attr.aria-invalid]="state() === 'invalid'" aria-describedby="text-help"
                      (keydown.control.enter)="analyze()" (keydown.meta.enter)="analyze()"
                      placeholder="Ex. La livraison était rapide et le produit conforme à mes attentes…"></textarea>
            <div class="text-meta" id="text-help">
              @if (state() === 'invalid') {
                <span class="field-error" role="alert"><span class="icon">error</span>Saisissez au moins {{ minText }} caractères à analyser.</span>
              } @else {
                <span class="hint">Langue estimée : @if (typing() !== '?') { <span class="lang-tag">{{ typing() }}</span> {{ langLabel(typing()) }} } @else { — }</span>
              }
            </div>
          </div>

          <div class="examples">
            <span class="hint">Exemples :</span>
            @for (ex of examples; track ex.lang) {
              <button class="chip" type="button" (click)="useExample(ex)" [title]="ex.text"><span class="lang-tag">{{ ex.lang }}</span><span class="ex-text" dir="auto">{{ ex.text }}</span></button>
            }
          </div>

          <div class="field">
            <label class="label" for="product">Produit <span class="optional">facultatif</span></label>
            <input id="product" class="input" name="product" list="product-list" [(ngModel)]="product" placeholder="Ex. Casque Bluetooth" maxlength="120" />
            <datalist id="product-list">@for (p of products(); track p) { <option [value]="p"></option> }</datalist>
            <span class="hint">L’avis analysé est enregistré : associer un produit permet de le suivre dans le tableau de bord.</span>
          </div>

          <div class="actions">
            <button class="btn btn-primary btn-lg" type="submit" [class.is-loading]="loading()" [attr.aria-busy]="loading()">
              <span class="icon">auto_awesome</span>Analyser le sentiment
            </button>
            <span class="hint shortcut"><kbd>Ctrl</kbd> + <kbd>Entrée</kbd></span>
          </div>
        </form>
      </section>

      <aside class="side">
        <section class="card result-card" [class]="'card result-card ' + resultTone()" aria-live="polite" aria-labelledby="result-title">
          <div class="result-head">
            <h2 id="result-title">Résultat</h2>
            <span class="state" [class]="'state ' + state()"><span class="icon">{{ stateIcon() }}</span>{{ stateLabel() }}</span>
          </div>

          @switch (state()) {
            @case ('loading') {
              <div class="state-body">
                <span class="spinner big"></span>
                <p><strong>Analyse en cours…</strong></p>
                <p class="muted">Le texte est envoyé au modèle XLM-RoBERTa via le backend. Comptez quelques secondes au premier appel.</p>
              </div>
            }
            @case ('result') {
              @if (result(); as r) {
                <div class="result fade-in">
                  <div class="verdict">
                    <app-sentiment-badge [label]="r.label" size="lg" />
                  </div>
                  <div class="metric">
                    <span class="metric-label">Confiance du modèle</span>
                    <app-confidence [score]="r.score" [label]="r.label" size="lg" [showLevel]="true" />
                    <span class="hint">Probabilité attribuée par le modèle à ce sentiment : une estimation, pas une garantie.</span>
                  </div>
                  <dl class="facts">
                    <div><dt>Langue estimée</dt><dd>@if (analyzedLang() !== '?') { <span class="lang-tag">{{ analyzedLang() }}</span> } {{ langLabel(analyzedLang()) }}</dd></div>
                    <div><dt>Source</dt><dd class="source" [class.cached]="r.cached"><span class="icon">{{ r.cached ? 'bolt' : 'cloud_done' }}</span>{{ r.cached ? 'Résultat du cache : aucun crédit Hugging Face consommé' : 'Analysé par Hugging Face (XLM-RoBERTa)' }}</dd></div>
                  </dl>
                  <div class="analyzed">
                    <span class="metric-label">Texte analysé</span>
                    <blockquote dir="auto">{{ analyzedText() }}</blockquote>
                  </div>
                </div>
              }
            }
            @case ('unavailable') {
              <div class="state-body">
                <span class="state-icon neg"><span class="icon">cloud_off</span></span>
                <p><strong>Service d’IA temporairement indisponible</strong></p>
                <p class="muted">{{ errorDetail() }}</p>
                <button class="btn btn-secondary" type="button" (click)="analyze()"><span class="icon">refresh</span>Réessayer</button>
              </div>
            }
            @case ('error') {
              <div class="state-body">
                <span class="state-icon neg"><span class="icon">error</span></span>
                <p><strong>L’analyse a échoué</strong></p>
                <p class="muted">{{ errorDetail() }}</p>
                <button class="btn btn-secondary" type="button" (click)="analyze()"><span class="icon">refresh</span>Réessayer</button>
              </div>
            }
            @default {
              <div class="state-body">
                <span class="state-icon"><span class="icon">psychology</span></span>
                <p><strong>Le résultat s’affichera ici</strong></p>
                <p class="muted">Sentiment prédit (positif, neutre ou négatif), niveau de confiance du modèle et langue estimée.</p>
                <div class="legend"><span><span class="dot pos"></span>Positif</span><span><span class="dot neu"></span>Neutre</span><span><span class="dot neg"></span>Négatif</span></div>
              </div>
            }
          }
          @if (state() === 'result') {
            <div class="card-footer result-actions">
              <button class="btn btn-ghost btn-sm" type="button" (click)="reset()"><span class="icon">add</span>Nouvel avis</button>
              <a class="link-btn" routerLink="/reviews">Voir dans les avis clients<span class="icon">arrow_forward</span></a>
            </div>
          }
        </section>

        @if (history().length) {
          <section class="card">
            <div class="card-header"><h2>Analyses récentes</h2><button class="link-btn" type="button" (click)="clearHistory()">Effacer</button></div>
            <ul class="history">
              @for (h of history(); track h.at) {
                <li><button type="button" (click)="reuse(h)" title="Réafficher ce résultat">
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
    .model-chip { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; color: var(--text-2); background: var(--surface); border: 1px solid var(--border); border-radius: 99px; font-size: 12px; font-weight: 550; }
    .model-chip .icon { font-size: 16px; color: var(--primary); }
    .layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(320px, 1fr); align-items: start; gap: 20px; }
    .layout > * { min-width: 0; }
    .form { display: grid; gap: 20px; padding: 24px; }
    .textarea { min-height: 200px; font-size: 15px; }
    .optional.warn { color: var(--neu-text); font-weight: 600; }
    .text-meta { min-height: 20px; }
    .examples { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: -6px; }
    .examples .chip { max-width: 260px; }
    .ex-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .side { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; position: sticky; top: calc(var(--topbar-h) + 16px); }
    .result-card { overflow: hidden; border-top: 3px solid var(--border); }
    .result-card.pos { border-top-color: var(--pos); } .result-card.neu { border-top-color: var(--neu); } .result-card.neg { border-top-color: var(--neg); }
    .result-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 20px 0; }
    .state { display: inline-flex; align-items: center; gap: 4px; height: 24px; padding: 0 9px; color: var(--text-2); background: var(--surface-3); border-radius: 99px; font-size: 12px; font-weight: 600; }
    .state .icon { font-size: 15px; }
    .state.result { color: var(--pos-text); background: var(--pos-soft); }
    .state.loading { color: var(--primary-text); background: var(--primary-50); }
    .state.error, .state.unavailable { color: var(--neg-text); background: var(--neg-soft); }
    .state.invalid { color: var(--neu-text); background: var(--neu-soft); }
    .state-body { display: grid; justify-items: center; gap: 8px; padding: 32px 24px 36px; text-align: center; }
    .state-body p { max-width: 340px; }
    .state-icon { display: grid; place-items: center; width: 48px; height: 48px; margin-bottom: 4px; color: var(--primary); background: var(--primary-50); border-radius: var(--r-lg); }
    .state-icon.neg { color: var(--neg-text); background: var(--neg-soft); }
    .spinner.big { width: 36px; height: 36px; border-width: 3px; margin-bottom: 6px; }
    .legend { display: flex; gap: 16px; margin-top: 8px; color: var(--text-3); font-size: 13px; }
    .legend > span { display: inline-flex; align-items: center; gap: 6px; }
    .result { display: grid; gap: 20px; padding: 18px 20px 20px; }
    .verdict { display: flex; }
    .metric, .analyzed { display: grid; gap: 8px; }
    .metric-label { color: var(--text-3); font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    .facts { display: grid; gap: 12px; margin: 0; padding: 14px 16px; background: var(--surface-2); border-radius: var(--r); }
    .facts dt { color: var(--text-3); font-size: 12px; font-weight: 550; }
    .facts dd { display: flex; align-items: center; gap: 6px; margin: 2px 0 0; font-size: 13.5px; }
    .source .icon { font-size: 17px; color: var(--text-3); } .source.cached .icon { color: var(--primary); }
    blockquote { margin: 0; padding: 12px 14px; max-height: 180px; overflow-y: auto; color: var(--text-2); background: var(--surface-2); border-left: 3px solid var(--border-strong); border-radius: 0 var(--r) var(--r) 0; line-height: 1.6; unicode-bidi: plaintext; white-space: pre-wrap; overflow-wrap: anywhere; }
    .result-actions { display: flex; align-items: center; justify-content: space-between; }
    .history { margin: 0; padding: 6px; list-style: none; }
    .history button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 10px; background: none; border: 0; border-radius: var(--r); text-align: start; font-size: 13.5px; }
    .history button:hover { background: var(--surface-2); }
    .history-text { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .history .muted { font-size: 12px; }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } .side { position: static; } .shortcut { display: none; } }
    @media (max-width: 480px) { .form { padding: 18px; } .actions .btn-lg { width: 100%; } .model-chip { display: none; } }
  `],
})
export class AnalyzePageComponent implements OnInit {
  private readonly api = inject(ReviewApi);
  private readonly dashboard = inject(DashboardApi);
  private readonly notifications = inject(NotificationService);
  readonly maxText = MAX_TEXT;
  readonly minText = MIN_TEXT;
  readonly examples = EXAMPLES;
  text = '';
  product = '';
  readonly state = signal<AnalyzeState>('initial');
  readonly loading = computed(() => this.state() === 'loading');
  readonly result = signal<AnalyzeResponse | null>(null);
  readonly analyzedText = signal('');
  readonly errorDetail = signal('');
  readonly products = signal<string[]>([]);
  readonly history = signal<HistoryItem[]>(loadHistory());
  /** Langue estimée pendant la saisie (mise à jour à chaque frappe). */
  readonly typing = signal<Lang>('?');
  readonly analyzedLang = computed(() => detectLanguage(this.analyzedText()));
  readonly resultTone = computed(() => (this.state() === 'result' && this.result() ? SENTIMENT_CLASS[this.result()!.label] : ''));

  readonly fmt = formatNumber;
  readonly tone = (l: Sentiment) => SENTIMENT_CLASS[l];
  readonly langLabel = (l: Lang) => LANG_LABEL[l];
  readonly relative = (iso: string) => formatRelative(iso);
  readonly stateLabel = computed(() => ({
    initial: 'En attente', invalid: 'Saisie invalide', loading: 'Analyse en cours', result: 'Résultat disponible',
    error: 'Erreur', unavailable: 'IA indisponible',
  })[this.state()]);
  readonly stateIcon = computed(() => ({
    initial: 'hourglass_empty', invalid: 'edit_off', loading: 'autorenew', result: 'check_circle', error: 'error', unavailable: 'cloud_off',
  })[this.state()]);

  ngOnInit() {
    this.dashboard.products().subscribe({ next: (p) => this.products.set(p), error: () => {} });
  }

  onEdit() {
    this.typing.set(detectLanguage(this.text));
    if (this.state() === 'invalid' && this.text.trim().length >= MIN_TEXT) this.state.set(this.result() ? 'result' : 'initial');
  }

  analyze() {
    const text = this.text.trim();
    if (this.loading()) return;
    if (text.length < MIN_TEXT) {
      if (text.length) this.state.set('invalid');
      return;
    }
    const product = this.product.trim();
    this.state.set('loading');
    this.result.set(null);
    this.analyzedText.set(text);
    this.api.analyze(text, product || undefined)
      .pipe(finalize(() => { if (this.state() === 'loading') this.state.set('error'); }))
      .subscribe({
        next: (response) => {
          this.result.set(response);
          this.state.set('result');
          this.pushHistory({ ...response, text, product, at: new Date().toISOString() });
        },
        error: (e: HttpErrorResponse) => this.fail(e),
      });
  }

  useExample(ex: (typeof EXAMPLES)[number]) {
    this.text = ex.text;
    this.product = ex.product;
    this.result.set(null);
    this.state.set('initial');
    this.onEdit();
  }

  reuse(h: HistoryItem) {
    this.text = h.text;
    this.product = h.product;
    this.analyzedText.set(h.text);
    this.result.set(h);
    this.state.set('result');
    this.onEdit();
  }

  reset() {
    this.text = '';
    this.result.set(null);
    this.state.set('initial');
    this.typing.set('?');
  }

  clearHistory() { this.history.set([]); saveHistory([]); }

  /** 502 / 503 : IA injoignable ; 429 : quota ; 0 / 504 : backend arrêté ; 400 : texte refusé. */
  private fail(e: HttpErrorResponse) {
    const detail = (e.error as { detail?: string } | null)?.detail;
    if (e.status === 502 || e.status === 503 || e.status === 429) {
      this.state.set('unavailable');
      this.errorDetail.set(e.status === 429
        ? 'Le quota Hugging Face est atteint. Réessayez plus tard.'
        : 'Le modèle Hugging Face ne répond pas pour le moment. Réessayez dans un instant.');
      this.notifications.notify({ kind: 'analysis.unavailable', title: 'Analyse indisponible', message: this.errorDetail(), link: '/analyze' });
    } else {
      this.state.set('error');
      this.errorDetail.set(e.status === 0 || e.status === 504
        ? 'Le serveur ne répond pas. Vérifiez que le backend Spring Boot est démarré.'
        : detail ?? `Erreur ${e.status}. Réessayez.`);
    }
  }

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
