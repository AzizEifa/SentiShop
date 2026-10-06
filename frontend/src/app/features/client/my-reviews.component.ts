import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ClientApi } from '../../core/api/client-api.service';
import { MyReview } from '../../core/models/models';
import { formatDateTime, formatNumber, formatRelative } from '../../core/format';
import { StarsComponent } from '../../shared/stars/stars.component';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog.component';
import { LightboxService } from '../../shared/lightbox/lightbox.component';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/states/states.component';

const PAGE_SIZE = 10;

/** Espace client — la liste de mes avis publiés, à modifier ou supprimer. */
@Component({
  selector: 'app-my-reviews',
  standalone: true,
  imports: [RouterLink, StarsComponent, EmptyStateComponent, ErrorStateComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Mes avis</h1>
        <p class="subtitle">{{ total() ? fmt(total()) + ' avis publié' + (total() > 1 ? 's' : '') + ' · modifiables ou supprimables à tout moment' : 'Retrouvez ici les avis que vous publiez.' }}</p>
      </div>
      <div class="page-actions"><a class="btn btn-primary" routerLink="/espace/nouveau"><span class="icon">edit</span>Déposer un avis</a></div>
    </header>

    @if (error()) {
      <section class="card"><app-error-state (retry)="load()" /></section>
    } @else if (loading() && !reviews().length) {
      <div class="list">@for (i of [1, 2, 3]; track i) { <span class="skeleton" style="height: 132px"></span> }</div>
    } @else if (reviews().length) {
      <ul class="list" [attr.aria-busy]="loading()">
        @for (r of reviews(); track r.id) {
          <li class="card review fade-in">
            <div class="head">
              <div class="product"><span class="icon">inventory_2</span><strong>{{ r.product }}</strong></div>
              <app-stars [value]="r.rating" size="md" />
            </div>
            <p class="text" dir="auto">{{ r.text }}</p>
            @if (r.imageUrls.length) {
              <div class="thumbs">@for (u of r.imageUrls; track u; let i = $index) { <button class="thumb" type="button" (click)="lightbox.open(r.imageUrls, i)" [attr.aria-label]="'Agrandir la photo ' + (i + 1)"><img [src]="u" alt="" loading="lazy" /></button> }</div>
            }
            <div class="foot">
              <span class="muted small"><time [attr.datetime]="r.createdAt" [title]="dateTime(r.createdAt)">Publié {{ relative(r.createdAt) }}</time>@if (r.updatedAt) { · modifié {{ relative(r.updatedAt) }} }</span>
              <span class="actions">
                <button class="btn btn-secondary btn-sm" type="button" (click)="edit(r)" [attr.aria-label]="'Modifier mon avis sur ' + r.product"><span class="icon">edit</span>Modifier</button>
                <button class="btn btn-ghost danger btn-sm" type="button" (click)="remove(r)" [attr.aria-label]="'Supprimer mon avis sur ' + r.product"><span class="icon">delete</span>Supprimer</button>
              </span>
            </div>
          </li>
        }
      </ul>
      @if (pages() > 1) {
        <nav class="pager card" aria-label="Pagination">
          <span class="muted tabular">Page {{ page() + 1 }} / {{ pages() }}</span>
          <div class="pager-controls">
            <button class="btn btn-secondary btn-sm" type="button" [disabled]="page() === 0" (click)="goTo(page() - 1)"><span class="icon">chevron_left</span>Précédents</button>
            <button class="btn btn-secondary btn-sm" type="button" [disabled]="page() + 1 >= pages()" (click)="goTo(page() + 1)">Suivants<span class="icon">chevron_right</span></button>
          </div>
        </nav>
      }
    } @else {
      <section class="card">
        <app-empty-state icon="rate_review" title="Aucun avis pour l’instant" message="Vous n’avez pas encore publié d’avis. Partagez votre expérience avec un premier produit.">
          <a class="btn btn-primary" routerLink="/espace/nouveau"><span class="icon">edit</span>Déposer mon premier avis</a>
        </app-empty-state>
      </section>
    }
  `,
  styles: [`
    .list { display: grid; gap: 12px; margin: 0; padding: 0; list-style: none; }
    .review { display: grid; gap: 12px; padding: 18px 20px; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
    .product { display: flex; align-items: center; gap: 8px; min-width: 0; } .product .icon { color: var(--text-4); font-size: 18px; }
    .product strong { overflow: hidden; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .text { color: var(--text); font-size: 14.5px; line-height: 1.65; white-space: pre-wrap; unicode-bidi: plaintext; overflow-wrap: anywhere; }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--border); }
    .actions { display: flex; gap: 6px; }
    .pager { margin-top: 12px; border-top: 1px solid var(--border); }
  `],
})
export class MyReviewsComponent implements OnInit {
  private readonly api = inject(ClientApi);
  private readonly router = inject(Router);
  private readonly confirm = inject(ConfirmService);
  private readonly snack = inject(MatSnackBar);
  readonly lightbox = inject(LightboxService);

  readonly reviews = signal<MyReview[]>([]);
  readonly total = signal(0);
  readonly page = signal(0);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly pages = computed(() => Math.max(1, Math.ceil(this.total() / PAGE_SIZE)));
  readonly fmt = formatNumber;
  readonly relative = (iso: string) => formatRelative(iso);
  readonly dateTime = formatDateTime;

  ngOnInit() { this.load(); }

  goTo(p: number) { this.page.set(p); this.load(); }

  load() {
    this.loading.set(true);
    this.error.set(false);
    this.api.mine(this.page(), PAGE_SIZE).subscribe({
      next: (res) => { this.reviews.set(res.content); this.total.set(res.totalElements); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set(true); },
    });
  }

  edit(r: MyReview) {
    this.router.navigate(['/espace/nouveau'], { queryParams: { edit: r.id }, state: { review: r } });
  }

  async remove(r: MyReview) {
    const ok = await this.confirm.ask({
      title: 'Supprimer cet avis ?',
      message: `Votre avis sur « ${r.product} » sera définitivement supprimé, ainsi que ses photos.`,
      confirmLabel: 'Supprimer mon avis',
    });
    if (!ok) return;
    this.api.delete(r.id).subscribe(() => {
      this.snack.open('Avis supprimé', 'OK', { duration: 3000 });
      if (this.reviews().length === 1 && this.page() > 0) this.page.update((p) => p - 1);
      this.load();
    });
  }
}
