import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProductApi } from '../../core/api/product-api.service';
import { ApiProblem, Product, ProductForm } from '../../core/models/models';
import { formatNumber } from '../../core/format';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog.component';
import { StarsComponent } from '../../shared/stars/stars.component';

const MAX_IMAGE = 3 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

/** Image choisie : vérifie le type et la taille avant tout envoi. */
export function imageProblem(file: File): string {
  if (!IMAGE_TYPES.includes(file.type)) return 'Format non pris en charge (JPG, PNG, WEBP ou GIF).';
  if (file.size > MAX_IMAGE) return 'Image trop volumineuse (3 Mo max).';
  return '';
}

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [FormsModule, StarsComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Produits</h1>
        <p class="subtitle">Le catalogue proposé aux clients lorsqu’ils rédigent un avis.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" (click)="openCreate()"><span class="icon">add</span>Ajouter un produit</button>
      </div>
    </header>

    <div class="toolbar">
      <div class="input-group search">
        <span class="icon">search</span>
        <input class="input" type="search" placeholder="Rechercher un produit…" aria-label="Rechercher un produit" [value]="query()" (input)="query.set($any($event.target).value)" />
      </div>
      @if (categories().length) {
        <div class="segmented" role="group" aria-label="Filtrer par catégorie">
          <button type="button" [class.active]="!category()" (click)="category.set('')">Toutes</button>
          @for (c of categories(); track c) { <button type="button" [class.active]="category() === c" (click)="category.set(c)">{{ c }}</button> }
        </div>
      }
      <span class="muted count">{{ filtered().length }} produit{{ filtered().length > 1 ? 's' : '' }}</span>
    </div>

    @if (loading()) {
      <div class="grid">@for (i of [1, 2, 3, 4]; track i) { <span class="skeleton" style="height: 300px; border-radius: 14px"></span> }</div>
    } @else if (filtered().length) {
      <div class="grid">
        @for (p of filtered(); track p.id) {
          <article class="card product fade-in" tabindex="0" (click)="openEdit(p)" (keydown.enter)="openEdit(p)" [attr.aria-label]="'Modifier ' + p.name">
            <div class="cover">
              @if (p.imageUrl) { <img [src]="p.imageUrl" [alt]="p.name" loading="lazy" /> }
              @else { <span class="placeholder"><span class="icon">inventory_2</span>{{ p.name.charAt(0) }}</span> }
              @if (p.category) { <span class="category">{{ p.category }}</span> }
              <div class="card-actions">
                <button class="icon-btn" type="button" title="Modifier" aria-label="Modifier" (click)="$event.stopPropagation(); openEdit(p)"><span class="icon">edit</span></button>
                <button class="icon-btn danger" type="button" title="Supprimer" aria-label="Supprimer" (click)="$event.stopPropagation(); remove(p)"><span class="icon">delete</span></button>
              </div>
            </div>
            <div class="info">
              <h3>{{ p.name }}</h3>
              <p class="desc">{{ p.description || 'Aucune description.' }}</p>
              <div class="stats">
                @if (p.stats.averageRating) { <span class="rating"><app-stars [value]="round(p.stats.averageRating)" />{{ p.stats.averageRating }}</span> }
                <span class="muted">{{ fmt(p.stats.reviewCount) }} avis</span>
              </div>
              @if (p.stats.reviewCount) {
                <div class="satisfaction" [title]="p.stats.positivePct + '% positifs, ' + p.stats.negativePct + '% négatifs'">
                  <div class="stack-bar"><span class="pos" [style.width.%]="p.stats.positivePct"></span><span class="neu" [style.width.%]="100 - p.stats.positivePct - p.stats.negativePct"></span><span class="neg" [style.width.%]="p.stats.negativePct"></span></div>
                  <span class="tabular">{{ p.stats.positivePct }}% satisfaits</span>
                </div>
              }
            </div>
          </article>
        }
      </div>
    } @else {
      <section class="card">
        <div class="empty-state">
          <div class="empty-icon"><span class="icon">inventory_2</span></div>
          <h3>{{ products().length ? 'Aucun produit trouvé' : 'Votre catalogue est vide' }}</h3>
          <p>{{ products().length ? 'Modifiez la recherche ou la catégorie.' : 'Ajoutez vos produits : les clients pourront ensuite les choisir pour donner leur avis.' }}</p>
          @if (!products().length) { <div class="page-actions"><button class="btn btn-primary" type="button" (click)="openCreate()"><span class="icon">add</span>Ajouter un produit</button></div> }
        </div>
      </section>
    }

    @if (editing(); as e) {
      <div class="drawer-backdrop" (click)="close()"></div>
      <aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" (keydown.escape)="close()">
        <header class="drawer-header">
          <div><h2 id="drawer-title">{{ e.id ? 'Modifier le produit' : 'Nouveau produit' }}</h2><p class="muted small">{{ e.id ? 'Les avis existants suivent un changement de nom.' : 'Visible immédiatement par les clients.' }}</p></div>
          <button class="btn btn-ghost btn-icon" type="button" aria-label="Fermer" (click)="close()"><span class="icon">close</span></button>
        </header>
        <form class="drawer-body form" (submit)="$event.preventDefault(); save()" novalidate>
          @if (formError()) { <div class="alert alert-danger"><span class="icon">error</span><div>{{ formError() }}</div></div> }

          <div class="field">
            <span class="label">Image du produit <span class="optional">facultative · 3 Mo max</span></span>
            <label class="dropzone" [class.has-image]="preview()" [class.dragging]="dragging()" for="product-image"
                   (dragover)="$event.preventDefault(); dragging.set(true)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
              @if (preview()) {
                <img [src]="preview()" alt="Aperçu de l'image" />
                <span class="overlay"><span class="icon">photo_camera</span>Changer l’image</span>
              } @else {
                <span class="drop-icon"><span class="icon">add_photo_alternate</span></span>
                <strong>Glissez une image ici</strong>
                <span class="muted small">ou cliquez pour parcourir · JPG, PNG, WEBP</span>
              }
              <input id="product-image" type="file" accept="image/jpeg,image/png,image/webp,image/gif" (change)="onFile($event)" />
            </label>
            @if (imageError()) { <span class="field-error"><span class="icon">error</span>{{ imageError() }}</span> }
            @if (preview()) { <button class="link-btn danger-link" type="button" (click)="clearImage()"><span class="icon">delete</span>Retirer l’image</button> }
          </div>

          <div class="field">
            <label class="label" for="p-name">Nom</label>
            <input id="p-name" class="input" name="name" maxlength="120" [(ngModel)]="form.name" [class.invalid]="!!nameError()" placeholder="Ex. Casque Bluetooth" />
            @if (nameError()) { <span class="field-error"><span class="icon">error</span>{{ nameError() }}</span> }
          </div>
          <div class="field">
            <label class="label" for="p-category">Catégorie <span class="optional">facultative</span></label>
            <input id="p-category" class="input" name="category" maxlength="60" list="category-list" [(ngModel)]="form.category" placeholder="Ex. Audio" />
            <datalist id="category-list">@for (c of categories(); track c) { <option [value]="c"></option> }</datalist>
          </div>
          <div class="field">
            <label class="label" for="p-desc">Description <span class="optional tabular">{{ form.description.length }} / 600</span></label>
            <textarea id="p-desc" class="textarea" name="description" rows="4" maxlength="600" [(ngModel)]="form.description" placeholder="Ce qui distingue ce produit…"></textarea>
          </div>
        </form>
        <footer class="drawer-footer">
          @if (e.id) { <button class="btn btn-ghost spacer danger-text" type="button" (click)="remove(e)"><span class="icon">delete</span>Supprimer</button> }
          <button class="btn btn-secondary" type="button" (click)="close()">Annuler</button>
          <button class="btn btn-primary" type="button" (click)="save()" [disabled]="saving()"><span class="icon">{{ saving() ? 'hourglass_top' : 'check' }}</span>{{ e.id ? 'Enregistrer' : 'Ajouter le produit' }}</button>
        </footer>
      </aside>
    }
  `,
  styles: [`
    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
    .search { width: 280px; } .count { margin-left: auto; font-size: 13px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 18px; }
    .product { display: flex; flex-direction: column; overflow: hidden; cursor: pointer; transition: transform .15s, box-shadow .15s, border-color .15s; }
    .product:hover, .product:focus-visible { transform: translateY(-2px); box-shadow: var(--shadow-md); border-color: var(--border-strong); }
    .cover { position: relative; aspect-ratio: 4 / 3; background: linear-gradient(135deg, var(--brand-50), #e0f2fe); }
    .cover img { width: 100%; height: 100%; object-fit: cover; }
    .placeholder { display: grid; place-content: center; justify-items: center; gap: 4px; height: 100%; color: var(--brand); font-size: 30px; font-weight: 700; }
    .placeholder .icon { font-size: 22px; opacity: .6; }
    .category { position: absolute; top: 10px; left: 10px; padding: 3px 9px; color: var(--text-2); background: rgba(255,255,255,.92); border-radius: 99px; font-size: 11.5px; font-weight: 600; box-shadow: var(--shadow-xs); }
    .card-actions { position: absolute; top: 8px; right: 8px; display: flex; gap: 6px; opacity: 0; transform: translateY(-4px); transition: opacity .15s, transform .15s; }
    .product:hover .card-actions, .product:focus-within .card-actions { opacity: 1; transform: none; }
    .icon-btn { display: grid; place-items: center; width: 32px; height: 32px; color: var(--text-2); background: rgba(255,255,255,.95); border: 0; border-radius: 8px; box-shadow: var(--shadow-sm); }
    .icon-btn .icon { font-size: 18px; } .icon-btn:hover { color: var(--brand); } .icon-btn.danger:hover { color: var(--neg); }
    .info { display: grid; gap: 8px; padding: 14px 16px 16px; }
    .info h3 { font-size: 15px; }
    .desc { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; min-height: 2.9em; overflow: hidden; color: var(--text-3); font-size: 13px; line-height: 1.45; }
    .stats { display: flex; align-items: center; justify-content: space-between; font-size: 13px; }
    .rating { display: inline-flex; align-items: center; gap: 6px; font-weight: 650; }
    .satisfaction { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; color: var(--text-3); font-size: 12px; }
    .form { display: grid; gap: 18px; align-content: start; }
    .small { font-size: 12.5px; }
    .dropzone { position: relative; display: grid; place-items: center; align-content: center; gap: 4px; aspect-ratio: 16 / 9; overflow: hidden; text-align: center; background: var(--surface-2); border: 1.5px dashed var(--border-strong); border-radius: 12px; cursor: pointer; transition: border-color .15s, background .15s; }
    .dropzone:hover, .dropzone.dragging { background: var(--brand-50); border-color: var(--brand); }
    .dropzone.has-image { border-style: solid; }
    .dropzone img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; gap: 8px; color: #fff; background: rgba(16, 24, 40, .45); font-weight: 600; opacity: 0; transition: opacity .15s; }
    .dropzone:hover .overlay { opacity: 1; }
    .drop-icon { display: grid; place-items: center; width: 44px; height: 44px; margin-bottom: 4px; color: var(--brand); background: var(--surface); border: 1px solid var(--border); border-radius: 12px; }
    .dropzone input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .field-error { display: flex; align-items: center; gap: 4px; color: var(--neg-text); font-size: 12.5px; } .field-error .icon { font-size: 15px; }
    .input.invalid { border-color: var(--neg); }
    .danger-link { justify-self: start; color: var(--neg-text); } .danger-text { color: var(--neg-text); }
    @media (max-width: 640px) { .search { width: 100%; } .count { margin-left: 0; } .card-actions { opacity: 1; transform: none; } }
  `],
})
export class ProductsPageComponent implements OnInit, OnDestroy {
  private readonly api = inject(ProductApi);
  private readonly confirm = inject(ConfirmService);
  private readonly snack = inject(MatSnackBar);

  readonly products = signal<Product[]>([]);
  readonly loading = signal(true);
  readonly query = signal('');
  readonly category = signal('');
  readonly editing = signal<Partial<Product> | null>(null);
  readonly preview = signal<string | null>(null);
  readonly imageError = signal('');
  readonly formError = signal('');
  readonly nameError = signal('');
  readonly saving = signal(false);
  readonly dragging = signal(false);
  form: ProductForm = emptyForm();
  private image: File | null = null;
  private objectUrl: string | null = null;

  readonly fmt = formatNumber;
  readonly round = Math.round;
  readonly categories = computed(() => [...new Set(this.products().map((p) => p.category).filter((c): c is string => !!c))].sort());
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.products().filter((p) => (!this.category() || p.category === this.category())
      && (!q || p.name.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q)));
  });

  ngOnInit() { this.load(); }
  ngOnDestroy() { this.revoke(); }

  openCreate() {
    this.reset();
    this.editing.set({});
  }

  openEdit(p: Product) {
    this.reset();
    this.form = { name: p.name, description: p.description ?? '', category: p.category ?? '', removeImage: false };
    this.preview.set(p.imageUrl);
    this.editing.set(p);
  }

  close() { this.editing.set(null); this.revoke(); }

  onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    this.setImage(input.files?.[0] ?? null);
    input.value = '';
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    this.setImage(event.dataTransfer?.files?.[0] ?? null);
  }

  clearImage() {
    this.image = null;
    this.revoke();
    this.preview.set(null);
    this.form.removeImage = true;
  }

  save() {
    this.nameError.set(this.form.name.trim() ? '' : 'Le nom du produit est requis');
    if (this.nameError() || this.saving()) return;
    const current = this.editing();
    this.saving.set(true);
    this.formError.set('');
    const form = { ...this.form, name: this.form.name.trim() };
    const req = current?.id ? this.api.update(current.id, form, this.image) : this.api.create(form, this.image);
    req.subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.products.update((list) => [...list.filter((p) => p.id !== saved.id), saved].sort((a, b) => a.name.localeCompare(b.name)));
        this.snack.open(current?.id ? 'Produit mis à jour' : `« ${saved.name} » a été ajouté au catalogue`, 'OK', { duration: 3500 });
        this.close();
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        const problem = (e.error ?? {}) as ApiProblem;
        if (e.status === 409) this.nameError.set(problem.detail ?? 'Un produit porte déjà ce nom.');
        else if (problem.errors?.['name']) this.nameError.set(problem.errors['name']);
        else this.formError.set(problem.detail ?? 'Enregistrement impossible. Réessayez.');
      },
    });
  }

  async remove(p: Partial<Product>) {
    const ok = await this.confirm.ask({
      title: `Supprimer « ${p.name} » ?`,
      message: p.stats?.reviewCount
        ? `Le produit disparaîtra du catalogue. Ses ${p.stats.reviewCount} avis restent dans l’historique et les statistiques.`
        : 'Le produit disparaîtra du catalogue. Cette action est définitive.',
      confirmLabel: 'Supprimer le produit',
    });
    if (!ok || !p.id) return;
    this.api.delete(p.id).subscribe(() => {
      this.products.update((list) => list.filter((x) => x.id !== p.id));
      this.snack.open('Produit supprimé', 'OK', { duration: 3500 });
      if (this.editing()?.id === p.id) this.close();
    });
  }

  private setImage(file: File | null) {
    if (!file) return;
    const problem = imageProblem(file);
    this.imageError.set(problem);
    if (problem) return;
    this.image = file;
    this.form.removeImage = false;
    this.revoke();
    this.objectUrl = URL.createObjectURL(file);
    this.preview.set(this.objectUrl);
  }

  private load() {
    this.api.list().subscribe({
      next: (list) => { this.products.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  private reset() {
    this.form = emptyForm();
    this.image = null;
    this.revoke();
    this.preview.set(null);
    this.imageError.set('');
    this.formError.set('');
    this.nameError.set('');
  }

  private revoke() {
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = null;
  }
}

const emptyForm = (): ProductForm => ({ name: '', description: '', category: '', removeImage: false });
