import { Component, ElementRef, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdminApi } from '../../core/api/admin-api.service';
import { Review } from '../../core/models/models';
import { formatDateTime, formatRelative } from '../../core/format';
import { LANG_LABEL, detectLanguage } from '../../core/language';
import { AvatarComponent } from '../avatar/avatar.component';
import { ConfidenceComponent } from '../confidence/confidence.component';
import { ConfirmService } from '../confirm-dialog/confirm-dialog.component';
import { LightboxService } from '../lightbox/lightbox.component';
import { SentimentBadgeComponent } from '../sentiment-badge/sentiment-badge.component';
import { StarsComponent } from '../stars/stars.component';

/**
 * Détail d'un avis dans un panneau latéral (back-office). Reçoit l'avis déjà chargé
 * (liste des avis) ou seulement son identifiant (tableau de bord, notifications) : il est alors lu sur l'API.
 */
@Component({
  selector: 'app-review-detail-drawer',
  standalone: true,
  imports: [RouterLink, AvatarComponent, ConfidenceComponent, SentimentBadgeComponent, StarsComponent],
  template: `
    @if (open()) {
      <div class="drawer-backdrop" (click)="close()"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="review-detail-title" (keydown.escape)="closeOnEscape()">
        <header class="drawer-header">
          <div>
            <h2 id="review-detail-title">Détail de l’avis</h2>
            @if (review(); as r) { <p class="muted small">Avis n° {{ r.id }} · publié {{ relative(r.createdAt) }}</p> }
          </div>
          <button #closeBtn class="btn btn-ghost btn-icon" type="button" aria-label="Fermer le détail" (click)="close()"><span class="icon">close</span></button>
        </header>

        <div class="drawer-body">
          @if (review(); as r) {
            <div class="detail fade-in">
              <section class="author">
                @if (r.authorName) {
                  <app-avatar [name]="r.authorName" [size]="40" />
                  <div><strong>{{ r.authorName }}</strong><span class="muted small">Client de la boutique</span></div>
                } @else {
                  <span class="source-icon"><span class="icon">upload_file</span></span>
                  <div><strong>Avis importé</strong><span class="muted small">Import CSV ou analyse par un administrateur</span></div>
                }
                @if (r.rating) { <app-stars class="rating" [value]="r.rating" size="md" /> }
              </section>

              <blockquote dir="auto" [attr.lang]="langCode()">{{ r.text }}</blockquote>

              @if (r.imageUrls?.length) {
                <div class="gallery">
                  @for (u of r.imageUrls!; track u; let i = $index) {
                    <button class="thumb lg" type="button" (click)="lightbox.open(r.imageUrls!, i)" [attr.aria-label]="'Agrandir la photo ' + (i + 1)"><img [src]="u" alt="" /></button>
                  }
                </div>
              }

              <section class="analysis">
                <h3 class="section-title"><span class="icon">auto_awesome</span>Analyse de l’IA</h3>
                <div class="analysis-row">
                  <app-sentiment-badge [label]="r.label" size="lg" />
                  <app-confidence [score]="r.score" [label]="r.label" size="lg" [showLevel]="true" />
                </div>
                <p class="hint">Sentiment prédit par XLM-RoBERTa. La confiance est une estimation du modèle, pas une garantie de justesse.</p>
              </section>

              <dl class="meta">
                <dt>Produit</dt>
                <dd>@if (r.product) { <span class="tag">{{ r.product }}</span> } @else { <span class="muted">Non renseigné</span> }</dd>
                <dt>Note client</dt>
                <dd>@if (r.rating) { {{ r.rating }} / 5 } @else { <span class="muted">Aucune (avis importé)</span> }</dd>
                <dt>Langue</dt>
                <dd><span class="lang-tag">{{ lang() }}</span><span class="muted small">{{ langLabel() }} · estimation</span></dd>
                <dt>Publication</dt>
                <dd>{{ dateTime(r.createdAt) }}</dd>
                @if (r.updatedAt) { <dt>Modification</dt><dd>{{ dateTime(r.updatedAt) }} <span class="muted small">(texte réanalysé)</span></dd> }
              </dl>
            </div>
          } @else if (error()) {
            <div class="empty-state compact" role="alert">
              <div class="empty-icon error"><span class="icon">error</span></div>
              <h3>Avis introuvable</h3><p>Il a peut-être été supprimé entre-temps.</p>
            </div>
          } @else {
            <div class="loading" aria-busy="true" aria-label="Chargement de l’avis">
              <span class="skeleton" style="height: 44px"></span><span class="skeleton" style="height: 120px"></span><span class="skeleton" style="height: 80px"></span>
            </div>
          }
        </div>

        <footer class="drawer-footer">
          @if (review(); as r) {
            <button class="btn btn-ghost danger spacer" type="button" (click)="remove(r)" [class.is-loading]="deleting()"><span class="icon">delete</span>Supprimer l’avis</button>
            @if (r.product && showProductLink()) {
              <a class="btn btn-secondary" routerLink="/reviews" [queryParams]="{ product: r.product }" (click)="close()"><span class="icon">filter_alt</span>Avis du produit</a>
            }
          }
          <button class="btn btn-primary" type="button" (click)="close()">Fermer</button>
        </footer>
      </aside>
    }
  `,
  styles: [`
    .detail { display: grid; gap: 22px; align-content: start; }
    .author { display: flex; align-items: center; gap: 12px; }
    .author div { display: grid; line-height: 1.35; } .author strong { font-weight: 600; }
    .author .rating { margin-left: auto; }
    .source-icon { display: grid; place-items: center; width: 40px; height: 40px; color: var(--text-3); background: var(--surface-3); border-radius: 50%; }
    blockquote { margin: 0; padding: 16px 18px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-lg); font-size: 15px; line-height: 1.7; white-space: pre-wrap; unicode-bidi: plaintext; overflow-wrap: anywhere; }
    .gallery { display: flex; gap: 10px; flex-wrap: wrap; } .thumb.lg { width: 104px; height: 104px; border-radius: var(--r-lg); }
    .analysis { padding: 16px; border: 1px solid var(--border); border-radius: var(--r-lg); }
    .analysis .section-title { margin-bottom: 14px; } .analysis .section-title .icon { font-size: 16px; color: var(--primary); }
    .analysis-row { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 20px; }
    .analysis .hint { margin-top: 12px; }
    .meta { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 12px 16px; margin: 0; font-size: 13.5px; }
    .meta dt { color: var(--text-3); } .meta dd { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 0; }
    .loading { display: grid; gap: 14px; }
    @media (max-width: 480px) { .analysis-row { grid-template-columns: 1fr; gap: 12px; } .meta { grid-template-columns: 1fr; gap: 2px; } .meta dd { margin-bottom: 10px; } }
  `],
})
export class ReviewDetailDrawerComponent {
  /** L'avis (déjà chargé) ou son identifiant ; null ferme le panneau. */
  readonly source = input<Review | number | null>(null, { alias: 'review' });
  readonly showProductLink = input(true);
  readonly closed = output<void>();
  readonly deleted = output<number>();

  private readonly admin = inject(AdminApi);
  private readonly confirm = inject(ConfirmService);
  private readonly snack = inject(MatSnackBar);
  readonly lightbox = inject(LightboxService);
  private readonly closeBtn = viewChild<ElementRef<HTMLButtonElement>>('closeBtn');

  readonly open = signal(false);
  readonly review = signal<Review | null>(null);
  readonly error = signal(false);
  readonly deleting = signal(false);
  private returnFocus: HTMLElement | null = null;

  readonly relative = (iso?: string) => formatRelative(iso);
  readonly dateTime = formatDateTime;
  readonly lang = () => detectLanguage(this.review()?.text);
  readonly langLabel = () => LANG_LABEL[this.lang()];
  readonly langCode = () => ({ FR: 'fr', EN: 'en', AR: 'ar', '?': null })[this.lang()];

  constructor() {
    effect(() => {
      const src = this.source();
      untracked(() => this.show(src));
    });
  }

  private show(src: Review | number | null) {
    this.error.set(false);
    if (src === null) { this.open.set(false); this.review.set(null); return; }
    if (!this.open()) this.returnFocus = document.activeElement as HTMLElement | null;
    this.open.set(true);
    setTimeout(() => this.closeBtn()?.nativeElement.focus());
    if (typeof src === 'number') {
      this.review.set(null);
      this.admin.review(src).subscribe({ next: (r) => this.review.set(r), error: () => this.error.set(true) });
    } else {
      this.review.set(src);
    }
  }

  close() {
    this.open.set(false);
    this.closed.emit();
    this.returnFocus?.focus?.();
  }

  /** Échap ferme seulement la couche du dessus : la photo agrandie d'abord, puis le panneau. */
  closeOnEscape() {
    if (!this.lightbox.images().length) this.close();
  }

  async remove(r: Review) {
    const ok = await this.confirm.ask({
      title: 'Supprimer cet avis ?',
      message: r.authorName ? `L’avis de ${r.authorName} sera définitivement supprimé, ainsi que ses photos.` : 'Cet avis sera définitivement supprimé.',
      confirmLabel: 'Supprimer l’avis',
    });
    if (!ok) return;
    this.deleting.set(true);
    this.admin.deleteReview(r.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.snack.open('Avis supprimé', 'OK', { duration: 3000 });
        this.deleted.emit(r.id);
        this.close();
      },
      error: () => this.deleting.set(false),
    });
  }
}
