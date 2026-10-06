import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, TooltipItem } from 'chart.js';
import { catchError, debounceTime, forkJoin, map, of } from 'rxjs';
import { NotificationService } from '../../../core/notifications/notification.service';
import { DashboardApi } from '../../../core/api/dashboard-api.service';
import { ReviewApi } from '../../../core/api/review-api.service';
import { DashboardStats, Review, SummaryResponse, TrendPoint } from '../../../core/models/models';
import {
  SATISFACTION_FORMULA, SATISFACTION_RULES, formatDateTime, formatNumber, formatPct, formatRelative,
  netScore, roundPercents, smoothedNegativeRate, statsFromCounts, verdictOf,
} from '../../../core/format';
import { frequentWords } from '../../../core/language';
import { SENTIMENT_COLORS, SENTIMENT_HEX } from '../../../core/theme';
import { StatCardComponent } from '../../../shared/stat-card/stat-card.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../../shared/states/states.component';
import { ReviewDetailDrawerComponent } from '../../../shared/review-detail/review-detail-drawer.component';

export { SENTIMENT_COLORS } from '../../../core/theme';

/** Nombre maximum de produits comparés (une requête de statistiques par produit). */
const MAX_PRODUCTS = 15;
/** Avis négatifs chargés : ceux que le résumé IA lit côté serveur (les 30 plus récents). */
const NEGATIVES_FOR_SUMMARY = 30;
/** Période du graphique quand « Tout » est sélectionné. */
const DEFAULT_TREND_DAYS = 90;

export interface ProductRow { product: string; stats: DashboardStats; priority: number; }

export const PERIODS: { days: number | null; label: string; long: string }[] = [
  { days: 7, label: '7 j', long: '7 derniers jours' },
  { days: 30, label: '30 j', long: '30 derniers jours' },
  { days: 90, label: '90 j', long: '90 derniers jours' },
  { days: null, label: 'Tout', long: 'Toute la période' },
];

interface TrendBucket { label: string; title: string; positive: number; neutral: number; negative: number; }

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [RouterLink, BaseChartDirective, StatCardComponent, EmptyStateComponent, ErrorStateComponent, ReviewDetailDrawerComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Tableau de bord
          @if (live.connected()) { <span class="live-pill" title="Chaque nouvel avis client met ce tableau de bord à jour automatiquement"><span class="pulse"></span>Temps réel</span> }
        </h1>
        <p class="subtitle">Comprenez la satisfaction client et identifiez les priorités.</p>
      </div>
      <div class="page-actions">
        <div class="segmented" role="group" aria-label="Période">
          @for (p of periods; track p.label) {
            <button type="button" [class.active]="days() === p.days" [attr.aria-pressed]="days() === p.days" (click)="selectPeriod(p.days)">{{ p.label }}</button>
          }
        </div>
        <label class="sr-only" for="product-filter">Filtrer par produit</label>
        <select id="product-filter" class="select product-select" [value]="product()" (change)="selectProduct($any($event.target).value)">
          <option value="">Tous les produits</option>
          @for (item of products(); track item) { <option [value]="item">{{ item }}</option> }
        </select>
        <button class="btn btn-secondary" type="button" (click)="exportCsv()" [class.is-loading]="exporting()"
                [title]="product() ? 'Exporte tous les avis de « ' + product() + ' » (toutes périodes)' : 'Exporte tous les avis (toutes périodes)'">
          <span class="icon">download</span>Export CSV
        </button>
      </div>
    </header>

    @if (stats(); as s) {
      @if (s.total > 0) {
        <!-- 1. Synthèse -->
        @if (verdict(); as v) {
          <section class="card synthesis fade-in" [class]="'card synthesis fade-in ' + v.tone" aria-labelledby="verdict-title">
            <div class="verdict">
              <span class="verdict-badge" [class]="'verdict-badge ' + v.tone"><span class="icon fill">{{ verdictIcon(v.tone) }}</span>{{ v.short }}</span>
              <h2 id="verdict-title">{{ v.title }}</h2>
              <p>{{ v.message }}</p>
              <details class="formula">
                <summary><span class="icon">info</span>Comment ce score est-il calculé ?</summary>
                <p>{{ formula }}</p>
                <p>Verdict « Satisfaits » dès {{ rules.satisfiedMinPositivePct }} % d’avis positifs, « À surveiller » dès {{ rules.watchMinNegativePct }} % d’avis négatifs, « Avis partagés » sinon.
                  Le score repose sur le sentiment détecté par l’IA dans le texte : il est distinct de la note moyenne en étoiles.</p>
              </details>
            </div>
            <div class="score-zone">
              <div class="score">
                <span class="score-label">Score de satisfaction</span>
                <span class="score-value tabular">{{ signed(net()) }}<small> / 100</small></span>
                <div class="gauge" role="img" [attr.aria-label]="'Score net ' + signed(net()) + ' sur une échelle de −100 à +100'">
                  <span class="gauge-marker" [style.left.%]="(net() + 100) / 2"></span>
                </div>
                <div class="gauge-scale"><span>−100</span><span>0</span><span>+100</span></div>
              </div>
              <dl class="facts">
                <div><dt>Avis analysés</dt><dd class="tabular">{{ fmt(s.total) }}</dd></div>
                <div><dt>Évolution</dt>
                  <dd>
                    @if (evolution(); as e) {
                      <span class="delta" [class.up]="e.delta > 0" [class.down]="e.delta < 0"><span class="icon">{{ e.delta > 0 ? 'trending_up' : e.delta < 0 ? 'trending_down' : 'trending_flat' }}</span>{{ signed(e.delta) }} pts</span>
                      <small class="muted">vs les {{ days() }} jours précédents</small>
                    } @else {
                      <small class="muted">{{ days() ? 'Pas assez d’avis sur la période précédente' : 'Choisissez une période pour comparer' }}</small>
                    }
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        }

        <!-- 2. Indicateurs -->
        <section class="kpi-grid" aria-label="Indicateurs clés">
          <app-stat-card label="Avis analysés" icon="forum" [value]="fmt(s.total)" [meta]="(product() || 'Tous les produits') + ' · ' + periodLong().toLowerCase()" />
          <app-stat-card label="Positifs" tone="pos" [value]="pctInt(shares()[0])" [bar]="shares()[0]" [meta]="fmt(s.positive) + ' avis'" />
          <app-stat-card label="Neutres" tone="neu" [value]="pctInt(shares()[1])" [bar]="shares()[1]" [meta]="fmt(s.neutral) + ' avis'" />
          <app-stat-card label="Négatifs" tone="neg" [value]="pctInt(shares()[2])" [bar]="shares()[2]" [meta]="fmt(s.negative) + ' avis'" />
        </section>

        <!-- 3. Répartition et tendance -->
        <div class="grid charts">
          <section class="card">
            <div class="card-header plain"><div><h2>Répartition des sentiments</h2><p class="card-subtitle">Part des {{ fmt(s.total) }} avis · {{ periodLong().toLowerCase() }}</p></div></div>
            <div class="card-body distribution">
              <div class="chart-box">
                <canvas baseChart type="doughnut" [data]="chartData()" [options]="chartOptions" role="img"
                        [attr.aria-label]="'Répartition : ' + shares()[0] + ' % positifs, ' + shares()[1] + ' % neutres, ' + shares()[2] + ' % négatifs'"></canvas>
                <div class="chart-center"><strong class="tabular">{{ pctInt(shares()[0]) }}</strong><span>positifs</span></div>
              </div>
              <ul class="legend">
                <li><span class="dot pos"></span><span>Positif</span><strong class="tabular">{{ pctInt(shares()[0]) }}</strong><span class="muted tabular">{{ fmt(s.positive) }}</span></li>
                <li><span class="dot neu"></span><span>Neutre</span><strong class="tabular">{{ pctInt(shares()[1]) }}</strong><span class="muted tabular">{{ fmt(s.neutral) }}</span></li>
                <li><span class="dot neg"></span><span>Négatif</span><strong class="tabular">{{ pctInt(shares()[2]) }}</strong><span class="muted tabular">{{ fmt(s.negative) }}</span></li>
              </ul>
            </div>
          </section>

          <section class="card">
            <div class="card-header plain">
              <div><h2>Évolution des avis</h2><p class="card-subtitle">Nombre d’avis par {{ weekly() ? 'semaine' : 'jour' }} et par sentiment · {{ trendLong() }}</p></div>
            </div>
            <div class="card-body">
              @if (trendError()) {
                <app-error-state [compact]="true" title="Tendance indisponible" message="La série temporelle n’a pas pu être chargée." (retry)="loadTrend()" />
              } @else if (!trendBuckets()) {
                <span class="skeleton" style="height: 220px"></span>
              } @else if (trendTotal() === 0) {
                <app-empty-state [compact]="true" icon="query_stats" title="Aucun avis sur la période" message="Élargissez la période pour voir l’évolution." />
              } @else if (trendTotal() < 3) {
                <div class="few">
                  <p class="muted">Trop peu d’avis ({{ trendTotal() }}) pour dégager une tendance. Détail :</p>
                  <ul>@for (b of nonEmptyBuckets(); track b.title) { <li><span>{{ b.title }}</span><span class="tabular">{{ b.positive }} positif(s) · {{ b.neutral }} neutre(s) · {{ b.negative }} négatif(s)</span></li> }</ul>
                </div>
              } @else {
                <div class="trend-box">
                  <canvas baseChart type="bar" [data]="trendData()" [options]="trendOptions" role="img"
                          [attr.aria-label]="'Évolution sur ' + trendLong() + ' : ' + trendTotal() + ' avis'"></canvas>
                </div>
              }
            </div>
          </section>
        </div>

        <!-- 4. Priorités -->
        <div class="grid priorities">
          <section class="card">
            <div class="card-header plain">
              <div><h2>Produits les plus critiqués</h2><p class="card-subtitle">Taux d’avis négatifs lissé (les produits avec très peu d’avis ne sont pas sur-pénalisés)</p></div>
              <a class="link-btn" routerLink="/products">Catalogue<span class="icon">arrow_forward</span></a>
            </div>
            @if (productRows().length) {
              <ol class="ranking">
                @for (row of productRows().slice(0, 6); track row.product; let i = $index) {
                  <li>
                    <button type="button" [class.selected]="row.product === product()" (click)="selectProduct(row.product === product() ? '' : row.product)"
                            [attr.aria-label]="row.product + ' : ' + row.stats.negativePct + ' % d’avis négatifs sur ' + row.stats.total + ' avis. ' + (row.product === product() ? 'Retirer le filtre' : 'Filtrer le tableau de bord')">
                      <span class="rank tabular">{{ i + 1 }}</span>
                      <span class="rank-main">
                        <span class="rank-name"><strong>{{ row.product }}</strong>@if (row.stats.negativePct >= rules.watchMinNegativePct) { <span class="tag warn">À surveiller</span> }</span>
                        <span class="stack-bar" aria-hidden="true"><span class="pos" [style.width.%]="row.stats.positivePct"></span><span class="neu" [style.width.%]="row.stats.neutralPct"></span><span class="neg" [style.width.%]="row.stats.negativePct"></span></span>
                      </span>
                      <span class="rank-figures"><strong class="tabular neg-text">{{ pct(row.stats.negativePct) }}</strong><small class="muted tabular">{{ fmt(row.stats.total) }} avis</small></span>
                    </button>
                  </li>
                }
              </ol>
            } @else {
              <app-empty-state [compact]="true" icon="inventory_2" title="Aucun produit à classer" message="Les avis rattachés à un produit apparaîtront ici." />
            }
          </section>

          <section class="card">
            <div class="card-header plain">
              <div><h2>Avis négatifs à traiter</h2><p class="card-subtitle">Les plus récents · cliquez pour voir le détail</p></div>
              <a class="link-btn" routerLink="/reviews" [queryParams]="{ label: 'NEGATIVE', product: product() || null }">Tout voir<span class="icon">arrow_forward</span></a>
            </div>
            @if (negatives().length) {
              <ul class="neg-list">
                @for (r of negatives().slice(0, 5); track r.id) {
                  <li>
                    <button type="button" (click)="detail.set(r)">
                      <p class="review-text" dir="auto">{{ r.text }}</p>
                      <span class="neg-meta">
                        @if (r.product) { <span class="tag">{{ r.product }}</span> }
                        <span class="muted">{{ r.authorName ?? 'Import' }} · {{ relative(r.createdAt) }}</span>
                      </span>
                    </button>
                  </li>
                }
              </ul>
            } @else {
              <app-empty-state [compact]="true" icon="task_alt" title="Aucun avis négatif" message="Rien à traiter pour le moment." />
            }
          </section>
        </div>

        <!-- 5. Résumé IA -->
        <section class="card ai" aria-labelledby="ai-title">
          <div class="card-header plain">
            <div class="ai-title">
              <span class="ai-icon"><span class="icon fill">auto_awesome</span></span>
              <div><h2 id="ai-title">Ce que les avis négatifs nous apprennent</h2>
                <p class="card-subtitle">Résumé des {{ negatives().length >= summaryLimit ? summaryLimit + ' derniers' : negatives().length }} avis négatifs{{ product() ? ' de « ' + product() + ' »' : '' }}, toutes périodes</p></div>
            </div>
            @if (negatives().length) {
              <button class="btn" [class]="summary() ? 'btn btn-secondary btn-sm' : 'btn btn-primary btn-sm'" type="button" (click)="summarize()" [class.is-loading]="summarizing()">
                <span class="icon">{{ summary() ? 'refresh' : 'auto_awesome' }}</span>{{ summary() ? 'Régénérer' : 'Générer le résumé IA' }}
              </button>
            }
          </div>
          <div class="card-body ai-body">
            @if (!negatives().length) {
              <p class="muted">Aucun avis négatif à résumer{{ product() ? ' pour ce produit' : '' }}.</p>
            } @else {
              <div class="ai-main">
                @if (summarizing()) {
                  <div class="ai-loading" aria-live="polite"><span class="spinner"></span>Le modèle lit les avis négatifs… (quelques secondes)</div>
                } @else if (summaryError()) {
                  <div class="alert alert-danger" role="alert"><span class="icon">cloud_off</span><div><strong>Résumé indisponible.</strong> {{ summaryError() }}</div></div>
                } @else if (summary()) {
                  <blockquote class="ai-summary fade-in" dir="auto">{{ summary()!.summary }}</blockquote>
                  <p class="ai-meta muted">Généré le {{ summaryDate() }} · {{ summary()!.reviewsUsed }} avis lus · modèle facebook/bart-large-cnn</p>
                } @else {
                  <p class="ai-placeholder">Le modèle de résumé lit les avis négatifs envoyés au serveur et en extrait les irritants récurrents. Rien n’est généré tant que vous ne le demandez pas (chaque résumé consomme un appel Hugging Face).</p>
                }
                <p class="hint">BART est entraîné sur l’anglais : le résumé est plus fiable pour des avis rédigés en anglais.</p>
              </div>
              <aside class="ai-side">
                <h3 class="section-title">Mots fréquents</h3>
                @if (themes().length) {
                  <ul class="themes">@for (t of themes(); track t.word) { <li><span dir="auto">{{ t.word }}</span><span class="tabular">{{ t.count }}</span></li> }</ul>
                  <p class="hint">Comptage des mots dans ces avis (un mot compté une fois par avis), sans IA.</p>
                } @else {
                  <p class="muted small">Aucun mot ne revient dans plusieurs avis.</p>
                }
                <h3 class="section-title sources">Exemples d’avis sources</h3>
                <ul class="sources-list">
                  @for (r of negatives().slice(0, 2); track r.id) { <li><button type="button" class="review-text" dir="auto" (click)="detail.set(r)">« {{ r.text }} »</button></li> }
                </ul>
              </aside>
            }
          </div>
        </section>
      } @else {
        @if (product() || days()) {
          <section class="card">
            <app-empty-state icon="filter_alt_off" title="Aucun avis pour ces filtres" message="Aucun avis ne correspond à ce produit sur cette période.">
              <button class="btn btn-secondary" type="button" (click)="resetFilters()">Tous les produits, toute la période</button>
            </app-empty-state>
          </section>
        } @else {
          <section class="card onboarding fade-in">
            <div class="onboarding-intro">
              <span class="empty-icon"><span class="icon">rocket_launch</span></span>
              <h2>Aucun avis pour le moment</h2>
              <p>Ajoutez vos premiers avis : le tableau de bord indiquera en un coup d’œil si vos clients sont satisfaits.</p>
            </div>
            <ol class="steps">
              <li><span class="step-num">1</span><div><h3>Importez un fichier CSV</h3><p>Une colonne texte, une colonne produit. Excel accepté.</p><a class="btn btn-primary btn-sm" routerLink="/import"><span class="icon">upload</span>Importer</a></div></li>
              <li><span class="step-num">2</span><div><h3>Ou analysez un avis</h3><p>Collez un commentaire en français, anglais ou arabe.</p><a class="btn btn-secondary btn-sm" routerLink="/analyze"><span class="icon">psychology</span>Analyser</a></div></li>
              <li><span class="step-num">3</span><div><h3>Suivez la satisfaction</h3><p>Répartition, tendance, produits à surveiller et avis à traiter.</p></div></li>
            </ol>
          </section>
        }
      }
    } @else if (loadError()) {
      <section class="card"><app-error-state (retry)="refresh()" /></section>
    } @else {
      <div class="skeletons" aria-busy="true" aria-label="Chargement du tableau de bord">
        <span class="skeleton" style="height: 168px"></span>
        <div class="kpi-grid">@for (i of [1, 2, 3, 4]; track i) { <span class="skeleton" style="height: 118px"></span> }</div>
        <div class="grid charts"><span class="skeleton" style="height: 300px"></span><span class="skeleton" style="height: 300px"></span></div>
      </div>
    }

    <app-review-detail-drawer [review]="detail()" (closed)="detail.set(null)" (deleted)="refresh(true)" />
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    h1 { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .product-select { width: 210px; }
    .live-pill { display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 10px; color: var(--pos-text); background: var(--pos-soft); border-radius: 99px; font-size: 12px; font-weight: 600; letter-spacing: 0; }
    .pulse { width: 7px; height: 7px; background: var(--pos); border-radius: 50%; animation: pulse 1.8s infinite; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(22, 165, 121, .45); } 70% { box-shadow: 0 0 0 7px rgba(22, 165, 121, 0); } 100% { box-shadow: 0 0 0 0 rgba(22, 165, 121, 0); } }

    /* Synthèse */
    .synthesis { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); margin-bottom: 16px; overflow: hidden; }
    .verdict { display: grid; gap: 8px; align-content: start; padding: 24px; }
    .verdict h2 { font-size: 20px; line-height: 1.3; letter-spacing: -.02em; }
    .verdict > p { color: var(--text-2); font-size: 14px; }
    .verdict-badge { display: inline-flex; align-items: center; gap: 6px; justify-self: start; height: 28px; padding: 0 12px 0 9px; border-radius: 99px; font-size: 13px; font-weight: 650; }
    .verdict-badge .icon { font-size: 18px; }
    .verdict-badge.pos { color: var(--pos-text); background: var(--pos-soft); } .verdict-badge.neu { color: var(--neu-text); background: var(--neu-soft); } .verdict-badge.neg { color: var(--neg-text); background: var(--neg-soft); }
    .formula { margin-top: 6px; color: var(--text-2); font-size: 13px; }
    .formula summary { display: inline-flex; align-items: center; gap: 6px; color: var(--primary-text); font-weight: 550; cursor: pointer; list-style: none; border-radius: var(--r-sm); }
    .formula summary::-webkit-details-marker { display: none; }
    .formula summary .icon { font-size: 17px; }
    .formula p { margin-top: 8px; padding-left: 23px; line-height: 1.55; }
    .score-zone { display: grid; gap: 18px; align-content: center; padding: 24px; background: var(--surface-2); border-left: 1px solid var(--border); }
    .score { display: grid; gap: 4px; }
    .score-label { color: var(--text-3); font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    .score-value { font-size: 40px; line-height: 1.1; font-weight: 700; letter-spacing: -.035em; color: var(--navy); }
    .score-value small { color: var(--text-4); font-size: 16px; font-weight: 550; letter-spacing: 0; }
    .synthesis.pos .score-value { color: var(--pos-text); } .synthesis.neg .score-value { color: var(--neg-text); }
    .gauge { position: relative; height: 8px; margin-top: 8px; border-radius: 99px; background: linear-gradient(90deg, var(--neg) 0%, var(--neu) 50%, var(--pos) 100%); opacity: .9; }
    .gauge-marker { position: absolute; top: 50%; width: 16px; height: 16px; background: var(--surface); border: 3px solid var(--navy); border-radius: 50%; transform: translate(-50%, -50%); box-shadow: var(--shadow-sm); }
    .gauge-scale { display: flex; justify-content: space-between; color: var(--text-3); font-size: 11.5px; }
    .facts { display: grid; grid-template-columns: auto 1fr; gap: 24px; margin: 0; padding-top: 16px; border-top: 1px solid var(--border); }
    .facts dt { color: var(--text-3); font-size: 12px; font-weight: 550; } .facts dd { display: grid; margin: 2px 0 0; font-size: 18px; font-weight: 650; }
    .facts dd small { font-size: 12px; font-weight: 400; }
    .delta { display: inline-flex; align-items: center; gap: 4px; color: var(--text-2); }
    .delta .icon { font-size: 20px; } .delta.up { color: var(--pos-text); } .delta.down { color: var(--neg-text); }

    /* Grilles */
    .grid { display: grid; gap: 16px; margin-bottom: 16px; }
    .grid > * { min-width: 0; }
    .charts { grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr); }
    .priorities { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); align-items: start; }
    .distribution { display: flex; align-items: center; gap: 28px; }
    .chart-box { position: relative; width: 168px; height: 168px; flex: 0 0 168px; }
    .chart-center { position: absolute; inset: 0; display: grid; place-content: center; text-align: center; pointer-events: none; }
    .chart-center strong { font-size: 26px; font-weight: 700; letter-spacing: -.03em; line-height: 1.1; }
    .chart-center span { color: var(--text-3); font-size: 12.5px; }
    .legend { display: grid; flex: 1; gap: 12px; margin: 0; padding: 0; list-style: none; }
    .legend li { display: grid; grid-template-columns: auto 1fr auto 48px; align-items: center; gap: 10px; padding-bottom: 12px; color: var(--text-2); border-bottom: 1px solid var(--border); }
    .legend li:last-child { padding-bottom: 0; border-bottom: 0; }
    .legend strong { color: var(--text); font-weight: 650; }
    .legend li .muted { text-align: end; font-size: 13px; }
    .trend-box { position: relative; height: 230px; }
    .few ul { display: grid; gap: 6px; margin: 10px 0 0; padding: 0; list-style: none; font-size: 13px; }
    .few li { display: flex; justify-content: space-between; gap: 12px; padding: 8px 10px; background: var(--surface-2); border-radius: var(--r); }

    /* Classement produits */
    .ranking { margin: 0; padding: 6px 8px 10px; list-style: none; }
    .ranking button { display: grid; grid-template-columns: 24px minmax(0, 1fr) auto; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; background: none; border: 0; border-radius: var(--r); text-align: start; }
    .ranking button:hover { background: var(--surface-2); } .ranking button.selected { background: var(--primary-50); }
    .rank { display: grid; place-items: center; width: 24px; height: 24px; color: var(--text-2); background: var(--surface-3); border-radius: 50%; font-size: 12px; font-weight: 650; }
    .rank-main { display: grid; gap: 7px; min-width: 0; }
    .rank-name { display: flex; align-items: center; gap: 8px; min-width: 0; }
    .rank-name strong { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .rank-figures { display: grid; justify-items: end; line-height: 1.25; } .rank-figures small { font-size: 12px; }

    /* Avis à traiter */
    .neg-list { margin: 0; padding: 4px 8px 10px; list-style: none; }
    .neg-list button { display: grid; gap: 6px; width: 100%; padding: 10px 12px; background: none; border: 0; border-radius: var(--r); text-align: start; }
    .neg-list button:hover { background: var(--surface-2); }
    .neg-list .review-text { border-left: 3px solid var(--neg); padding-left: 10px; }
    .neg-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-left: 13px; font-size: 12.5px; }

    /* Résumé IA */
    .ai { margin-bottom: 0; }
    .ai-title { display: flex; align-items: flex-start; gap: 12px; }
    .ai-icon { display: grid; place-items: center; width: 36px; height: 36px; flex: 0 0 auto; color: var(--primary); background: var(--primary-50); border-radius: var(--r); }
    .ai-icon .icon { font-size: 20px; }
    .ai-body { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(240px, 1fr); gap: 24px; padding-top: 12px; }
    .ai-main { display: grid; gap: 12px; align-content: start; }
    .ai-summary { margin: 0; padding: 16px 18px; color: var(--text); background: var(--primary-50); border-left: 3px solid var(--primary); border-radius: 0 var(--r) var(--r) 0; font-size: 14.5px; line-height: 1.65; unicode-bidi: plaintext; }
    .ai-meta { font-size: 12.5px; }
    .ai-loading { display: flex; align-items: center; gap: 10px; padding: 16px; color: var(--text-2); background: var(--surface-2); border-radius: var(--r); }
    .ai-placeholder { padding: 16px; color: var(--text-2); background: var(--surface-2); border: 1px dashed var(--border-strong); border-radius: var(--r); line-height: 1.6; }
    .ai-side { padding-left: 24px; border-left: 1px solid var(--border); }
    .ai-side .section-title { margin-bottom: 10px; } .ai-side .sources { margin-top: 18px; }
    .themes { display: flex; flex-wrap: wrap; gap: 6px; margin: 0 0 8px; padding: 0; list-style: none; }
    .themes li { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 4px 0 10px; color: var(--neg-text); background: var(--neg-soft); border-radius: 99px; font-size: 12.5px; font-weight: 550; }
    .themes li .tabular { display: grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; color: var(--neg-text); background: var(--surface); border-radius: 99px; font-size: 11px; }
    .sources-list { display: grid; gap: 6px; margin: 0; padding: 0; list-style: none; }
    .sources-list button { padding: 8px 10px; color: var(--text-2); background: var(--surface-2); border: 0; border-radius: var(--r); font-size: 13px; text-align: start; width: 100%; }
    .sources-list button:hover { background: var(--surface-3); }

    /* Démarrage */
    .onboarding { padding: 32px; }
    .onboarding-intro { display: grid; justify-items: center; gap: 8px; max-width: 520px; margin: 0 auto 28px; text-align: center; }
    .onboarding-intro p { color: var(--text-3); }
    .onboarding .empty-icon { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 4px; color: var(--primary); background: var(--primary-50); border-radius: var(--r-lg); }
    .steps { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 0; padding: 0; list-style: none; }
    .steps li { display: flex; gap: 12px; padding: 18px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-lg); }
    .steps p { margin: 4px 0 12px; color: var(--text-3); font-size: 13px; }
    .step-num { display: grid; place-items: center; width: 24px; height: 24px; flex: 0 0 auto; color: #fff; background: var(--navy); border-radius: 50%; font-size: 12px; font-weight: 650; }
    .skeletons { display: grid; gap: 16px; } .skeletons .kpi-grid, .skeletons .grid { margin: 0; }

    @media (max-width: 1180px) { .charts, .priorities { grid-template-columns: 1fr; } }
    @media (max-width: 900px) {
      .synthesis { grid-template-columns: 1fr; } .score-zone { border-left: 0; border-top: 1px solid var(--border); }
      .steps { grid-template-columns: 1fr; } .ai-body { grid-template-columns: 1fr; } .ai-side { padding: 16px 0 0; border-left: 0; border-top: 1px solid var(--border); }
    }
    @media (max-width: 600px) {
      .page-actions { width: 100%; } .product-select { flex: 1; width: auto; } .segmented { width: 100%; } .segmented button { flex: 1; justify-content: center; }
      .distribution { flex-direction: column; } .legend { width: 100%; }
      .verdict, .score-zone { padding: 18px; }
    }
  `],
})
export class DashboardPageComponent implements OnInit {
  private readonly api = inject(DashboardApi);
  private readonly reviews = inject(ReviewApi);
  private readonly destroyRef = inject(DestroyRef);
  readonly live = inject(NotificationService);

  readonly periods = PERIODS;
  readonly rules = SATISFACTION_RULES;
  readonly formula = SATISFACTION_FORMULA;
  readonly summaryLimit = NEGATIVES_FOR_SUMMARY;

  readonly exporting = signal(false);
  readonly products = signal<string[]>([]);
  readonly productRows = signal<ProductRow[]>([]);
  readonly product = signal('');
  readonly days = signal<number | null>(null);
  readonly stats = signal<DashboardStats | null>(null);
  readonly negatives = signal<Review[]>([]);
  readonly loadError = signal(false);
  readonly trend = signal<TrendPoint[] | null>(null);
  readonly trendError = signal(false);
  readonly summary = signal<SummaryResponse | null>(null);
  readonly summaryAt = signal<string | null>(null);
  readonly summaryError = signal('');
  readonly summarizing = signal(false);
  readonly detail = signal<Review | null>(null);

  readonly fmt = formatNumber;
  readonly pct = formatPct;
  readonly pctInt = (n: number) => `${n} %`;
  readonly relative = (iso?: string) => formatRelative(iso);
  readonly signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');
  readonly verdictIcon = (tone: string) => (tone === 'pos' ? 'sentiment_satisfied' : tone === 'neg' ? 'warning' : 'balance');

  readonly exportUrl = computed(() => this.reviews.exportUrl(this.product()));
  readonly verdict = computed(() => { const s = this.stats(); return s && s.total ? verdictOf(s) : null; });
  readonly net = computed(() => { const s = this.stats(); return s ? netScore(s) : 0; });
  /** Pourcentages entiers des KPI : leur somme fait toujours 100. */
  readonly shares = computed(() => { const s = this.stats(); return s ? roundPercents([s.positive, s.neutral, s.negative]) : [0, 0, 0]; });
  readonly periodLong = computed(() => PERIODS.find((p) => p.days === this.days())!.long);
  readonly trendLong = computed(() => (this.days() ? this.periodLong().toLowerCase() : `${DEFAULT_TREND_DAYS} derniers jours`));
  readonly summaryDate = computed(() => formatDateTime(this.summaryAt()));
  readonly themes = computed(() => frequentWords(this.negatives().map((r) => r.text), 8));

  /** Période courante et période précédente de même durée (le serveur renvoie 2 × N jours). */
  private readonly windows = computed(() => {
    const points = this.trend();
    if (!points) return null;
    const n = this.days() ?? DEFAULT_TREND_DAYS;
    return { current: points.slice(-n), previous: this.days() ? points.slice(0, points.length - n) : [] };
  });

  readonly evolution = computed(() => {
    const w = this.windows();
    if (!w || !this.days()) return null;
    const sum = (pts: TrendPoint[]) => statsFromCounts(...([0, 1, 2].map((k) => pts.reduce((a, p) => a + [p.positive, p.neutral, p.negative][k], 0)) as [number, number, number]));
    const cur = sum(w.current);
    const prev = sum(w.previous);
    if (cur.total < SATISFACTION_RULES.minReviewsForTrend || prev.total < SATISFACTION_RULES.minReviewsForTrend) return null;
    return { delta: netScore(cur) - netScore(prev) };
  });

  readonly weekly = computed(() => (this.days() ?? DEFAULT_TREND_DAYS) > 31);

  readonly trendBuckets = computed<TrendBucket[] | null>(() => {
    const w = this.windows();
    if (!w) return null;
    const day = (iso: string) => new Date(`${iso}T00:00:00`);
    const short = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
    const long = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!this.weekly()) {
      return w.current.map((p) => ({ label: short.format(day(p.date)), title: long.format(day(p.date)), positive: p.positive, neutral: p.neutral, negative: p.negative }));
    }
    const buckets: TrendBucket[] = [];
    for (let i = 0; i < w.current.length; i += 7) {
      const slice = w.current.slice(i, i + 7);
      const first = day(slice[0].date);
      const last = day(slice[slice.length - 1].date);
      buckets.push({
        label: short.format(first), title: `Du ${short.format(first)} au ${short.format(last)}`,
        positive: slice.reduce((a, p) => a + p.positive, 0), neutral: slice.reduce((a, p) => a + p.neutral, 0), negative: slice.reduce((a, p) => a + p.negative, 0),
      });
    }
    return buckets;
  });

  readonly trendTotal = computed(() => (this.trendBuckets() ?? []).reduce((a, b) => a + b.positive + b.neutral + b.negative, 0));
  readonly nonEmptyBuckets = computed(() => (this.trendBuckets() ?? []).filter((b) => b.positive + b.neutral + b.negative > 0));

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
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => this.doughnutLabel(ctx) } },
    },
  };

  readonly trendData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const b = this.trendBuckets() ?? [];
    const set = (label: string, key: 'positive' | 'neutral' | 'negative', color: string) =>
      ({ label, data: b.map((x) => x[key]), backgroundColor: color, borderRadius: 3, maxBarThickness: 28, stack: 'avis' });
    return {
      labels: b.map((x) => x.label),
      datasets: [set('Positifs', 'positive', SENTIMENT_HEX.POSITIVE), set('Neutres', 'neutral', SENTIMENT_HEX.NEUTRAL), set('Négatifs', 'negative', SENTIMENT_HEX.NEGATIVE)],
    };
  });
  readonly trendOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 12 } },
      y: { stacked: true, beginAtZero: true, ticks: { precision: 0 }, title: { display: true, text: 'Nombre d’avis' }, border: { display: false } },
    },
    plugins: {
      legend: { position: 'bottom', align: 'end', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, padding: 16 } },
      tooltip: {
        callbacks: {
          title: (items) => this.trendBuckets()?.[items[0].dataIndex]?.title ?? '',
          footer: (items) => `Total : ${items.reduce((a, i) => a + (i.raw as number), 0)} avis`,
        },
      },
    },
  };

  ngOnInit() {
    this.refresh();
    // un nouvel avis client met à jour les chiffres sans recharger la page (regroupé si plusieurs arrivent)
    this.live.reviews$.pipe(debounceTime(800), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.refresh(true));
  }

  exportCsv() {
    this.exporting.set(true);
    this.reviews.downloadCsv(this.product()).subscribe({
      next: () => this.exporting.set(false),
      error: () => this.exporting.set(false),
    });
  }

  /** silent : rafraîchissement en direct, sans repasser par l'écran de chargement. */
  refresh(silent = false) {
    this.loadStats(silent);
    this.api.products().subscribe({
      next: (items) => { this.products.set(items); this.loadProductRows(items); },
      error: () => {},
    });
  }

  selectProduct(value: string) {
    this.product.set(value);
    this.summary.set(null);
    this.summaryError.set('');
    this.loadStats();
  }

  selectPeriod(days: number | null) {
    this.days.set(days);
    this.loadStats();
    this.loadProductRows(this.products());
  }

  resetFilters() {
    this.days.set(null);
    this.selectProduct('');
    this.loadProductRows(this.products());
  }

  summarize() {
    this.summarizing.set(true);
    this.summaryError.set('');
    this.api.summarizeNegatives(this.product()).subscribe({
      next: (result) => { this.summary.set(result); this.summaryAt.set(new Date().toISOString()); this.summarizing.set(false); },
      error: (e: { status?: number }) => {
        this.summarizing.set(false);
        this.summaryError.set(e.status === 429 ? 'Quota Hugging Face atteint, réessayez plus tard.'
          : e.status === 0 || e.status === 504 ? 'Le serveur ne répond pas.'
          : 'Le service de résumé Hugging Face est temporairement indisponible. Réessayez dans un instant.');
      },
    });
  }

  loadTrend() {
    this.trend.set(null);
    this.trendError.set(false);
    const days = this.days() ? this.days()! * 2 : DEFAULT_TREND_DAYS;
    this.api.trend(this.product(), days).subscribe({
      next: (points) => this.trend.set(points),
      error: () => this.trendError.set(true),
    });
  }

  private loadStats(silent = false) {
    if (!silent) this.stats.set(null);
    this.loadError.set(false);
    this.api.stats(this.product(), this.days()).subscribe({
      next: (result) => this.stats.set(result),
      error: () => this.loadError.set(true),
    });
    this.reviews.list(this.product(), 'NEGATIVE', 0, NEGATIVES_FOR_SUMMARY).subscribe({
      next: (page) => this.negatives.set(page.content),
      error: () => this.negatives.set([]),
    });
    this.loadTrend();
  }

  /** Une requête de statistiques par produit, sur la période choisie ; les plus critiqués d'abord. */
  private loadProductRows(items: string[]) {
    if (!items.length) { this.productRows.set([]); return; }
    forkJoin(items.slice(0, MAX_PRODUCTS).map((p) =>
      this.api.stats(p, this.days()).pipe(map((stats) => ({ product: p, stats })), catchError(() => of(null)))
    )).subscribe((rows) => {
      const valid = rows.filter((r): r is { product: string; stats: DashboardStats } => !!r && r.stats.total > 0);
      const all = valid.reduce((a, r) => ({ neg: a.neg + r.stats.negative, total: a.total + r.stats.total }), { neg: 0, total: 0 });
      const globalNeg = all.total ? (all.neg * 100) / all.total : 0;
      this.productRows.set(
        valid.map((r) => ({ ...r, priority: smoothedNegativeRate(r.stats.negativePct, r.stats.total, globalNeg) }))
          .sort((a, b) => b.priority - a.priority || b.stats.total - a.stats.total)
      );
    });
  }

  private doughnutLabel(ctx: TooltipItem<'doughnut'>): string {
    const share = this.shares()[ctx.dataIndex];
    return ` ${ctx.label} : ${formatNumber(ctx.raw as number)} avis (${share} %)`;
  }
}
