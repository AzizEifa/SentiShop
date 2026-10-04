import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PercentPipe } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ReviewApi } from '../../../core/api/review-api.service';
import { Review, Sentiment } from '../../../core/models/models';
import { SENTIMENT_CLASS, formatNumber, formatRelative } from '../../../core/format';
import { SentimentBadgeComponent } from '../../../shared/sentiment-badge/sentiment-badge.component';
import { StarsComponent } from '../../../shared/stars/stars.component';
import { NotificationService } from '../../../core/notifications/notification.service';

const FILTERS: { value: Sentiment | ''; label: string; dot?: string }[] = [
  { value: '', label: 'Tous' },
  { value: 'POSITIVE', label: 'Positifs', dot: 'pos' },
  { value: 'NEUTRAL', label: 'Neutres', dot: 'neu' },
  { value: 'NEGATIVE', label: 'Négatifs', dot: 'neg' },
];

@Component({
  selector: 'app-reviews-page',
  standalone: true,
  imports: [RouterLink, PercentPipe, SentimentBadgeComponent, StarsComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Avis clients</h1>
        <p class="subtitle">{{ fmt(total()) }} avis {{ label() || product() ? 'correspondent à vos filtres' : 'analysés' }}</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" type="button" (click)="exportCsv()" [disabled]="exporting()"><span class="icon">{{ exporting() ? 'hourglass_top' : 'download' }}</span>Exporter la sélection</button>
      </div>
    </header>

    <section class="card">
      <div class="toolbar">
        <div class="segmented" role="group" aria-label="Filtrer par sentiment">
          @for (f of filters; track f.value) {
            <button type="button" [class.active]="label() === f.value" [attr.aria-pressed]="label() === f.value" (click)="setLabel(f.value)">
              @if (f.dot) { <span class="dot" [class]="'dot ' + f.dot"></span> }{{ f.label }}
            </button>
          }
        </div>
        <div class="input-group search">
          <span class="icon">search</span>
          <input class="input" type="search" placeholder="Filtrer par produit…" aria-label="Filtrer par produit" [value]="product()" (input)="search$.next($any($event.target).value)" />
        </div>
        @if (label() || product()) { <button class="btn btn-ghost btn-sm" type="button" (click)="clearFilters()"><span class="icon">close</span>Effacer les filtres</button> }
      </div>

      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Avis</th><th>Auteur</th><th>Produit</th><th>Sentiment</th><th class="conf-col">Confiance</th><th>Date</th></tr></thead>
          <tbody>
            @if (loading() && !rows().length) {
              @for (i of skeletonRows; track i) {
                <tr><td><span class="skeleton" style="height: 14px; width: 90%"></span><span class="skeleton" style="height: 14px; width: 60%; margin-top: 6px"></span></td><td><span class="skeleton" style="height: 14px; width: 90px"></span></td><td><span class="skeleton" style="height: 14px; width: 80px"></span></td><td><span class="skeleton" style="height: 22px; width: 76px; border-radius: 99px"></span></td><td><span class="skeleton" style="height: 6px"></span></td><td><span class="skeleton" style="height: 14px; width: 70px"></span></td></tr>
              }
            } @else {
              @for (r of rows(); track r.id) {
                <tr [class.dim]="loading()" [class.fresh]="fresh().has(r.id)">
                  <td class="text-col">
                    <p class="review-text" dir="auto" [class.expanded]="expanded().has(r.id)" (click)="toggle(r.id)" [title]="expanded().has(r.id) ? 'Réduire' : 'Afficher tout le texte'">{{ r.text }}</p>
                  </td>
                  <td class="author">
                    @if (r.authorName) { <span class="author-name">{{ r.authorName }}</span>@if (r.rating) { <app-stars [value]="r.rating" /> } }
                    @else { <span class="source"><span class="icon">upload_file</span>Import</span> }
                  </td>
                  <td>@if (r.product) { <span class="tag">{{ r.product }}</span> } @else { <span class="muted">—</span> }</td>
                  <td><app-sentiment-badge [label]="r.label" /></td>
                  <td class="conf-col"><div class="conf"><div class="meter" [class]="'meter ' + tone(r.label)"><span [style.width.%]="r.score * 100"></span></div><span class="tabular">{{ r.score | percent: '1.0-0' }}</span></div></td>
                  <td class="nowrap muted" [title]="r.createdAt ?? ''">{{ relative(r.createdAt) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6">
                  <div class="empty-state">
                    <div class="empty-icon"><span class="icon">{{ label() || product() ? 'filter_alt_off' : 'inbox' }}</span></div>
                    @if (label() || product()) {
                      <h3>Aucun avis ne correspond</h3><p>Essayez un autre produit ou un autre sentiment.</p>
                      <div class="page-actions"><button class="btn btn-secondary" type="button" (click)="clearFilters()">Effacer les filtres</button></div>
                    } @else {
                      <h3>Aucun avis analysé</h3><p>Importez un fichier CSV ou analysez un premier avis.</p>
                      <div class="page-actions"><a class="btn btn-primary" routerLink="/import"><span class="icon">upload</span>Importer des avis</a></div>
                    }
                  </div>
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
              @for (n of [10, 20, 50]; track n) { <option [value]="n">{{ n }}</option> }
            </select>
            <button class="btn btn-secondary btn-icon" type="button" aria-label="Page précédente" [disabled]="page() === 0" (click)="goTo(page() - 1)"><span class="icon">chevron_left</span></button>
            <span class="tabular page-indicator">{{ page() + 1 }} / {{ pages() }}</span>
            <button class="btn btn-secondary btn-icon" type="button" aria-label="Page suivante" [disabled]="page() + 1 >= pages()" (click)="goTo(page() + 1)"><span class="icon">chevron_right</span></button>
          </div>
        </footer>
      }
    </section>
  `,
  styles: [`
    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    .search { width: 260px; }
    .text-col { min-width: 320px; max-width: 560px; }
    .text-col .review-text { cursor: pointer; }
    .conf-col { width: 150px; }
    .conf { display: grid; grid-template-columns: 1fr 40px; align-items: center; gap: 10px; font-size: 13px; text-align: right; }
    tr.dim { opacity: .55; }
    tr.fresh { animation: highlight 2.5s ease; }
    @keyframes highlight { from { background: var(--brand-100); } to { background: transparent; } }
    .author { white-space: nowrap; } .author-name { display: block; font-weight: 550; font-size: 13.5px; }
    .source { display: inline-flex; align-items: center; gap: 4px; color: var(--text-4); font-size: 12.5px; } .source .icon { font-size: 16px; }
    .pager { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-top: 1px solid var(--border); font-size: 13px; }
    .pager-controls { display: flex; align-items: center; gap: 8px; }
    .select-sm { width: 76px; height: 34px; }
    .page-indicator { min-width: 54px; text-align: center; }
    @media (max-width: 640px) { .search { width: 100%; } .segmented { width: 100%; overflow-x: auto; } }
  `],
})
export class ReviewsPageComponent implements OnInit {
  private readonly api = inject(ReviewApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly live = inject(NotificationService);
  readonly exporting = signal(false);
  /** Avis arrivés en direct, surlignés brièvement. */
  readonly fresh = signal(new Set<number>());

  readonly filters = FILTERS;
  readonly skeletonRows = [1, 2, 3, 4, 5];
  readonly product = signal('');
  readonly label = signal<Sentiment | ''>('');
  readonly page = signal(0);
  readonly size = signal(10);
  readonly rows = signal<Review[]>([]);
  readonly total = signal(0);
  readonly loading = signal(false);
  readonly expanded = signal(new Set<number>());
  readonly search$ = new Subject<string>();

  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / this.size())));
  readonly from = computed(() => (this.total() ? this.page() * this.size() + 1 : 0));
  readonly to = computed(() => Math.min(this.total(), (this.page() + 1) * this.size()));
  readonly fmt = formatNumber;
  readonly relative = (iso?: string) => formatRelative(iso);
  readonly tone = (l: Sentiment) => SENTIMENT_CLASS[l];

  ngOnInit() {
    const q = this.route.snapshot.queryParamMap;
    const l = q.get('label');
    if (l === 'POSITIVE' || l === 'NEUTRAL' || l === 'NEGATIVE') this.label.set(l);
    this.product.set(q.get('product') ?? '');
    this.search$.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => { this.product.set(value.trim()); this.reload(); });
    this.fetch();
    // nouvel avis client : la première page se met à jour toute seule
    this.live.reviews$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
      if (this.page() !== 0) return;
      this.fresh.update((set) => new Set(set).add(e.id));
      this.fetch();
    });
  }

  exportUrl() { return this.api.exportUrl(this.product()); }

  exportCsv() {
    this.exporting.set(true);
    this.api.downloadCsv(this.product()).subscribe({
      next: () => this.exporting.set(false),
      error: () => this.exporting.set(false),
    });
  }

  setLabel(value: Sentiment | '') { this.label.set(value); this.reload(); }
  setSize(n: number) { this.size.set(n); this.reload(); }
  goTo(p: number) { this.page.set(p); this.fetch(); }
  clearFilters() { this.product.set(''); this.label.set(''); this.reload(); }

  toggle(id: number) {
    this.expanded.update((set) => { const next = new Set(set); next.has(id) ? next.delete(id) : next.add(id); return next; });
  }

  reload() {
    this.page.set(0);
    // filtres reflétés dans l'URL : partageables et conservés au retour arrière
    this.router.navigate([], { queryParams: { label: this.label() || null, product: this.product() || null }, replaceUrl: true });
    this.fetch();
  }

  private fetch() {
    this.loading.set(true);
    this.api.list(this.product(), this.label(), this.page(), this.size()).subscribe({
      next: (page) => { this.rows.set(page.content); this.total.set(page.totalElements); this.loading.set(false); },
      error: () => { this.rows.set([]); this.total.set(0); this.loading.set(false); },
    });
  }
}
