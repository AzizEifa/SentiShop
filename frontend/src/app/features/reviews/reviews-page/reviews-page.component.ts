import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { PercentPipe } from '@angular/common';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';
import { ReviewApi } from '../../../core/api/review-api.service';
import { Review, Sentiment } from '../../../core/models/models';
import { SENTIMENT_CLASS, formatNumber, formatRelative } from '../../../core/format';
import { SentimentBadgeComponent } from '../../../shared/sentiment-badge/sentiment-badge.component';
import { ConfirmService } from '../../../shared/confirm-dialog/confirm-dialog.component';
import { LightboxService } from '../../../shared/lightbox/lightbox.component';
import { AdminApi } from '../../../core/api/admin-api.service';
import { MatSnackBar } from '@angular/material/snack-bar';
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
                <tr class="clickable" [class.dim]="loading()" [class.fresh]="fresh().has(r.id)" [class.selected]="detail()?.id === r.id" (click)="open(r)" tabindex="0" (keydown.enter)="open(r)">
                  <td class="text-col">
                    <p class="review-text" dir="auto">{{ r.text }}</p>
                    @if (r.imageUrls?.length) { <span class="has-photos"><span class="icon">photo_library</span>{{ r.imageUrls!.length }} photo{{ r.imageUrls!.length > 1 ? 's' : '' }}</span> }
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

    @if (detail(); as d) {
      <div class="drawer-backdrop" (click)="detail.set(null)"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="review-title" (keydown.escape)="closeOnEscape()">
        <header class="drawer-header">
          <div><h2 id="review-title">Détail de l’avis</h2><p class="muted small">#{{ d.id }} · {{ relative(d.createdAt) }}@if (d.updatedAt) { · modifié {{ relative(d.updatedAt) }} }</p></div>
          <button class="btn btn-ghost btn-icon" type="button" aria-label="Fermer" (click)="detail.set(null)"><span class="icon">close</span></button>
        </header>
        <div class="drawer-body detail">
          <div class="detail-head">
            <app-sentiment-badge [label]="d.label" size="lg" />
            <span class="confidence tabular">{{ d.score | percent: '1.0-0' }} de confiance</span>
          </div>
          <blockquote dir="auto">{{ d.text }}</blockquote>
          @if (d.imageUrls?.length) {
            <div class="gallery">@for (u of d.imageUrls!; track u; let i = $index) { <button class="thumb lg" type="button" (click)="lightbox.open(d.imageUrls!, i)" aria-label="Agrandir la photo"><img [src]="u" alt="" /></button> }</div>
          }
          <dl class="meta">
            <dt>Auteur</dt><dd>{{ d.authorName ?? 'Import / analyse administrateur' }}</dd>
            <dt>Note</dt><dd>@if (d.rating) { <app-stars [value]="d.rating" size="md" /> } @else { <span class="muted">—</span> }</dd>
            <dt>Produit</dt><dd>@if (d.product) { <span class="tag">{{ d.product }}</span> } @else { <span class="muted">—</span> }</dd>
            <dt>Date</dt><dd>{{ fullDate(d.createdAt) }}</dd>
          </dl>
        </div>
        <footer class="drawer-footer">
          <button class="btn btn-ghost spacer danger-text" type="button" (click)="remove(d)"><span class="icon">delete</span>Supprimer l’avis</button>
          <button class="btn btn-secondary" type="button" (click)="detail.set(null)">Fermer</button>
        </footer>
      </aside>
    }
  `,
  styles: [`
    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    .search { width: 260px; }
    .text-col { min-width: 320px; max-width: 560px; }
    tr.selected { background: var(--brand-50); }
    .has-photos { display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; color: var(--text-3); font-size: 12px; } .has-photos .icon { font-size: 15px; }
    .small { font-size: 12.5px; }
    .detail { display: grid; gap: 18px; align-content: start; }
    .detail-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .confidence { color: var(--text-3); font-size: 13px; }
    blockquote { margin: 0; padding: 14px 16px; background: var(--surface-2); border-left: 3px solid var(--border-strong); border-radius: 0 10px 10px 0; font-size: 15px; line-height: 1.6; white-space: pre-wrap; unicode-bidi: plaintext; }
    .gallery { display: flex; gap: 10px; flex-wrap: wrap; } .thumb.lg { width: 112px; height: 112px; border-radius: 12px; }
    .meta { display: grid; grid-template-columns: 90px 1fr; gap: 12px 16px; margin: 0; font-size: 14px; }
    .meta dt { color: var(--text-3); } .meta dd { display: flex; align-items: center; margin: 0; }
    .danger-text { color: var(--neg-text); }
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
  readonly detail = signal<Review | null>(null);
  readonly lightbox = inject(LightboxService);
  private readonly admin = inject(AdminApi);
  private readonly confirm = inject(ConfirmService);
  private readonly snack = inject(MatSnackBar);
  readonly fullDate = (iso?: string) => (iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' }) : '—');
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
      if (e.type === 'review.deleted' && this.detail()?.id === e.id) this.detail.set(null);
      if (e.type !== 'review.deleted') this.fresh.update((set) => new Set(set).add(e.id));
      if (this.page() === 0 || e.type !== 'review.created') this.fetch();
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

  open(r: Review) { this.detail.set(r); }

  /** Échap ferme seulement la couche du dessus : la photo agrandie d'abord, puis le panneau. */
  closeOnEscape() {
    if (!this.lightbox.images().length) this.detail.set(null);
  }

  async remove(r: Review) {
    const ok = await this.confirm.ask({
      title: 'Supprimer cet avis ?',
      message: r.authorName ? `L’avis de ${r.authorName} sera définitivement supprimé, ainsi que ses photos.` : 'Cet avis sera définitivement supprimé.',
      confirmLabel: 'Supprimer l’avis',
    });
    if (!ok) return;
    this.admin.deleteReview(r.id).subscribe(() => {
      this.detail.set(null);
      this.snack.open('Avis supprimé', 'OK', { duration: 3000 });
      this.fetch();
    });
  }

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
