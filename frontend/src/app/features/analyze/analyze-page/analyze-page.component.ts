import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PercentPipe } from '@angular/common';
import { finalize } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ReviewApi } from '../../../core/api/review-api.service';
import { AnalyzeResponse } from '../../../core/models/models';
import { SentimentBadgeComponent } from '../../../shared/sentiment-badge/sentiment-badge.component';

@Component({
  selector: 'app-analyze-page',
  standalone: true,
  imports: [FormsModule, PercentPipe, MatIconModule, MatProgressBarModule, SentimentBadgeComponent],
  template: `
    <header class="page-heading">
      <div><span class="eyebrow">ANALYSE À LA DEMANDE</span><h1>Comprenez chaque avis.</h1><p>Obtenez le sentiment exprimé dans un commentaire en quelques secondes.</p></div>
    </header>

    <div class="analyze-layout">
      <section class="panel analyze-form">
        <div class="panel-title"><div><h2>Nouvelle analyse</h2><p>Rédigez ou collez le commentaire à analyser.</p></div><span class="panel-title-icon material-icons">auto_awesome</span></div>
        <div class="form-body">
          <label class="field-label" for="review-text">Commentaire <span>FR · EN · AR</span></label>
          <textarea id="review-text" class="input-control review-input" dir="auto" rows="8" maxlength="2000" [(ngModel)]="text" placeholder="Ex. La livraison était rapide et le produit conforme à mes attentes…"></textarea>
          <div class="input-meta"><span>Votre texte reste associé à l'analyse de sentiment.</span><span>{{ text.length }} / 2000</span></div>
          <label class="field-label product-label" for="product">Produit <span>FACULTATIF</span></label>
          <input id="product" class="input-control" [(ngModel)]="product" placeholder="Nom du produit" />
          @if (loading()) { <mat-progress-bar class="progress" mode="indeterminate" /> }
          <button class="primary-action analyze-button" type="button" (click)="analyze()" [disabled]="!text.trim() || loading()"><span class="material-icons">psychology</span>{{ loading() ? 'Analyse en cours…' : 'Analyser le sentiment' }}</button>
        </div>
      </section>

      <aside class="side-column">
        @if (result(); as r) {
          <section class="panel result-panel">
            <span class="eyebrow">RÉSULTAT</span><h2>Analyse terminée</h2>
            <div class="result-class"><app-sentiment-badge [label]="r.label" /><span>{{ r.score | percent: '1.0-0' }} de confiance</span></div>
            <div class="confidence-track"><span [class]="'confidence-fill ' + r.label.toLowerCase()" [style.width.%]="r.score * 100"></span></div>
            <p class="result-note">{{ resultMessage(r.label) }}</p>
            @if (r.cached) { <div class="cache-note"><mat-icon>bolt</mat-icon>Résultat récupéré du cache</div> }
          </section>
        } @else {
          <section class="panel preview-panel"><div class="preview-icon"><span class="material-icons">query_stats</span></div><span class="eyebrow">VOTRE RÉSULTAT</span><h2>Une lecture, trois signaux.</h2><p>L'analyse classe le commentaire comme positif, neutre ou négatif et estime son niveau de confiance.</p><div class="preview-legend"><div><span class="legend-dot positive-dot"></span>Positif</div><div><span class="legend-dot neutral-dot"></span>Neutre</div><div><span class="legend-dot negative-dot"></span>Négatif</div></div></section>
        }
        <section class="language-note"><span class="material-icons">translate</span><div><strong>Multilingue</strong><p>Les commentaires en français, anglais et arabe sont pris en charge.</p></div></section>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .analyze-layout { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(260px, .8fr); align-items: start; gap: 16px; }
    .panel-title-icon { display: grid; width: 34px; height: 34px; place-items: center; color: var(--green); background: var(--green-soft); border-radius: 8px; font-size: 18px; }
    .form-body { padding: 21px; }.field-label { display: flex; justify-content: space-between; align-items: center; }.field-label span { color: #9aa49e; font-size: 9px; letter-spacing: .5px; }
    .review-input { min-height: 180px; resize: vertical; line-height: 1.6; }.review-input::placeholder { color: #abb4af; }
    .input-meta { display: flex; justify-content: space-between; gap: 12px; margin: 7px 0 22px; color: #929d96; font-size: 10px; }.product-label { margin-bottom: 7px; }
    .progress { margin-top: 15px; }.analyze-button { width: 100%; margin-top: 18px; min-height: 43px; }
    .side-column { display: grid; gap: 13px; }.preview-panel, .result-panel { min-height: 250px; padding: 22px; }
    .preview-icon { display: grid; width: 40px; height: 40px; place-items: center; margin-bottom: 18px; color: #9a7134; background: #f8f1e4; border-radius: 10px; }.preview-icon .material-icons { font-size: 21px; }
    .preview-panel .eyebrow, .result-panel .eyebrow { margin-bottom: 7px; font-size: 9px; }.preview-panel h2, .result-panel h2 { font-size: 17px; }.preview-panel > p, .result-note { margin: 9px 0 18px; color: var(--muted); font-size: 11px; }
    .preview-legend { display: flex; flex-wrap: wrap; gap: 13px; padding-top: 15px; border-top: 1px solid var(--line); }.preview-legend > div { display: flex; align-items: center; gap: 6px; color: #66736c; font-size: 10px; }.legend-dot { width: 7px; height: 7px; border-radius: 50%; }.positive-dot { background: #48a77b; }.neutral-dot { background: #d3a250; }.negative-dot { background: #d3756c; }
    .result-panel { border-top: 3px solid var(--green); }.result-class { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 25px; }.result-class > span { color: #718078; font-size: 11px; }.confidence-track { height: 7px; margin-top: 13px; overflow: hidden; background: #eef2ef; border-radius: 10px; }.confidence-fill { display: block; height: 100%; background: #48a77b; border-radius: inherit; }.confidence-fill.neutral { background: #d3a250; }.confidence-fill.negative { background: #d3756c; }.result-note { margin: 17px 0 0; padding-top: 13px; border-top: 1px solid var(--line); }.cache-note { display: flex; align-items: center; gap: 6px; color: #75827b; font-size: 10px; }.cache-note mat-icon { width: 16px; height: 16px; font-size: 16px; }
    .language-note { display: flex; gap: 11px; padding: 15px; color: #6d7c73; background: #edf4ef; border-radius: 6px; }.language-note > .material-icons { color: var(--green); font-size: 19px; }.language-note strong { font-size: 11px; }.language-note p { margin: 4px 0 0; color: #718078; font-size: 10px; }
    @media (max-width: 850px) { .analyze-layout { grid-template-columns: 1fr; }.side-column { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    @media (max-width: 520px) { .side-column { grid-template-columns: 1fr; }.form-body { padding: 16px; }.input-meta { font-size: 9px; } }
  `],
})
export class AnalyzePageComponent {
  private readonly api = inject(ReviewApi);
  text = '';
  product = '';
  loading = signal(false);
  result = signal<AnalyzeResponse | null>(null);

  analyze() {
    this.loading.set(true);
    this.result.set(null);
    this.api.analyze(this.text, this.product.trim() || undefined)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({ next: (response) => this.result.set(response), error: () => {} });
  }

  resultMessage(label: AnalyzeResponse['label']) {
    if (label === 'POSITIVE') return 'Ce commentaire exprime une expérience globalement positive.';
    if (label === 'NEGATIVE') return 'Ce commentaire signale une expérience à examiner.';
    return 'Ce commentaire présente un ton plutôt neutre.';
  }
}
