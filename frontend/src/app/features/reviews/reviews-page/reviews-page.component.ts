import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ReviewApi } from '../../../core/api/review-api.service';
import { DashboardApi } from '../../../core/api/dashboard-api.service';
import { Review, ReviewSort, Sentiment } from '../../../core/models/models';
import { SENTIMENT_LABEL, formatDateTime, formatNumber, formatRelative } from '../../../core/format';
import { LANG_LABEL, detectLanguage } from '../../../core/language';
import { downloadText, toCsv } from '../../../core/csv/csv-export';
import { NotificationService } from '../../../core/notifications/notification.service';
import { SentimentBadgeComponent } from '../../../shared/sentiment-badge/sentiment-badge.component';
import { ConfidenceComponent } from '../../../shared/confidence/confidence.component';
import { StarsComponent } from '../../../shared/stars/stars.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../../shared/states/states.component';
import { ReviewDetailDrawerComponent } from '../../../shared/review-detail/review-detail-drawer.component';

const SENTIMENTS: { value: Sentiment | ''; label: string }[] = [
  { value: '', label: 'Tous les sentiments' },
  { value: 'POSITIVE', label: 'Positifs' },
  { value: 'NEUTRAL', label: 'Neutres' },
  { value: 'NEGATIVE', label: 'Négatifs' },
];

const PERIODS: { value: number | null; label: string }[] = [
  { value: null, label: 'Toute la période' },
  { value: 7, label: '7 derniers jours' },
  { value: 30, label: '30 derniers jours' },
  { value: 90, label: '90 derniers jours' },
];

const SIZES = [10, 20, 50];

@Component({
  selector: 'app-reviews-page',
  standalone: true,
  imports: [RouterLink, SentimentBadgeComponent, ConfidenceComponent, StarsComponent, EmptyStateComponent, ErrorStateComponent, ReviewDetailDrawerComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Avis clients</h1>
        <p class="subtitle" aria-live="polite">{{ fmt(total()) }} avis {{ hasFilters() ? 'correspondent à vos filtres' : 'analysés par l’IA' }}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" (click)="exportSelection()" [disabled]="!selected().size">
          <span class="icon">checklist</span>Exporter la sélection@if (selected().size) { ({{ selected().size }}) }
        </button>
        <button class="btn btn-secondary" type="button" (click)="exportCsv()" [class.is-loading]="exporting()"
                [title]="product() ? 'Tous les avis de « ' + product() + ' »' : 'Tous les avis de la boutique'">
          <span class="icon">download</span>Export CSV{{ product() ? ' du produit' : '' }}
        </button>
      </div>
    </header>

    <section class="card">
      <div class="filter-bar" role="search">
        <div class="input-group search">
          <span class="icon">search</span>
          <input class="input" type="search" placeholder="Rechercher dans le texte ou l’auteur…" aria-label="Rechercher dans le texte ou l’auteur"
                 [value]="q()" (input)="search$.next($any($event.target).value)" />
        </div>
        <label class="sr-only" for="f-label">Sentiment</label>
        <select id="f-label" class="select" [value]="label()" (change)="setLabel($any($event.target).value)">
          @for (s of sentiments; track s.value) { <option [value]="s.value">{{ s.label }}</option> }
        </select>
        <label class="sr-only" for="f-product">Produit</label>
        <select id="f-product" class="select" [value]="product()" (change)="setProduct($any($event.target).value)">
          <option value="">Tous les produits</option>
          @for (p of products(); track p) { <option [value]="p">{{ p }}</option> }
          @if (product() && !products().includes(product())) { <option [value]="product()">{{ product() }}</option> }
        </select>
        <label class="sr-only" for="f-days">Période</label>
        <select id="f-days" class="select" [value]="days() ?? ''" (change)="setDays($any($event.target).value)">
          @for (p of periods; track p.label) { <option [value]="p.value ?? ''">{{ p.label }}</option> }
        </select>
        @if (hasFilters()) {
          <button class="btn btn-ghost btn-sm" type="button" (click)="clearFilters()"><span class="icon">filter_alt_off</span>Réinitialiser</button>
        }
      </div>

      @if (selected().size) {
        <div class="selection-bar fade-in" role="status">
          <span><strong>{{ selected().size }}</strong> avis sélectionné{{ selected().size > 1 ? 's' : '' }}</span>
          <button class="link-btn" type="button" (click)="exportSelection()"><span class="icon">download</span>Exporter en CSV</button>
          <button class="link-btn" type="button" (click)="clearSelection()">Désélectionner</button>
        </div>
      }

      @if (error()) {
        <app-error-state (retry)="fetch()" />
      } @else {
        <div class="table-wrap">
          <table class="table stack reviews-table" [attr.aria-busy]="loading()">
            <caption class="sr-only">Avis clients, triés par {{ sortLabel() }}</caption>
            <thead>
              <tr>
                <th class="check-col"><input class="checkbox" type="checkbox" aria-label="Sélectionner les avis de la page" [checked]="pageSelected()" [indeterminate]="pagePartlySelected()" (change)="togglePage()" [disabled]="!rows().length" /></th>
                <th class="product-col" [attr.aria-sort]="ariaSort('product')"><button class="th-sort" type="button" [class.active]="sort() === 'product'" (click)="setSort('product')">Produit<span class="icon">{{ sortIcon('product') }}</span></button></th>
                <th class="author-col" [attr.aria-sort]="ariaSort('authorName')"><button class="th-sort" type="button" [class.active]="sort() === 'authorName'" (click)="setSort('authorName')">Auteur<span class="icon">{{ sortIcon('authorName') }}</span></button></th>
                <th>Extrait de l’avis</th>
                <th title="Langue estimée dans le navigateur (le serveur ne la stocke pas)">Langue</th>
                <th>Sentiment</th>
                <th class="conf-col" [attr.aria-sort]="ariaSort('score')"><button class="th-sort" type="button" [class.active]="sort() === 'score'" (click)="setSort('score')" title="Estimation du modèle, pas une garantie">Confiance<span class="icon">{{ sortIcon('score') }}</span></button></th>
                <th [attr.aria-sort]="ariaSort('createdAt')"><button class="th-sort" type="button" [class.active]="sort() === 'createdAt'" (click)="setSort('createdAt')">Date<span class="icon">{{ sortIcon('createdAt') }}</span></button></th>
                <th class="action-col"><span class="sr-only">Action</span></th>
              </tr>
            </thead>
            <tbody>
              @if (loading() && !rows().length) {
                @for (i of skeletonRows; track i) {
                  <tr><td colspan="9"><span class="skeleton" style="height: 38px"></span></td></tr>
                }
              } @else {
                @for (r of rows(); track r.id) {
                  <tr class="clickable" [class.dim]="loading()" [class.fresh]="fresh().has(r.id)" [class.selected]="selected().has(r.id) || detail()?.id === r.id" (click)="open(r)">
                    <td class="check-col" (click)="$event.stopPropagation()"><input class="checkbox" type="checkbox" [checked]="selected().has(r.id)" (change)="toggle(r)" [attr.aria-label]="'Sélectionner l’avis ' + r.id" /></td>
                    <td class="product-col" data-label="Produit">@if (r.product) { <span class="tag" [title]="r.product">{{ r.product }}</span> } @else { <span class="muted">—</span> }</td>
                    <td class="author-col" data-label="Auteur">
                      @if (r.authorName) { <span class="author-name">{{ r.authorName }}</span>@if (r.rating) { <app-stars [value]="r.rating" /> } }
                      @else { <span class="source"><span class="icon">upload_file</span>Import</span> }
                    </td>
                    <td class="text-col" data-label="Avis">
                      <p class="review-text" dir="auto">{{ r.text }}</p>
                      @if (r.imageUrls?.length) { <span class="has-photos"><span class="icon">photo_library</span>{{ r.imageUrls!.length }} photo{{ r.imageUrls!.length > 1 ? 's' : '' }}</span> }
                    </td>
                    <td data-label="Langue"><span class="lang-tag" [title]="langLabel(r.text) + ' (estimation)'">{{ lang(r.text) }}</span></td>
                    <td data-label="Sentiment"><app-sentiment-badge [label]="r.label" /></td>
                    <td class="conf-col" data-label="Confiance"><app-confidence [score]="r.score" [label]="r.label" /></td>
                    <td class="nowrap muted" data-label="Date"><time [attr.datetime]="r.createdAt" [title]="dateTime(r.createdAt)">{{ relative(r.createdAt) }}</time></td>
                    <td class="action-col"><button class="btn btn-ghost btn-sm" type="button" (click)="$event.stopPropagation(); open(r)" [attr.aria-label]="'Voir le détail de l’avis ' + r.id">Voir<span class="icon">chevron_right</span></button></td>
                  </tr>
                } @empty {
                  <tr class="empty-row"><td colspan="9">
                    @if (hasFilters()) {
                      <app-empty-state icon="filter_alt_off" title="Aucun avis ne correspond" message="Modifiez la recherche ou réinitialisez les filtres.">
                        <button class="btn btn-secondary" type="button" (click)="clearFilters()">Réinitialiser les filtres</button>
                      </app-empty-state>
                    } @else {
                      <app-empty-state icon="inbox" title="Aucun avis analysé" message="Importez un fichier CSV ou analysez un premier avis.">
                        <a class="btn btn-primary" routerLink="/import"><span class="icon">upload</span>Importer des avis</a>
                      </app-empty-state>
                    }
                  </td></tr>
                }
              }
            </tbody>
          </table>
        </div>

        @if (total() > 0) {
          <footer class="pager">
            <span class="muted tabular">{{ fmt(from()) }}–{{ fmt(to()) }} sur {{ fmt(total()) }}</span>
            <div class="pager-controls">
              <label class="muted" for="page-size">Par page</label>
              <select id="page-size" class="select select-sm" [value]="size()" (change)="setSize(+$any($event.target).value)">
                @for (n of sizes; track n) { <option [value]="n">{{ n }}</option> }
              </select>
              <button class="btn btn-secondary btn-icon btn-sm" type="button" aria-label="Première page" [disabled]="page() === 0" (click)="goTo(0)"><span class="icon">first_page</span></button>
              <button class="btn btn-secondary btn-icon btn-sm" type="button" aria-label="Page précédente" [disabled]="page() === 0" (click)="goTo(page() - 1)"><span class="icon">chevron_left</span></button>
              <span class="tabular page-indicator">Page {{ page() + 1 }} / {{ pages() }}</span>
              <button class="btn btn-secondary btn-icon btn-sm" type="button" aria-label="Page suivante" [disabled]="page() + 1 >= pages()" (click)="goTo(page() + 1)"><span class="icon">chevron_right</span></button>
              <button class="btn btn-secondary btn-icon btn-sm" type="button" aria-label="Dernière page" [disabled]="page() + 1 >= pages()" (click)="goTo(pages() - 1)"><span class="icon">last_page</span></button>
            </div>
          </footer>
        }
      }
    </section>

    <app-review-detail-drawer [review]="detailSource()" (closed)="closeDetail()" (deleted)="onDeleted($event)" />
  `,
  styles: [`
    :host { display: block; min-width: 0; }
    .filter-bar .select { width: auto; }
    .selection-bar { display: flex; align-items: center; gap: 16px; padding: 10px 16px; color: var(--primary-text); background: var(--primary-50); border-bottom: 1px solid var(--primary-100); font-size: 13.5px; }
    .reviews-table { table-layout: auto; }
    .product-col { width: 150px; max-width: 170px; } .product-col .tag { max-width: 150px; }
    .author-col { width: 140px; white-space: nowrap; }
    .text-col { min-width: 260px; max-width: 460px; }
    .conf-col { width: 140px; min-width: 130px; }
    .action-col { width: 1%; text-align: end; white-space: nowrap; }
    .action-col .icon { font-size: 18px; }
    .author-name { display: block; overflow: hidden; max-width: 140px; font-weight: 550; text-overflow: ellipsis; }
    .source { display: inline-flex; align-items: center; gap: 4px; color: var(--text-3); font-size: 12.5px; } .source .icon { font-size: 16px; }
    .has-photos { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; color: var(--text-3); font-size: 12px; } .has-photos .icon { font-size: 15px; }
    tr.dim { opacity: .55; }
    tr.fresh { animation: highlight 2.5s ease; }
    @keyframes highlight { from { background: var(--primary-100); } to { background: transparent; } }
    .empty-row:hover { background: none !important; }
    @media (max-width: 720px) {
      .filter-bar .select, .filter-bar .search { flex: 1 1 100%; max-width: none; width: 100%; }
      .product-col, .author-col, .text-col, .conf-col { width: auto; max-width: none; min-width: 0; }
      .text-col { display: block !important; } .text-col::before { display: none; }
      .action-col { text-align: start; }
      .selection-bar { flex-wrap: wrap; gap: 8px 16px; }
    }
  `],
})
export class ReviewsPageComponent implements OnInit {
  private readonly api = inject(ReviewApi);
  private readonly dashboard = inject(DashboardApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly live = inject(NotificationService);

  readonly sentiments = SENTIMENTS;
  readonly periods = PERIODS;
  readonly sizes = SIZES;
  readonly skeletonRows = [1, 2, 3, 4, 5, 6];

  readonly products = signal<string[]>([]);
  readonly product = signal('');
  readonly label = signal<Sentiment | ''>('');
  readonly q = signal('');
  readonly days = signal<number | null>(null);
  readonly sort = signal<ReviewSort>('createdAt');
  readonly dir = signal<'asc' | 'desc'>('desc');
  readonly page = signal(0);
  readonly size = signal(10);
  readonly rows = signal<Review[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly exporting = signal(false);
  /** Sélection conservée d'une page à l'autre (id → avis). */
  readonly selected = signal(new Map<number, Review>());
  /** Avis arrivés en direct, surlignés brièvement. */
  readonly fresh = signal(new Set<number>());
  readonly detail = signal<Review | null>(null);
  /** Avis ouvert depuis une notification : seul l'identifiant est connu. */
  readonly detailId = signal<number | null>(null);
  readonly detailSource = computed<Review | number | null>(() => this.detail() ?? this.detailId());
  readonly search$ = new Subject<string>();

  readonly hasFilters = computed(() => !!(this.label() || this.product() || this.q() || this.days()));
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  readonly from = computed(() => (this.total() ? this.page() * this.size() + 1 : 0));
  readonly to = computed(() => Math.min(this.total(), (this.page() + 1) * this.size()));
  readonly pageSelected = computed(() => this.rows().length > 0 && this.rows().every((r) => this.selected().has(r.id)));
  readonly pagePartlySelected = computed(() => !this.pageSelected() && this.rows().some((r) => this.selected().has(r.id)));
  readonly sortLabel = computed(() => ({ createdAt: 'date', score: 'confiance', product: 'produit', authorName: 'auteur' })[this.sort()] + (this.dir() === 'asc' ? ' croissante' : ' décroissante'));

  readonly fmt = formatNumber;
  readonly relative = (iso?: string) => formatRelative(iso);
  readonly dateTime = formatDateTime;
  readonly lang = (text: string) => detectLanguage(text);
  readonly langLabel = (text: string) => LANG_LABEL[detectLanguage(text)];

  ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    const l = qp.get('label');
    if (l === 'POSITIVE' || l === 'NEUTRAL' || l === 'NEGATIVE') this.label.set(l);
    this.product.set(qp.get('product') ?? '');
    this.q.set(qp.get('q') ?? '');
    const d = Number(qp.get('days'));
    if (d > 0) this.days.set(d);
    const s = qp.get('sort') as ReviewSort | null;
    if (s && ['createdAt', 'score', 'product', 'authorName'].includes(s)) this.sort.set(s);
    if (qp.get('dir') === 'asc') this.dir.set('asc');
    const id = Number(qp.get('review'));
    if (id > 0) this.detailId.set(id);

    // notification cliquée alors que la page est déjà ouverte
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((m) => {
      const rid = Number(m.get('review'));
      if (rid > 0 && rid !== this.detailId() && rid !== this.detail()?.id) { this.detail.set(null); this.detailId.set(rid); }
    });

    this.dashboard.products().subscribe({ next: (p) => this.products.set(p), error: () => {} });
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => { this.q.set(value.trim()); this.reload(); });
    this.fetch();

    // nouvel avis client : la première page se met à jour toute seule
    this.live.reviews$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      if (e.type !== 'review.deleted') this.fresh.update((set) => new Set(set).add(e.id));
      if (this.page() === 0 || e.type !== 'review.created') this.fetch();
    });
  }

  setLabel(value: Sentiment | '') { this.label.set(value); this.reload(); }
  setProduct(value: string) { this.product.set(value); this.reload(); }
  setDays(value: string) { this.days.set(value ? Number(value) : null); this.reload(); }
  setSize(n: number) { this.size.set(n); this.reload(); }
  goTo(p: number) { this.page.set(p); this.fetch(); }

  setSort(column: ReviewSort) {
    if (this.sort() === column) this.dir.set(this.dir() === 'asc' ? 'desc' : 'asc');
    else { this.sort.set(column); this.dir.set(column === 'product' || column === 'authorName' ? 'asc' : 'desc'); }
    this.reload();
  }

  sortIcon(column: ReviewSort) {
    return this.sort() !== column ? 'unfold_more' : this.dir() === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  ariaSort(column: ReviewSort) {
    return this.sort() !== column ? null : this.dir() === 'asc' ? 'ascending' : 'descending';
  }

  clearFilters() {
    this.product.set('');
    this.label.set('');
    this.q.set('');
    this.days.set(null);
    this.reload();
  }

  toggle(r: Review) {
    this.selected.update((m) => { const next = new Map(m); next.has(r.id) ? next.delete(r.id) : next.set(r.id, r); return next; });
  }

  clearSelection() { this.selected.set(new Map()); }

  togglePage() {
    const all = this.pageSelected();
    this.selected.update((m) => {
      const next = new Map(m);
      this.rows().forEach((r) => (all ? next.delete(r.id) : next.set(r.id, r)));
      return next;
    });
  }

  open(r: Review) {
    this.detailId.set(null);
    this.detail.set(r);
  }

  closeDetail() {
    this.detail.set(null);
    if (this.detailId()) { this.detailId.set(null); this.syncUrl(); }
  }

  onDeleted(id: number) {
    this.selected.update((m) => { const next = new Map(m); next.delete(id); return next; });
    this.fetch();
  }

  /** Export CSV par le serveur (tous les avis, filtre produit). */
  exportCsv() {
    this.exporting.set(true);
    this.api.downloadCsv(this.product()).subscribe({
      next: () => this.exporting.set(false),
      error: () => this.exporting.set(false),
    });
  }

  /** Export des avis cochés, généré dans le navigateur. */
  exportSelection() {
    const rows = [...this.selected().values()].map((r) => [
      r.id, r.createdAt ?? '', r.product ?? '', r.authorName ?? 'Import', r.rating ?? '',
      SENTIMENT_LABEL[r.label], r.score.toFixed(3), detectLanguage(r.text), r.text,
    ]);
    const csv = toCsv(['id', 'date', 'produit', 'auteur', 'note', 'sentiment', 'confiance', 'langue_estimee', 'texte'], rows);
    downloadText(csv, `avis-selection-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  reload() {
    this.page.set(0);
    this.syncUrl();
    this.fetch();
  }

  fetch() {
    this.loading.set(true);
    this.error.set(false);
    this.api.search({
      product: this.product(), label: this.label(), q: this.q(), days: this.days(),
      sort: this.sort(), dir: this.dir(), page: this.page(), size: this.size(),
    }).subscribe({
      next: (page) => { this.rows.set(page.content); this.total.set(page.totalElements); this.loading.set(false); },
      error: () => { this.rows.set([]); this.total.set(0); this.loading.set(false); this.error.set(true); },
    });
  }

  /** Filtres reflétés dans l'URL : partageables et conservés au retour arrière. */
  private syncUrl() {
    this.router.navigate([], {
      queryParams: {
        label: this.label() || null, product: this.product() || null, q: this.q() || null, days: this.days() || null,
        sort: this.sort() === 'createdAt' ? null : this.sort(), dir: this.dir() === 'desc' ? null : this.dir(),
        review: this.detailId() || null,
      },
      replaceUrl: true,
    });
  }
}
