import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration } from 'chart.js';
import { catchError, forkJoin, map, of } from 'rxjs';
import { DashboardApi } from '../../../core/api/dashboard-api.service';
import { ReviewApi } from '../../../core/api/review-api.service';
import { DashboardStats, Review, SummaryResponse } from '../../../core/models/models';
import { formatNumber, formatRelative, netScore, verdictOf } from '../../../core/format';

/** Mêmes couleurs que le design system : positif / neutre / négatif. */
export const SENTIMENT_COLORS = ['#1a9a6c', '#8a94a6', '#e0533f'];
/** Nombre maximum de produits comparés (une requête de statistiques par produit). */
const MAX_PRODUCTS = 15;

export interface ProductRow { product: string; stats: DashboardStats; }

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [RouterLink, BaseChartDirective],
  template: `
    <header class="page-header">
      <div>
        <h1>Vue d'ensemble</h1>
        <p class="subtitle">{{ product() ? 'Produit : ' + product() : 'Ce que vos clients pensent de l’ensemble de vos produits' }}</p>
      </div>
      <div class="page-actions">
        <label class="sr-only" for="product-filter">Filtrer par produit</label>
        <select id="product-filter" class="select product-select" [value]="product()" (change)="selectProduct($any($event.target).value)">
          <option value="">Tous les produits</option>
          @for (item of products(); track item) { <option [value]="item">{{ item }}</option> }
        </select>
        <a class="btn btn-secondary" [href]="exportUrl()" download="avis.csv"><span class="icon">download</span>Exporter</a>
        <a class="btn btn-primary" routerLink="/import"><span class="icon">upload</span>Importer des avis</a>
      </div>
    </header>

    @if (stats(); as s) {
      @if (s.total > 0) {
        <!-- 1. Verdict -->
        @if (verdict(); as v) {
          <section class="card verdict fade-in" [class]="'card verdict fade-in ' + v.tone">
            <span class="verdict-icon"><span class="icon fill">{{ v.tone === 'pos' ? 'sentiment_very_satisfied' : v.tone === 'neg' ? 'warning' : 'balance' }}</span></span>
            <div class="verdict-text">
              <h2>{{ v.title }}</h2>
              <p>{{ v.message }}</p>
            </div>
            <div class="net-score" title="Score net = % positifs − % négatifs">
              <span class="net-value tabular">{{ net() > 0 ? '+' : net() < 0 ? '−' : '' }}{{ abs(net()) }}</span>
              <span class="net-label">Score net</span>
            </div>
          </section>
        }

        <!-- 2. Indicateurs -->
        <section class="kpi-grid" aria-label="Indicateurs clés">
          <article class="card kpi"><div class="kpi-label"><span class="icon">forum</span>Avis analysés</div><div class="kpi-value">{{ fmt(s.total) }}</div><div class="kpi-meta">{{ product() || 'Tous les produits' }}</div></article>
          <article class="card kpi"><div class="kpi-label"><span class="dot pos"></span>Positifs</div><div class="kpi-value">{{ s.positivePct }}%</div><div class="kpi-meta">{{ fmt(s.positive) }} avis</div></article>
          <article class="card kpi"><div class="kpi-label"><span class="dot neu"></span>Neutres</div><div class="kpi-value">{{ s.neutralPct }}%</div><div class="kpi-meta">{{ fmt(s.neutral) }} avis</div></article>
          <article class="card kpi"><div class="kpi-label"><span class="dot neg"></span>Négatifs</div><div class="kpi-value">{{ s.negativePct }}%</div><div class="kpi-meta">{{ fmt(s.negative) }} avis</div></article>
        </section>

        <div class="grid-2">
          <!-- 3. Répartition -->
          <section class="card">
            <div class="card-header"><div><h2>Répartition des sentiments</h2><p class="card-subtitle">Sur {{ fmt(s.total) }} avis</p></div></div>
            <div class="card-body distribution">
              <div class="chart-box">
                <canvas baseChart type="doughnut" [data]="chartData()" [options]="chartOptions" role="img" [attr.aria-label]="s.positivePct + '% positifs, ' + s.neutralPct + '% neutres, ' + s.negativePct + '% négatifs'"></canvas>
                <div class="chart-center"><strong class="tabular">{{ s.positivePct }}%</strong><span>positifs</span></div>
              </div>
              <ul class="legend">
                <li><span class="dot pos"></span><span>Positif</span><strong class="tabular">{{ s.positivePct }}%</strong><span class="muted tabular">{{ fmt(s.positive) }}</span></li>
                <li><span class="dot neu"></span><span>Neutre</span><strong class="tabular">{{ s.neutralPct }}%</strong><span class="muted tabular">{{ fmt(s.neutral) }}</span></li>
                <li><span class="dot neg"></span><span>Négatif</span><strong class="tabular">{{ s.negativePct }}%</strong><span class="muted tabular">{{ fmt(s.negative) }}</span></li>
              </ul>
            </div>
          </section>

          <!-- 4. À traiter -->
          <section class="card">
            <div class="card-header">
              <div><h2>Avis à traiter</h2><p class="card-subtitle">Derniers avis négatifs</p></div>
              <a class="link-btn" routerLink="/reviews" [queryParams]="{ label: 'NEGATIVE', product: product() || null }">Tout voir<span class="icon">arrow_forward</span></a>
            </div>
            @if (negatives().length) {
              <ul class="neg-list">
                @for (r of negatives(); track r.id) {
                  <li>
                    <p class="review-text" dir="auto">{{ r.text }}</p>
                    <div class="neg-meta">
                      @if (r.product) { <span class="tag">{{ r.product }}</span> }
                      <span class="muted">{{ relative(r.createdAt) }}</span>
                    </div>
                  </li>
                }
              </ul>
              <div class="card-footer summary-zone">
                @if (summary(); as res) {
                  <div class="summary fade-in">
                    <div class="summary-title"><span class="icon fill">auto_awesome</span>Résumé IA · {{ res.reviewsUsed }} avis</div>
                    <p dir="auto">{{ res.summary }}</p>
                  </div>
                } @else {
                  <button class="btn btn-secondary btn-sm" type="button" (click)="summarize()" [disabled]="summarizing()">
                    <span class="icon">auto_awesome</span>{{ summarizing() ? 'Résumé en cours…' : 'Résumer les avis négatifs avec l’IA' }}
                  </button>
                  <span class="hint">Modèle BART (anglais) · consomme 1 crédit</span>
                }
              </div>
            } @else {
              <div class="empty-state compact"><div class="empty-icon"><span class="icon">task_alt</span></div><h3>Aucun avis négatif</h3><p>Rien à traiter pour le moment.</p></div>
            }
          </section>
        </div>

        <!-- 5. Par produit -->
        @if (productRows().length > 1 || (productRows().length === 1 && !product())) {
          <section class="card products">
            <div class="card-header"><div><h2>Satisfaction par produit</h2><p class="card-subtitle">Les produits les plus critiqués en premier · cliquez pour filtrer</p></div></div>
            <div class="table-wrap">
              <table class="table">
                <thead><tr><th>Produit</th><th class="num">Avis</th><th class="bar-col">Répartition</th><th class="num">Positifs</th><th class="num">Négatifs</th><th></th></tr></thead>
                <tbody>
                  @for (row of productRows(); track row.product) {
                    <tr class="clickable" [class.selected]="row.product === product()" (click)="selectProduct(row.product === product() ? '' : row.product)">
                      <td><strong>{{ row.product }}</strong>@if (row.stats.negativePct >= 35) { <span class="tag warn">À surveiller</span> }</td>
                      <td class="num tabular">{{ fmt(row.stats.total) }}</td>
                      <td class="bar-col"><div class="stack-bar" [attr.aria-label]="row.stats.positivePct + '% positifs'"><span class="pos" [style.width.%]="row.stats.positivePct"></span><span class="neu" [style.width.%]="row.stats.neutralPct"></span><span class="neg" [style.width.%]="row.stats.negativePct"></span></div></td>
                      <td class="num tabular pos-text">{{ row.stats.positivePct }}%</td>
                      <td class="num tabular neg-text">{{ row.stats.negativePct }}%</td>
                      <td class="num"><span class="icon chevron">{{ row.product === product() ? 'close' : 'filter_alt' }}</span></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      } @else {
        @if (product()) {
          <section class="card"><div class="empty-state"><div class="empty-icon"><span class="icon">filter_alt_off</span></div><h3>Aucun avis pour ce produit</h3><p>Choisissez un autre produit ou revenez à l’ensemble.</p><div class="page-actions"><button class="btn btn-secondary" type="button" (click)="selectProduct('')">Tous les produits</button></div></div></section>
        } @else {
          <section class="card onboarding fade-in">
            <div class="onboarding-intro">
              <span class="empty-icon"><span class="icon">rocket_launch</span></span>
              <h2>Aucun avis pour le moment</h2>
              <p>Ajoutez vos premiers avis : le tableau de bord indiquera en un coup d’œil si vos clients sont satisfaits.</p>
            </div>
            <ol class="steps">
              <li><span class="step-num">1</span><div><h3>Importez un fichier CSV</h3><p>Une colonne texte, une colonne produit. Excel accepté.</p><a class="btn btn-primary btn-sm" routerLink="/import"><span class="icon">upload</span>Importer</a></div></li>
              <li><span class="step-num">2</span><div><h3>Ou analysez un avis</h3><p>Collez un commentaire en français, anglais ou arabe.</p><a class="btn btn-secondary btn-sm" routerLink="/analyze"><span class="icon">edit_note</span>Analyser</a></div></li>
              <li><span class="step-num">3</span><div><h3>Suivez la satisfaction</h3><p>Répartition, produits à surveiller et avis à traiter.</p></div></li>
            </ol>
          </section>
        }
      }
    } @else if (loadError()) {
      <section class="card"><div class="empty-state"><div class="empty-icon error"><span class="icon">cloud_off</span></div><h3>Serveur injoignable</h3><p>Le backend Spring Boot ne répond pas sur le port 8080. Démarrez-le puis réessayez.</p><div class="page-actions"><button class="btn btn-primary" type="button" (click)="refresh()"><span class="icon">refresh</span>Réessayer</button></div></div></section>
    } @else {
      <div class="skeletons" aria-busy="true" aria-label="Chargement">
        <span class="skeleton" style="height: 88px"></span>
        <div class="kpi-grid">@for (i of [1, 2, 3, 4]; track i) { <span class="skeleton" style="height: 118px"></span> }</div>
        <div class="grid-2"><span class="skeleton" style="height: 300px"></span><span class="skeleton" style="height: 300px"></span></div>
      </div>
    }
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .product-select { width: 220px; }
    .verdict { display: flex; align-items: center; gap: 16px; margin-bottom: 16px; padding: 18px 22px; border-left: 4px solid var(--neu); }
    .verdict.pos { border-left-color: var(--pos); } .verdict.neg { border-left-color: var(--neg); }
    .verdict-icon { display: grid; place-items: center; width: 44px; height: 44px; flex: 0 0 auto; border-radius: 12px; color: var(--neu-text); background: var(--neu-soft); }
    .verdict.pos .verdict-icon { color: var(--pos); background: var(--pos-soft); } .verdict.neg .verdict-icon { color: var(--neg); background: var(--neg-soft); }
    .verdict-icon .icon { font-size: 26px; }
    .verdict-text { flex: 1; } .verdict-text p { margin-top: 2px; color: var(--text-2); }
    .net-score { display: grid; justify-items: end; padding-left: 20px; border-left: 1px solid var(--border); }
    .net-value { font-size: 26px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
    .verdict.pos .net-value { color: var(--pos-text); } .verdict.neg .net-value { color: var(--neg-text); }
    .net-label { color: var(--text-3); font-size: 12.5px; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
    .grid-2 { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr); align-items: start; gap: 16px; margin-bottom: 16px; }
    .distribution { display: flex; align-items: center; gap: 32px; }
    .chart-box { position: relative; width: 190px; height: 190px; flex: 0 0 190px; }
    .chart-center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none; }
    .chart-center strong { font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; }
    .chart-center span { color: var(--text-3); font-size: 13px; }
    .legend { display: grid; flex: 1; gap: 14px; margin: 0; padding: 0; list-style: none; }
    .legend li { display: grid; grid-template-columns: auto 1fr auto 44px; align-items: center; gap: 10px; color: var(--text-2); }
    .legend li .muted { text-align: right; font-size: 13px; }
    .neg-list { margin: 0; padding: 4px 0; list-style: none; }
    .neg-list li { padding: 12px 20px; border-bottom: 1px solid var(--border); }
    .neg-list li:last-child { border-bottom: 0; }
    .neg-meta { display: flex; align-items: center; gap: 10px; margin-top: 6px; font-size: 12.5px; }
    .summary-zone { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .summary { width: 100%; }
    .summary-title { display: flex; align-items: center; gap: 6px; color: var(--brand-600); font-size: 13px; font-weight: 600; }
    .summary-title .icon { font-size: 18px; }
    .summary p { margin-top: 4px; color: var(--text-2); }
    .empty-state.compact { padding: 32px 20px; }
    .empty-icon.error { color: var(--neg); background: var(--neg-soft); }
    .products .num { text-align: right; } .products .bar-col { width: 34%; min-width: 160px; }
    .products tr.selected { background: var(--brand-50); }
    .products .tag { margin-left: 8px; } .tag.warn { color: #8a5a12; background: var(--warn-soft); }
    .pos-text { color: var(--pos-text); } .neg-text { color: var(--neg-text); }
    .chevron { color: var(--text-4); font-size: 18px; }
    .onboarding { padding: 32px; }
    .onboarding-intro { display: grid; justify-items: center; gap: 8px; max-width: 520px; margin: 0 auto 28px; text-align: center; }
    .onboarding-intro p { color: var(--text-3); }
    .onboarding .empty-icon { display: grid; place-items: center; width: 48px; height: 48px; margin-bottom: 4px; color: var(--brand); background: var(--brand-50); border-radius: 12px; }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 0; padding: 0; list-style: none; }
    .steps li { display: flex; gap: 12px; padding: 18px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r); }
    .steps p { margin: 4px 0 12px; color: var(--text-3); font-size: 13px; }
    .step-num { display: grid; place-items: center; width: 26px; height: 26px; flex: 0 0 auto; color: var(--brand-600); background: var(--brand-100); border-radius: 50%; font-size: 13px; font-weight: 700; }
    .skeletons { display: grid; gap: 16px; } .skeletons .kpi-grid, .skeletons .grid-2 { margin: 0; }
    @media (max-width: 1100px) { .grid-2 { grid-template-columns: 1fr; } }
    @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .steps { grid-template-columns: 1fr; } }
    @media (max-width: 560px) {
      .verdict { flex-wrap: wrap; } .net-score { justify-items: start; padding: 12px 0 0; border: 0; border-top: 1px solid var(--border); width: 100%; }
      .distribution { flex-direction: column; } .legend { width: 100%; } .product-select { width: 100%; }
    }
  `],
})
export class DashboardPageComponent implements OnInit {
  private readonly api = inject(DashboardApi);
  private readonly reviews = inject(ReviewApi);
  readonly products = signal<string[]>([]);
  readonly productRows = signal<ProductRow[]>([]);
  readonly product = signal('');
  readonly stats = signal<DashboardStats | null>(null);
  readonly negatives = signal<Review[]>([]);
  readonly loadError = signal(false);
  readonly summary = signal<SummaryResponse | null>(null);
  readonly summarizing = signal(false);

  readonly fmt = formatNumber;
  readonly abs = Math.abs;
  readonly relative = (iso?: string) => formatRelative(iso);
  readonly exportUrl = computed(() => this.reviews.exportUrl(this.product()));
  readonly verdict = computed(() => { const s = this.stats(); return s && s.total ? verdictOf(s) : null; });
  readonly net = computed(() => { const s = this.stats(); return s ? netScore(s) : 0; });
  readonly chartData = computed<ChartConfiguration<'doughnut'>['data']>(() => {
    const s = this.stats();
    return {
      labels: ['Positif', 'Neutre', 'Négatif'],
      datasets: [{ data: s ? [s.positive, s.neutral, s.negative] : [0, 0, 0], backgroundColor: SENTIMENT_COLORS, borderColor: '#fff', borderWidth: 3, hoverOffset: 4 }],
    };
  });
  readonly chartOptions: ChartConfiguration<'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '74%',
    plugins: { legend: { display: false }, tooltip: { padding: 10, cornerRadius: 8, displayColors: true } },
  };

  ngOnInit() { this.refresh(); }

  refresh() {
    this.loadStats();
    this.api.products().subscribe({
      next: (items) => { this.products.set(items); this.loadProductRows(items); },
      error: () => {},
    });
  }

  selectProduct(value: string) {
    this.product.set(value);
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
    this.reviews.list(this.product(), 'NEGATIVE', 0, 5).subscribe({
      next: (page) => this.negatives.set(page.content),
      error: () => this.negatives.set([]),
    });
  }

  /** Une requête de statistiques par produit, triées : les plus critiqués d'abord. */
  private loadProductRows(items: string[]) {
    if (!items.length) { this.productRows.set([]); return; }
    forkJoin(items.slice(0, MAX_PRODUCTS).map((p) =>
      this.api.stats(p).pipe(map((stats) => ({ product: p, stats })), catchError(() => of(null)))
    )).subscribe((rows) => {
      this.productRows.set(
        rows.filter((r): r is ProductRow => !!r && r.stats.total > 0)
          .sort((a, b) => b.stats.negativePct - a.stats.negativePct || b.stats.total - a.stats.total)
      );
    });
  }
}
