import { Component, ElementRef, HostListener, OnDestroy, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { ClientApi } from '../../core/api/client-api.service';
import { ProductApi } from '../../core/api/product-api.service';
import { ApiProblem, MyReview, Product } from '../../core/models/models';
import { formatRelative } from '../../core/format';
import { StarsComponent } from '../../shared/stars/stars.component';
import { EmojiPickerComponent } from '../../shared/emoji-picker/emoji-picker.component';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog.component';
import { LightboxService } from '../../shared/lightbox/lightbox.component';
import { imageProblem } from '../products/products-page.component';

export const MIN_TEXT = 10;
export const MAX_TEXT = 2000;
export const MAX_PHOTOS = 3;

/** Photo du formulaire : déjà publiée (url) ou nouvelle (fichier + aperçu local). */
export interface Photo { url: string; file?: File; }

@Component({
  selector: 'app-client-space',
  standalone: true,
  imports: [FormsModule, StarsComponent, EmojiPickerComponent],
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
      <section class="card compose" [class.editing]="editingId()">
        @if (sent(); as r) {
          <div class="thanks fade-in">
            <span class="thanks-icon"><span class="icon fill">check_circle</span></span>
            <h2>Merci {{ firstName() }} !</h2>
            <p>Votre avis sur <strong>{{ r.product }}</strong> a bien été publié. L’équipe de la boutique en est informée.</p>
            <app-stars [value]="r.rating" size="md" />
            <button class="btn btn-primary" type="button" (click)="reset()"><span class="icon">edit</span>Écrire un autre avis</button>
          </div>
        } @else {
          <div class="card-header">
            <div>
              <h2>{{ editingId() ? 'Modifier mon avis' : 'Donner mon avis' }}</h2>
              <p class="card-subtitle">{{ editingId() ? 'Vos changements remplacent l’avis publié.' : 'Trois informations suffisent, une photo en bonus.' }}</p>
            </div>
            @if (editingId()) { <button class="btn btn-ghost btn-sm" type="button" (click)="reset()"><span class="icon">close</span>Annuler</button> }
          </div>
          <form class="card-body form" (submit)="$event.preventDefault(); submit()" novalidate>
            @if (error()) { <div class="alert alert-danger fade-in" role="alert"><span class="icon">error</span><div>{{ error() }}</div></div> }

            <!-- 1. Produit -->
            <div class="field">
              <span class="label" id="product-label"><span><span class="step">1</span>Produit concerné</span></span>
              <div class="picker" [class.open]="pickerOpen()">
                <button class="picker-trigger input" type="button" (click)="togglePicker()" aria-haspopup="listbox" [attr.aria-expanded]="pickerOpen()" aria-labelledby="product-label" [class.invalid]="!!fieldError('product')">
                  @if (selectedProduct(); as p) {
                    <span class="thumb-xs">@if (p.imageUrl) { <img [src]="p.imageUrl" alt="" /> } @else { <span class="icon">inventory_2</span> }</span>
                    <span class="picker-name">{{ p.name }}</span>
                    @if (p.category) { <span class="tag">{{ p.category }}</span> }
                  } @else {
                    <span class="icon muted">inventory_2</span><span class="muted">Choisir un produit</span>
                  }
                  <span class="icon chevron">expand_more</span>
                </button>
                @if (pickerOpen()) {
                  <div class="picker-panel fade-in">
                    <div class="input-group"><span class="icon">search</span><input #pickerSearch class="input" type="search" placeholder="Rechercher…" aria-label="Rechercher un produit" [value]="productQuery()" (input)="productQuery.set($any($event.target).value)" (keydown.escape)="pickerOpen.set(false)" /></div>
                    <ul role="listbox" aria-labelledby="product-label">
                      @for (p of filteredProducts(); track p.id) {
                        <li><button type="button" role="option" [attr.aria-selected]="p.name === product" [class.selected]="p.name === product" (click)="chooseProduct(p)">
                          <span class="thumb-sm">@if (p.imageUrl) { <img [src]="p.imageUrl" alt="" /> } @else { <span class="icon">inventory_2</span> }</span>
                          <span class="option-text"><strong>{{ p.name }}</strong>@if (p.category) { <small>{{ p.category }}</small> }</span>
                          @if (p.name === product) { <span class="icon check">check</span> }
                        </button></li>
                      } @empty {
                        <li class="none">{{ products().length ? 'Aucun produit trouvé' : 'Le catalogue est vide pour le moment.' }}</li>
                      }
                    </ul>
                  </div>
                }
              </div>
              @if (fieldError('product'); as msg) { <span class="field-error"><span class="icon">error</span>{{ msg }}</span> }
            </div>

            <!-- 2. Note -->
            <div class="field">
              <span class="label" id="rating-label"><span><span class="step">2</span>Votre note</span></span>
              <app-stars [(value)]="rating" [editable]="true" size="lg" aria-labelledby="rating-label" />
              @if (fieldError('rating'); as msg) { <span class="field-error"><span class="icon">error</span>{{ msg }}</span> }
            </div>

            <!-- 3. Texte + émojis + photos -->
            <div class="field">
              <label class="label" for="text"><span><span class="step">3</span>Votre avis</span><span class="optional tabular" [class.warn]="text.length > maxText - 100">{{ text.length }} / {{ maxText }}</span></label>
              <div class="editor" [class.invalid]="!!fieldError('text')" [class.dragging]="dragging()"
                   (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
                <textarea #textArea id="text" name="text" dir="auto" rows="5" [maxlength]="maxText" [(ngModel)]="text"
                          (keydown.control.enter)="submit()" (keydown.meta.enter)="submit()"
                          placeholder="Qu’avez-vous aimé ou moins aimé ? Qualité, livraison, service client…"></textarea>
                @if (photos().length) {
                  <div class="photos">
                    @for (ph of photos(); track ph.url; let i = $index) {
                      <div class="photo">
                        <button class="thumb" type="button" (click)="zoom(i)" [attr.aria-label]="'Agrandir la photo ' + (i + 1)"><img [src]="ph.url" alt="" /></button>
                        <button class="remove" type="button" (click)="removePhoto(i)" [attr.aria-label]="'Retirer la photo ' + (i + 1)"><span class="icon">close</span></button>
                      </div>
                    }
                  </div>
                }
                <div class="editor-bar">
                  <app-emoji-picker (picked)="insertEmoji($event)" />
                  <label class="tool" for="photo-input" [class.disabled]="photos().length >= maxPhotos" title="Ajouter des photos">
                    <span class="icon">add_photo_alternate</span><span class="tool-label">Photo</span>
                  </label>
                  <input id="photo-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple [disabled]="photos().length >= maxPhotos" (change)="onPhotos($event)" />
                  <span class="muted bar-hint">{{ photos().length }}/{{ maxPhotos }} photos · glissez-les ici</span>
                </div>
              </div>
              @if (photoError()) { <span class="field-error"><span class="icon">error</span>{{ photoError() }}</span> }
              @if (fieldError('text'); as msg) { <span class="field-error"><span class="icon">error</span>{{ msg }}</span> }
              @else if (!photoError()) { <span class="hint">Français, anglais ou arabe — émojis bienvenus 🙂</span> }
            </div>

            <div class="actions">
              <button class="btn btn-primary btn-lg" type="submit" [disabled]="loading()">
                @if (loading()) { <span class="spinner"></span>{{ editingId() ? 'Enregistrement…' : 'Publication…' }} }
                @else { <span class="icon">{{ editingId() ? 'save' : 'send' }}</span>{{ editingId() ? 'Enregistrer les modifications' : 'Publier mon avis' }} }
              </button>
              <span class="hint">Publié sous le nom <strong>{{ auth.user()?.fullName }}</strong></span>
            </div>
          </form>
        }
      </section>

      <aside class="side">
        <section class="card">
          <div class="card-header"><div><h2>Mes avis</h2><p class="card-subtitle">{{ total() ? 'Modifiez ou supprimez-les à tout moment' : 'Votre historique' }}</p></div></div>
          @if (loadingList()) {
            <div class="list-skeleton">@for (i of [1, 2, 3]; track i) { <span class="skeleton" style="height: 76px"></span> }</div>
          } @else if (reviews().length) {
            <ul class="mine">
              @for (r of reviews(); track r.id) {
                <li [class.new]="r.id === highlight()" [class.current]="r.id === editingId()">
                  <div class="mine-head">
                    <span class="tag">{{ r.product }}</span><app-stars [value]="r.rating" />
                    <span class="mine-actions">
                      <button class="icon-btn" type="button" title="Modifier" [attr.aria-label]="'Modifier mon avis sur ' + r.product" (click)="edit(r)"><span class="icon">edit</span></button>
                      <button class="icon-btn danger" type="button" title="Supprimer" [attr.aria-label]="'Supprimer mon avis sur ' + r.product" (click)="remove(r)"><span class="icon">delete</span></button>
                    </span>
                  </div>
                  <p class="review-text" dir="auto">{{ r.text }}</p>
                  @if (r.imageUrls.length) {
                    <div class="thumbs">@for (u of r.imageUrls; track u; let i = $index) { <button class="thumb sm" type="button" (click)="lightbox.open(r.imageUrls, i)" aria-label="Agrandir la photo"><img [src]="u" alt="" loading="lazy" /></button> }</div>
                  }
                  <div class="mine-foot"><span class="published"><span class="icon fill">check_circle</span>Publié</span><span class="muted">{{ relative(r.createdAt) }}@if (r.updatedAt) { · modifié }</span></div>
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
            <li>Illustré : une photo vaut mille mots 📸</li>
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
    .compose.editing { border-color: var(--brand); box-shadow: 0 0 0 3px var(--brand-50), var(--shadow-sm); }
    .form { display: grid; gap: 22px; }
    .step { display: inline-grid; place-items: center; width: 20px; height: 20px; margin-right: 8px; color: var(--brand-600); background: var(--brand-100); border-radius: 50%; font-size: 11.5px; font-weight: 700; }
    .label > span:first-child { display: inline-flex; align-items: center; }
    .optional.warn { color: var(--warn); }
    .field-error { display: flex; align-items: center; gap: 4px; color: var(--neg-text); font-size: 12.5px; } .field-error .icon { font-size: 15px; }
    /* sélecteur de produit */
    .picker { position: relative; }
    .picker-trigger { display: flex; align-items: center; gap: 10px; height: 48px; text-align: start; cursor: pointer; }
    .picker-trigger.invalid { border-color: var(--neg); }
    .picker-name { flex: 1; overflow: hidden; font-weight: 550; text-overflow: ellipsis; white-space: nowrap; }
    .picker-trigger .muted { flex: 1; } .picker-trigger .icon.muted { flex: 0; }
    .chevron { color: var(--text-4); transition: transform .15s; } .picker.open .chevron { transform: rotate(180deg); }
    .thumb-xs, .thumb-sm { display: grid; place-items: center; flex: 0 0 auto; overflow: hidden; color: var(--brand); background: var(--brand-50); border-radius: 8px; }
    .thumb-xs { width: 32px; height: 32px; } .thumb-sm { width: 40px; height: 40px; }
    .thumb-xs img, .thumb-sm img { width: 100%; height: 100%; object-fit: cover; }
    .thumb-xs .icon, .thumb-sm .icon { font-size: 18px; }
    .picker-panel { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 30; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: var(--shadow-md); }
    .picker-panel ul { max-height: 260px; margin: 8px 0 0; padding: 0; overflow-y: auto; list-style: none; }
    .picker-panel li button { display: flex; align-items: center; gap: 10px; width: 100%; padding: 8px; background: none; border: 0; border-radius: 8px; text-align: start; }
    .picker-panel li button:hover { background: var(--surface-2); } .picker-panel li button.selected { background: var(--brand-50); }
    .option-text { display: grid; flex: 1; line-height: 1.3; } .option-text strong { font-weight: 550; font-size: 14px; } .option-text small { color: var(--text-3); font-size: 12px; }
    .check { color: var(--brand); }
    .none { padding: 14px; color: var(--text-3); text-align: center; font-size: 13.5px; }
    /* éditeur : texte + photos + barre d'outils */
    .editor { overflow: visible; background: var(--surface); border: 1px solid var(--border-strong); border-radius: 10px; box-shadow: var(--shadow-xs); transition: border-color .15s, box-shadow .15s; }
    .editor:focus-within { border-color: var(--brand); box-shadow: var(--focus); }
    .editor.invalid { border-color: var(--neg); }
    .editor.dragging { border-color: var(--brand); background: var(--brand-50); }
    .editor textarea { display: block; width: 100%; min-height: 140px; padding: 12px 14px; color: var(--text); background: transparent; border: 0; outline: none; resize: vertical; line-height: 1.6; }
    .editor textarea::placeholder { color: var(--text-4); }
    .photos { display: flex; gap: 10px; flex-wrap: wrap; padding: 10px 14px 12px; border-top: 1px dashed var(--border); }
    .photo { position: relative; }
    .photo .thumb { width: 72px; height: 72px; }
    .photo .remove { position: absolute; top: -7px; right: -7px; display: grid; place-items: center; width: 22px; height: 22px; padding: 0; color: #fff; background: var(--text); border: 2px solid var(--surface); border-radius: 50%; }
    .photo .remove .icon { font-size: 14px; }
    .editor-bar { display: flex; align-items: center; gap: 4px; padding: 6px 8px; border-top: 1px solid var(--border); background: var(--surface-2); border-radius: 0 0 10px 10px; }
    .tool { display: inline-flex; align-items: center; gap: 6px; height: 34px; padding: 0 10px; color: var(--text-3); border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 550; }
    .tool:hover { color: var(--brand); background: var(--brand-50); } .tool.disabled { opacity: .45; pointer-events: none; }
    #photo-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .bar-hint { margin-left: auto; font-size: 12px; }
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
    .mine { max-height: 620px; margin: 0; padding: 0; overflow-y: auto; list-style: none; }
    .mine li { display: grid; gap: 8px; padding: 14px 20px; border-bottom: 1px solid var(--border); transition: background .2s; }
    .mine li:last-child { border-bottom: 0; }
    .mine li.new { background: var(--brand-50); animation: fade-in .4s ease both; }
    .mine li.current { background: var(--brand-50); box-shadow: inset 3px 0 0 var(--brand); }
    .mine-head { display: flex; align-items: center; gap: 8px; font-size: 12.5px; }
    .mine-actions { display: flex; gap: 2px; margin-left: auto; opacity: .6; transition: opacity .15s; }
    .mine li:hover .mine-actions, .mine li:focus-within .mine-actions { opacity: 1; }
    .icon-btn { display: grid; place-items: center; width: 30px; height: 30px; color: var(--text-3); background: none; border: 0; border-radius: 7px; }
    .icon-btn .icon { font-size: 18px; } .icon-btn:hover { color: var(--brand); background: var(--surface); } .icon-btn.danger:hover { color: var(--neg); }
    .mine-foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 12.5px; }
    .published { display: inline-flex; align-items: center; gap: 4px; color: var(--pos-text); font-weight: 600; }
    .published .icon { font-size: 15px; }
    .list-skeleton { display: grid; gap: 10px; padding: 16px 20px; }
    .tips { padding: 18px 20px; }
    .tips h3 { display: flex; align-items: center; gap: 8px; } .tips h3 .icon { color: #f5a524; font-size: 20px; }
    .tips ul { display: grid; gap: 6px; margin: 10px 0 0; padding-left: 18px; color: var(--text-2); font-size: 13.5px; }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .hero { flex-direction: column; align-items: flex-start; padding: 24px; } .bar-hint { display: none; } .mine-actions { opacity: 1; } }
  `],
})
export class ClientSpaceComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private readonly api = inject(ClientApi);
  private readonly productApi = inject(ProductApi);
  private readonly confirm = inject(ConfirmService);
  private readonly snack = inject(MatSnackBar);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly lightbox = inject(LightboxService);
  private readonly textArea = viewChild<ElementRef<HTMLTextAreaElement>>('textArea');
  private readonly pickerSearch = viewChild<ElementRef<HTMLInputElement>>('pickerSearch');

  readonly maxText = MAX_TEXT;
  readonly maxPhotos = MAX_PHOTOS;
  product = '';
  rating = 0;
  text = '';
  readonly photos = signal<Photo[]>([]);
  readonly products = signal<Product[]>([]);
  readonly productQuery = signal('');
  readonly pickerOpen = signal(false);
  readonly reviews = signal<MyReview[]>([]);
  readonly total = signal(0);
  readonly loadingList = signal(true);
  readonly loading = signal(false);
  readonly submitted = signal(false);
  readonly dragging = signal(false);
  readonly error = signal('');
  readonly photoError = signal('');
  readonly serverErrors = signal<Record<string, string>>({});
  readonly sent = signal<MyReview | null>(null);
  readonly editingId = signal<number | null>(null);
  readonly highlight = signal<number | null>(null);
  readonly firstName = computed(() => (this.auth.user()?.fullName ?? '').split(' ')[0]);
  readonly filteredProducts = computed(() => {
    const q = this.productQuery().trim().toLowerCase();
    return this.products().filter((p) => !q || p.name.toLowerCase().includes(q) || (p.category ?? '').toLowerCase().includes(q));
  });
  readonly relative = (iso: string) => formatRelative(iso);

  ngOnInit() {
    this.productApi.list().subscribe({ next: (p) => this.products.set(p), error: () => {} });
    this.loadMine();
  }

  ngOnDestroy() { this.revokeAll(); }

  selectedProduct(): Product | undefined {
    return this.products().find((p) => p.name === this.product);
  }

  togglePicker() {
    this.pickerOpen.set(!this.pickerOpen());
    this.productQuery.set('');
    if (this.pickerOpen()) setTimeout(() => this.pickerSearch()?.nativeElement.focus());
  }

  chooseProduct(p: Product) {
    this.product = p.name;
    this.pickerOpen.set(false);
  }

  @HostListener('document:click', ['$event'])
  closePicker(e: MouseEvent) {
    const picker = this.host.nativeElement.querySelector('.picker');
    if (this.pickerOpen() && picker && !picker.contains(e.target as Node)) this.pickerOpen.set(false);
  }

  /** Insère l'émoji à la position du curseur, puis y replace le curseur. */
  insertEmoji(emoji: string) {
    const el = this.textArea()?.nativeElement;
    const start = el?.selectionStart ?? this.text.length;
    const end = el?.selectionEnd ?? this.text.length;
    if (this.text.length + emoji.length > MAX_TEXT) return;
    this.text = this.text.slice(0, start) + emoji + this.text.slice(end);
    setTimeout(() => { el?.focus(); el?.setSelectionRange(start + emoji.length, start + emoji.length); });
  }

  onPhotos(event: Event) {
    const input = event.target as HTMLInputElement;
    this.addPhotos(Array.from(input.files ?? []));
    input.value = '';
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    this.addPhotos(Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/')));
  }

  addPhotos(files: File[]) {
    this.photoError.set('');
    const room = MAX_PHOTOS - this.photos().length;
    if (files.length > room) this.photoError.set(`${MAX_PHOTOS} photos maximum par avis.`);
    const accepted: Photo[] = [];
    for (const f of files.slice(0, Math.max(room, 0))) {
      const problem = imageProblem(f);
      if (problem) { this.photoError.set(`${f.name} : ${problem}`); continue; }
      accepted.push({ url: URL.createObjectURL(f), file: f });
    }
    this.photos.update((list) => [...list, ...accepted]);
  }

  removePhoto(index: number) {
    const ph = this.photos()[index];
    if (ph?.file) URL.revokeObjectURL(ph.url);
    this.photos.update((list) => list.filter((_, i) => i !== index));
    this.photoError.set('');
  }

  zoom(index: number) { this.lightbox.open(this.photos().map((p) => p.url), index); }

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
    const form = {
      product: this.product.trim(), rating: this.rating, text: this.text.trim(),
      keepImages: this.photos().filter((p) => !p.file).map((p) => p.url),
    };
    const files = this.photos().map((p) => p.file).filter((f): f is File => !!f);
    const id = this.editingId();
    const req = id ? this.api.update(id, form, files) : this.api.submit(form, files);
    req.subscribe({
      next: (review) => {
        this.loading.set(false);
        if (id) {
          this.reviews.update((list) => list.map((r) => (r.id === id ? review : r)));
          this.snack.open('Votre avis a été mis à jour', 'OK', { duration: 3500 });
          this.reset();
        } else {
          this.reviews.update((list) => [review, ...list]);
          this.total.update((n) => n + 1);
          this.sent.set(review);
          this.revokeAll();
          this.photos.set([]);
        }
        this.flash(review.id);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        const problem = (e.error ?? {}) as ApiProblem;
        if (e.status === 400 && problem.errors) this.serverErrors.set(problem.errors);
        else if (e.status === 400 && problem.detail?.includes('catalogue')) this.serverErrors.set({ product: problem.detail });
        else if (e.status !== 401) {
          this.error.set(e.status === 0 || e.status === 504
            ? 'Le serveur ne répond pas. Votre avis n’a pas été envoyé, réessayez dans un instant.'
            : problem.detail ?? 'Votre avis n’a pas pu être enregistré. Réessayez.');
        }
      },
    });
  }

  edit(r: MyReview) {
    this.reset();
    this.editingId.set(r.id);
    this.product = r.product;
    this.rating = r.rating;
    this.text = r.text;
    this.photos.set(r.imageUrls.map((url) => ({ url })));
    this.host.nativeElement.querySelector('.compose')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async remove(r: MyReview) {
    const ok = await this.confirm.ask({
      title: 'Supprimer cet avis ?',
      message: `Votre avis sur « ${r.product} » sera définitivement supprimé, ainsi que ses photos.`,
      confirmLabel: 'Supprimer mon avis',
    });
    if (!ok) return;
    this.api.delete(r.id).subscribe(() => {
      this.reviews.update((list) => list.filter((x) => x.id !== r.id));
      this.total.update((n) => Math.max(0, n - 1));
      if (this.editingId() === r.id) this.reset();
      this.snack.open('Avis supprimé', 'OK', { duration: 3000 });
    });
  }

  reset() {
    this.sent.set(null);
    this.editingId.set(null);
    this.submitted.set(false);
    this.error.set('');
    this.photoError.set('');
    this.serverErrors.set({});
    this.product = '';
    this.rating = 0;
    this.text = '';
    this.revokeAll();
    this.photos.set([]);
  }

  private flash(id: number) {
    this.highlight.set(id);
    setTimeout(() => { if (this.highlight() === id) this.highlight.set(null); }, 2500);
  }

  private revokeAll() {
    this.photos().forEach((p) => { if (p.file) URL.revokeObjectURL(p.url); });
  }

  private loadMine() {
    this.loadingList.set(true);
    this.api.mine().subscribe({
      next: (page) => { this.reviews.set(page.content); this.total.set(page.totalElements); this.loadingList.set(false); },
      error: () => this.loadingList.set(false),
    });
  }
}
