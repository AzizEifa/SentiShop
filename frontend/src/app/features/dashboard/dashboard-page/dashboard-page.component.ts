import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { DashboardApi } from '../../../core/api/dashboard-api.service';
import { ReviewApi } from '../../../core/api/review-api.service';
import { DashboardStats, SummaryResponse } from '../../../core/models/models';

/** Mêmes couleurs que les badges et les barres : positif / neutre / négatif. */
export const SENTIMENT_COLORS = ['#48a77b', '#d3a250', '#d3756c'];

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [RouterLink, BaseChartDirective],
  template: `
    <header class="page-heading">
      <div><span class="eyebrow">VUE D'ENSEMBLE</span><h1>Bonjour, voici vos avis.</h1><p>Un aperçu clair de ce que vos clients pensent.</p></div>
      <a class="primary-action" routerLink="/analyze"><span class="material-icons">add</span>Analyser un avis</a>
    </header>

    <section class="toolbar">
      <span class="toolbar-caption"><span class="material-icons">filter_list</span>Filtrer les résultats</span>
      <div class="toolbar-actions">
        <select class="input-control product-select" aria-label="Filtrer par produit" [value]="product()" (change)="selectProduct($event)">
          <option value="">Tous les produits</option>
          @for (item of products(); track item) { <option [value]="item">{{ item }}</option> }
        </select>
        <a class="secondary-action" [href]="exportUrl()" download="avis.csv"><span class="material-icons">download</span>Exporter CSV</a>
      </div>
    </section>

    @if (stats(); as s) {
      @if (s.total > 0) {
        <section class="metric-grid" aria-label="Statistiques des avis">
          <article class="metric-card panel total-card"><div class="metric-top"><span>Total des avis</span><span class="metric-icon"><span class="material-icons">forum</span></span></div><strong>{{ s.total }}</strong><small>avis analysés</small></article>
          <article class="metric-card panel positive-card"><div class="metric-top"><span>Positifs</span><span class="metric-icon"><span class="material-icons">sentiment_satisfied</span></span></div><strong>{{ s.positive }}</strong><small>{{ s.positivePct }}% du total</small></article>
          <article class="metric-card panel neutral-card"><div class="metric-top"><span>Neutres</span><span class="metric-icon"><span class="material-icons">sentiment_neutral</span></span></div><strong>{{ s.neutral }}</strong><small>{{ s.neutralPct }}% du total</small></article>
          <article class="metric-card panel negative-card"><div class="metric-top"><span>Négatifs</span><span class="metric-icon"><span class="material-icons">sentiment_dissatisfied</span></span></div><strong>{{ s.negative }}</strong><small>{{ s.negativePct }}% du total</small></article>
        </section>

        <div class="content-grid">
          <section class="panel distribution">
            <div class="panel-title"><div><h2>Répartition des sentiments</h2><p>{{ product() ? 'Produit : ' + product() : 'Tous les produits' }}</p></div><span class="subtle-tag">{{ s.total }} avis</span></div>
            <div class="distribution-body">
              <div class="chart-box">
                <canvas baseChart type="doughnut" [data]="chartData()" [options]="chartOptions" aria-label="Camembert des sentiments" role="img"></canvas>
                <div class="chart-center"><strong>{{ s.total }}</strong><span>avis</span></div>
              </div>
              <div class="sentiment-list">
                <div class="sentiment-row"><div class="sentiment-label"><span class="swatch positive-swatch"></span><span>Positif</span><strong>{{ s.positivePct }}%</strong></div><div class="track"><span class="fill positive-fill" [style.width.%]="s.positivePct"></span></div></div>
                <div class="sentiment-row"><div class="sentiment-label"><span class="swatch neutral-swatch"></span><span>Neutre</span><strong>{{ s.neutralPct }}%</strong></div><div class="track"><span class="fill neutral-fill" [style.width.%]="s.neutralPct"></span></div></div>
                <div class="sentiment-row"><div class="sentiment-label"><span class="swatch negative-swatch"></span><span>Négatif</span><strong>{{ s.negativePct }}%</strong></div><div class="track"><span class="fill negative-fill" [style.width.%]="s.negativePct"></span></div></div>
              </div>
            </div>
          </section>
          <section class="panel insight-panel">
            <div class="insight-symbol"><span class="material-icons">lightbulb</span></div>
            <span class="eyebrow">À RETENIR</span><h2>Écoutez ce qui compte.</h2>
            <p>Résumé automatique (modèle BART) des avis négatifs les plus récents{{ product() ? ' pour ce produit' : '' }}.</p>
            <button class="text-action" type="button" (click)="summarize()" [disabled]="summarizing() || s.negative === 0"><span class="material-icons">auto_awesome</span>{{ summarizing() ? 'Résumé en cours…' : (s.negative === 0 ? 'Aucun avis négatif' : 'Résumer les avis négatifs') }}<span class="material-icons arrow">arrow_forward</span></button>
            @if (summary(); as result) { <div class="summary"><h3>Résumé · {{ result.reviewsUsed }} avis</h3><p dir="auto">{{ result.summary }}</p></div> }
          </section>
        </div>
      } @else {
        <section class="panel empty-panel"><div class="empty-icon"><span class="material-icons">insights</span></div><h2>{{ product() ? 'Aucun avis pour ce produit' : 'Vos indicateurs apparaîtront ici' }}</h2><p>Importez un fichier d'avis ou analysez un premier commentaire pour commencer.</p><div class="empty-actions"><a class="primary-action" routerLink="/import"><span class="material-icons">upload_file</span>Importer des avis</a><a class="secondary-action" routerLink="/analyze">Analyser un avis</a></div></section>
      }
    } @else if (loadError()) {
      <section class="panel empty-panel"><div class="empty-icon"><span class="material-icons">cloud_off</span></div><h2>Serveur injoignable</h2><p>Vérifiez que le backend Spring Boot est démarré sur le port 8080.</p><div class="empty-actions"><button class="primary-action" type="button" (click)="refresh()">Réessayer</button></div></section>
    } @else {
      <section class="panel empty-panel"><p>Chargement des indicateurs…</p></section>
    }
  `,
  styles: [`
    :host { display: block; }
    .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
    .toolbar-caption { display: flex; align-items: center; gap: 7px; color: #75817b; font-size: 11px; font-weight: 600; }
    .toolbar-caption .material-icons { font-size: 17px; }.toolbar-actions { display: flex; gap: 10px; }
    .product-select { width: auto; min-width: 190px; min-height: 36px; padding: 7px 32px 7px 10px; font-size: 11px; }
    .metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 16px; }
    .metric-card { min-width: 0; padding: 17px 18px 16px; }
    .metric-top { display: flex; align-items: center; justify-content: space-between; color: #77827d; font-size: 11px; font-weight: 600; }
    .metric-icon { display: grid; width: 32px; height: 32px; place-items: center; border-radius: 8px; }
    .metric-icon .material-icons { font-size: 18px; }
    .metric-card > strong { display: block; margin-top: 13px; font: 700 27px/1.15 Manrope, sans-serif; }
    .metric-card > small { display: block; margin-top: 5px; color: #919b95; font-size: 10px; }
    .total-card .metric-icon { color: #476c5e; background: #edf3ef; }.positive-card .metric-icon { color: #23835f; background: #e7f4ed; }.neutral-card .metric-icon { color: #a27634; background: #f8f1e4; }.negative-card .metric-icon { color: #bd655c; background: #faeeec; }
    .positive-card > strong { color: #267b5e; }.neutral-card > strong { color: #9b7335; }.negative-card > strong { color: #b85d55; }
    .content-grid { display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(270px, .85fr); gap: 16px; }
    .panel-title { min-height: 67px; }.subtle-tag { padding: 5px 8px; color: #75827b; background: #f4f7f4; border-radius: 4px; font-size: 10px; }
    .distribution-body { display: flex; align-items: center; gap: clamp(24px, 5vw, 60px); min-height: 196px; padding: 28px 24px; }
    .chart-box { position: relative; width: 170px; height: 170px; flex: 0 0 170px; }.chart-center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none; }
    .chart-center strong { font: 700 23px/1.1 Manrope, sans-serif; }.chart-center span { margin-top: 3px; color: var(--muted); font-size: 9px; }
    .sentiment-list { display: grid; flex: 1; gap: 18px; }.sentiment-label { display: flex; align-items: center; gap: 8px; margin-bottom: 7px; color: #66736c; font-size: 11px; }.sentiment-label strong { margin-left: auto; color: var(--ink); font-size: 11px; }
    .swatch { width: 7px; height: 7px; border-radius: 2px; }.positive-swatch { background: #48a77b; }.neutral-swatch { background: #d3a250; }.negative-swatch { background: #d3756c; }
    .track { height: 5px; overflow: hidden; background: #eff2ef; border-radius: 10px; }.fill { display: block; height: 100%; min-width: 2px; border-radius: inherit; }.positive-fill { background: #48a77b; }.neutral-fill { background: #d3a250; }.negative-fill { background: #d3756c; }
    .insight-panel { padding: 21px; background: #fbfcfa; }.insight-symbol { display: grid; width: 35px; height: 35px; place-items: center; margin-bottom: 18px; color: #8c692b; background: #f7f0df; border-radius: 9px; }.insight-symbol .material-icons { font-size: 19px; }
    .insight-panel .eyebrow { margin-bottom: 7px; font-size: 9px; }.insight-panel h2 { font-size: 17px; }.insight-panel > p { margin: 9px 0 17px; color: var(--muted); font-size: 11px; }
    .text-action { display: flex; align-items: center; gap: 8px; width: 100%; padding: 12px 0 0; color: var(--green-dark); background: none; border: 0; border-top: 1px solid var(--line); text-align: left; font-size: 11px; font-weight: 700; }.text-action .material-icons { font-size: 17px; }.text-action .arrow { margin-left: auto; }.text-action:disabled { opacity: .6; }
    .summary { margin-top: 15px; padding: 12px; background: #f2f7f3; border-radius: 5px; }.summary h3 { margin: 0; font-size: 11px; }.summary p { margin: 5px 0 0; color: #66736c; font-size: 11px; }
    .empty-panel { padding: 54px 20px; text-align: center; }.empty-icon { display: grid; width: 54px; height: 54px; place-items: center; margin: 0 auto 17px; color: var(--green); background: var(--green-soft); border-radius: 15px; }.empty-icon .material-icons { font-size: 26px; }.empty-panel h2 { font-size: 17px; }.empty-panel > p { max-width: 380px; margin: 8px auto 20px; color: var(--muted); font-size: 12px; }.empty-actions { display: flex; justify-content: center; gap: 10px; }
    @media (max-width: 950px) { .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }.content-grid { grid-template-columns: 1fr; } }
    @media (max-width: 500px) { .toolbar, .toolbar-actions { align-items: stretch; flex-direction: column; }.product-select { width: 100%; }.metric-grid { gap: 9px; }.metric-card { padding: 13px; }.metric-top { align-items: flex-start; }.metric-icon { width: 28px; height: 28px; }.metric-card > strong { font-size: 23px; }.distribution-body { flex-direction: column; padding: 22px; }.sentiment-list { width: 100%; }.empty-actions { align-items: stretch; flex-direction: column; } }
  `],
})
export class DashboardPageComponent implements OnInit {
  private readonly api = inject(DashboardApi);
  private readonly reviews = inject(ReviewApi);
  readonly products = signal<string[]>([]);
  readonly product = signal('');
  readonly stats = signal<DashboardStats | null>(null);
  readonly loadError = signal(false);
  readonly summary = signal<SummaryResponse | null>(null);
  readonly summarizing = signal(false);

  readonly exportUrl = computed(() => this.reviews.exportUrl(this.product()));
  readonly chartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const s = this.stats();
    return {
      labels: ['Positif', 'Neutre', 'Négatif'],
      datasets: [{
        data: s ? [s.positive, s.neutral, s.negative] : [0, 0, 0],
        backgroundColor: SENTIMENT_COLORS,
        borderColor: '#fff',
        borderWidth: 2,
      }],
    };
  });
  readonly chartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '62%',
    plugins: { legend: { display: false } },
  };

  ngOnInit() { this.refresh(); }

  refresh() {
    this.api.products().subscribe({ next: (items) => this.products.set(items), error: () => {} });
    this.loadStats();
  }

  selectProduct(event: Event) {
    this.product.set((event.target as HTMLSelectElement).value);
    this.summary.set(null);
    this.loadStats();
  }

  summarize() {
    this.summarizing.set(true);
    this.api.summarizeNegatives(this.product()).subscribe({
      next: (result) => { this.summary.set(result); this.summarizing.set(false); },
      error: () => this.summarizing.set(false),
    });
  }

  private loadStats() {
    this.stats.set(null);
    this.loadError.set(false);
    this.api.stats(this.product()).subscribe({
      next: (result) => this.stats.set(result),
      error: () => this.loadError.set(true),
    });
  }
}
