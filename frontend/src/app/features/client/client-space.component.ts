import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { ClientApi } from '../../core/api/client-api.service';
import { ApiProblem, MyReview } from '../../core/models/models';
import { formatRelative } from '../../core/format';
import { StarsComponent } from '../../shared/stars/stars.component';

export const MIN_TEXT = 10;
export const MAX_TEXT = 2000;

@Component({
  selector: 'app-client-space',
  standalone: true,
  imports: [FormsModule, StarsComponent],
  template: `
    <section class="hero">
      <div>
        <span class="eyebrow">Mon espace</span>
        <h1>Bonjour {{ firstName() }}, votre avis compte.</h1>
        <p>Partagez votre expérience : chaque avis aide la boutique à améliorer ses produits et son service.</p>
      </div>
      <div class="hero-stat">
        <span class="hero-value tabular">{{ total() }}</span>
        <span>avis publié{{ total() > 1 ? 's' : '' }}</span>
      </div>
    </section>

    <div class="layout">
      <section class="card compose">
        @if (sent(); as r) {
          <div class="thanks fade-in">
            <span class="thanks-icon"><span class="icon fill">check_circle</span></span>
            <h2>Merci {{ firstName() }} !</h2>
            <p>Votre avis sur <strong>{{ r.product }}</strong> a bien été publié. L’équipe de la boutique en est informée.</p>
            <app-stars [value]="r.rating" size="md" />
            <button class="btn btn-primary" type="button" (click)="reset()"><span class="icon">edit</span>Écrire un autre avis</button>
          </div>
        } @else {
          <div class="card-header"><div><h2>Donner mon avis</h2><p class="card-subtitle">Trois informations suffisent.</p></div></div>
          <form class="card-body form" (submit)="$event.preventDefault(); submit()" novalidate>
            @if (error()) { <div class="alert alert-danger fade-in" role="alert"><span class="icon">error</span><div>{{ error() }}</div></div> }

            <div class="field">
              <label class="label" for="product"><span><span class="step">1</span>Produit concerné</span></label>
              <div class="input-group">
                <span class="icon">inventory_2</span>
                <input id="product" class="input" name="product" list="products" maxlength="120" autocomplete="off" [(ngModel)]="product" [class.invalid]="!!fieldError('product')" placeholder="Rechercher ou saisir un produit" />
              </div>
              <datalist id="products">@for (p of products(); track p) { <option [value]="p"></option> }</datalist>
              @if (fieldError('product'); as msg) { <span class="field-error"><span class="icon">error</span>{{ msg }}</span> }
            </div>

            <div class="field">
              <span class="label" id="rating-label"><span><span class="step">2</span>Votre note</span></span>
              <app-stars [(value)]="rating" [editable]="true" size="lg" aria-labelledby="rating-label" />
              @if (fieldError('rating'); as msg) { <span class="field-error"><span class="icon">error</span>{{ msg }}</span> }
            </div>

            <div class="field">
              <label class="label" for="text"><span><span class="step">3</span>Votre avis</span><span class="optional tabular" [class.warn]="text.length > maxText - 100">{{ text.length }} / {{ maxText }}</span></label>
              <textarea id="text" class="textarea" name="text" dir="auto" rows="6" [maxlength]="maxText" [(ngModel)]="text" [class.invalid]="!!fieldError('text')"
                        (keydown.control.enter)="submit()" (keydown.meta.enter)="submit()"
                        placeholder="Qu’avez-vous aimé ou moins aimé ? Qualité, livraison, service client…"></textarea>
              @if (fieldError('text'); as msg) { <span class="field-error"><span class="icon">error</span>{{ msg }}</span> }
              @else { <span class="hint">Vous pouvez écrire en français, en anglais ou en arabe.</span> }
            </div>

            <div class="actions">
              <button class="btn btn-primary btn-lg" type="submit" [disabled]="loading()">
                @if (loading()) { <span class="spinner"></span>Publication… } @else { <span class="icon">send</span>Publier mon avis }
              </button>
              <span class="hint">Publié sous le nom <strong>{{ auth.user()?.fullName }}</strong></span>
            </div>
          </form>
        }
      </section>

      <aside class="side">
        <section class="card">
          <div class="card-header"><div><h2>Mes avis</h2><p class="card-subtitle">{{ total() ? 'Du plus récent au plus ancien' : 'Votre historique' }}</p></div></div>
          @if (loadingList()) {
            <div class="list-skeleton">@for (i of [1, 2, 3]; track i) { <span class="skeleton" style="height: 76px"></span> }</div>
          } @else if (reviews().length) {
            <ul class="mine">
              @for (r of reviews(); track r.id) {
                <li [class.new]="r.id === sent()?.id">
                  <div class="mine-head"><span class="tag">{{ r.product }}</span><app-stars [value]="r.rating" /></div>
                  <p class="review-text" dir="auto">{{ r.text }}</p>
                  <div class="mine-foot"><span class="published"><span class="icon fill">check_circle</span>Publié</span><span class="muted">{{ relative(r.createdAt) }}</span></div>
                </li>
              }
            </ul>
          } @else {
            <div class="empty-state"><div class="empty-icon"><span class="icon">rate_review</span></div><h3>Aucun avis pour l’instant</h3><p>Votre premier avis apparaîtra ici.</p></div>
          }
        </section>

        <section class="card tips">
          <h3><span class="icon">lightbulb</span>Un avis utile, c’est…</h3>
          <ul>
            <li>Concret : ce qui vous a plu ou déplu, et pourquoi.</li>
            <li>Honnête : le positif comme le négatif.</li>
            <li>Respectueux : sans données personnelles.</li>
          </ul>
        </section>
      </aside>
    </div>
  `,
  styles: [`
    .hero { display: flex; align-items: center; justify-content: space-between; gap: 24px; margin-bottom: 24px; padding: 28px 32px; color: #fff; background: radial-gradient(600px 220px at 100% 0%, #34d39933, transparent 70%), linear-gradient(135deg, #0f5c46, #12785c); border-radius: 18px; box-shadow: var(--shadow-sm); }
    .eyebrow { color: #a7e3cb; font-size: 12.5px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
    .hero h1 { margin-top: 6px; color: #fff; font-size: 26px; letter-spacing: -.02em; }
    .hero p { max-width: 560px; margin-top: 6px; color: #cdeee0; }
    .hero-stat { display: grid; justify-items: center; min-width: 120px; padding: 14px 20px; background: rgba(255,255,255,.12); border: 1px solid rgba(255,255,255,.18); border-radius: 14px; font-size: 13px; color: #d7f2e6; }
    .hero-value { color: #fff; font-size: 30px; font-weight: 700; line-height: 1.1; }
    .layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(300px, 1fr); align-items: start; gap: 20px; }
    .layout > * { min-width: 0; }
    .form { display: grid; gap: 22px; }
    .step { display: inline-grid; place-items: center; width: 20px; height: 20px; margin-right: 8px; color: var(--brand-600); background: var(--brand-100); border-radius: 50%; font-size: 11.5px; font-weight: 700; }
    .label > span:first-child { display: inline-flex; align-items: center; }
    .optional.warn { color: var(--warn); }
    .input.invalid, .textarea.invalid { border-color: var(--neg); }
    .field-error { display: flex; align-items: center; gap: 4px; color: var(--neg-text); font-size: 12.5px; }
    .field-error .icon { font-size: 15px; }
    .actions { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,.4); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .thanks { display: grid; justify-items: center; gap: 12px; padding: 48px 28px; text-align: center; }
    .thanks-icon { display: grid; place-items: center; width: 64px; height: 64px; color: var(--pos); background: var(--pos-soft); border-radius: 50%; animation: pop .45s cubic-bezier(.2, .9, .3, 1.4) both; }
    .thanks-icon .icon { font-size: 38px; }
    @keyframes pop { from { transform: scale(.4); opacity: 0; } to { transform: none; opacity: 1; } }
    .thanks h2 { font-size: 22px; } .thanks p { max-width: 380px; color: var(--text-2); }
    .thanks .btn { margin-top: 8px; }
    .side { display: grid; gap: 16px; min-width: 0; }
    .mine { max-height: 520px; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
    .mine li { display: grid; gap: 8px; padding: 14px 20px; border-bottom: 1px solid var(--border); }
    .mine li:last-child { border-bottom: 0; }
    .mine li.new { background: var(--brand-50); animation: fade-in .4s ease both; }
    .mine-head, .mine-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12.5px; }
    .published { display: inline-flex; align-items: center; gap: 4px; color: var(--pos-text); font-weight: 600; }
    .published .icon { font-size: 15px; }
    .list-skeleton { display: grid; gap: 10px; padding: 16px 20px; }
    .tips { padding: 18px 20px; }
    .tips h3 { display: flex; align-items: center; gap: 8px; } .tips h3 .icon { color: #f5a524; font-size: 20px; }
    .tips ul { display: grid; gap: 6px; margin: 10px 0 0; padding-left: 18px; color: var(--text-2); font-size: 13.5px; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .hero { flex-direction: column; align-items: flex-start; padding: 24px; } }
  `],
})
export class ClientSpaceComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ClientApi);

  readonly maxText = MAX_TEXT;
  product = '';
  rating = 0;
  text = '';
  readonly products = signal<string[]>([]);
  readonly reviews = signal<MyReview[]>([]);
  readonly total = signal(0);
  readonly loadingList = signal(true);
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly error = signal('');
  readonly serverErrors = signal<Record<string, string>>({});
  readonly sent = signal<MyReview | null>(null);
  readonly firstName = computed(() => (this.auth.user()?.fullName ?? '').split(' ')[0]);
  readonly relative = (iso: string) => formatRelative(iso);

  ngOnInit() {
    this.api.products().subscribe({ next: (p) => this.products.set(p), error: () => {} });
    this.loadMine();
  }

  fieldError(field: 'product' | 'rating' | 'text'): string {
    if (!this.submitted()) return '';
    return this.localErrors()[field] ?? this.serverErrors()[field] ?? '';
  }

  private localErrors(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!this.product.trim()) e['product'] = 'Choisissez le produit concerné';
    if (!this.rating) e['rating'] = 'Donnez une note de 1 à 5 étoiles';
    const len = this.text.trim().length;
    if (len < MIN_TEXT) e['text'] = len ? `Encore ${MIN_TEXT - len} caractère(s) minimum` : 'Écrivez votre avis';
    return e;
  }

  submit() {
    this.submitted.set(true);
    this.error.set('');
    this.serverErrors.set({});
    if (Object.keys(this.localErrors()).length || this.loading()) return;
    this.loading.set(true);
    this.api.submit({ product: this.product.trim(), rating: this.rating, text: this.text.trim() }).subscribe({
      next: (review) => {
        this.loading.set(false);
        this.sent.set(review);
        this.reviews.update((list) => [review, ...list]);
        this.total.update((n) => n + 1);
        if (!this.products().includes(review.product)) this.products.update((p) => [...p, review.product].sort());
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        const problem = (e.error ?? {}) as ApiProblem;
        if (e.status === 400 && problem.errors) this.serverErrors.set(problem.errors);
        else if (e.status !== 401) {
          this.error.set(e.status === 0 || e.status === 504
            ? 'Le serveur ne répond pas. Votre avis n’a pas été envoyé, réessayez dans un instant.'
            : problem.detail ?? 'Votre avis n’a pas pu être publié. Réessayez.');
        }
      },
    });
  }

  reset() {
    this.sent.set(null);
    this.submitted.set(false);
    this.product = '';
    this.rating = 0;
    this.text = '';
  }

  private loadMine() {
    this.loadingList.set(true);
    this.api.mine().subscribe({
      next: (page) => { this.reviews.set(page.content); this.total.set(page.totalElements); this.loadingList.set(false); },
      error: () => this.loadingList.set(false),
    });
  }
}
