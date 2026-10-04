import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ProductApi } from '../../core/api/product-api.service';
import { Product } from '../../core/models/models';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog.component';
import { ProductsPageComponent, imageProblem } from './products-page.component';

const product = (id: number, name: string, category: string | null = 'Audio', reviewCount = 0): Product =>
  ({ id, name, description: 'Desc', category, imageUrl: null, createdAt: '', stats: { reviewCount, averageRating: 4.2, positivePct: 60, negativePct: 20 } });

describe('ProductsPageComponent (catalogue admin)', () => {
  let api: jasmine.SpyObj<ProductApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ProductApi>('ProductApi', ['list', 'create', 'update', 'delete']);
    api.list.and.returnValue(of([product(1, 'Casque'), product(2, 'Tapis', 'Sport', 3)]));
    TestBed.configureTestingModule({
      imports: [ProductsPageComponent],
      providers: [provideHttpClient(), provideNoopAnimations(), { provide: ProductApi, useValue: api }],
    });
    spyOn(URL, 'createObjectURL').and.returnValue('blob:preview');
    spyOn(URL, 'revokeObjectURL');
  });

  it('vérifie le type et la taille des images', () => {
    expect(imageProblem(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toContain('Format');
    expect(imageProblem(new File([new Uint8Array(4 * 1024 * 1024)], 'big.png', { type: 'image/png' }))).toContain('3 Mo');
    expect(imageProblem(new File(['x'], 'ok.webp', { type: 'image/webp' }))).toBe('');
  });

  it('filtre par catégorie et par recherche', () => {
    const cmp = TestBed.createComponent(ProductsPageComponent).componentInstance;
    cmp.ngOnInit();
    expect(cmp.categories()).toEqual(['Audio', 'Sport']);
    cmp.category.set('Sport');
    expect(cmp.filtered().map((p) => p.name)).toEqual(['Tapis']);
    cmp.category.set('');
    cmp.query.set('cas');
    expect(cmp.filtered().map((p) => p.name)).toEqual(['Casque']);
  });

  it('crée un produit avec son image', () => {
    api.create.and.returnValue(of(product(3, 'Enceinte')));
    const cmp = TestBed.createComponent(ProductsPageComponent).componentInstance;
    cmp.ngOnInit();
    cmp.openCreate();
    const file = new File(['x'], 'e.png', { type: 'image/png' });
    cmp.onFile({ target: { files: [file], value: '' } } as unknown as Event);
    expect(cmp.preview()).toBe('blob:preview');
    cmp.form.name = '  Enceinte ';
    cmp.save();
    expect(api.create).toHaveBeenCalledWith({ name: 'Enceinte', description: '', category: '', removeImage: false }, file);
    expect(cmp.products().map((p) => p.name)).toContain('Enceinte');
    expect(cmp.editing()).toBeNull();
  });

  it('nom déjà utilisé : erreur sous le champ', () => {
    api.update.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { detail: 'Un produit porte déjà ce nom.' } })));
    const cmp = TestBed.createComponent(ProductsPageComponent).componentInstance;
    cmp.ngOnInit();
    cmp.openEdit(cmp.products()[0]);
    cmp.form.name = 'Tapis';
    cmp.save();
    expect(cmp.nameError()).toBe('Un produit porte déjà ce nom.');
  });

  it('supprime après confirmation', async () => {
    api.delete.and.returnValue(of(undefined));
    spyOn(TestBed.inject(ConfirmService), 'ask').and.resolveTo(true);
    const cmp = TestBed.createComponent(ProductsPageComponent).componentInstance;
    cmp.ngOnInit();
    await cmp.remove(cmp.products()[1]);
    expect(api.delete).toHaveBeenCalledWith(2);
    expect(cmp.products().length).toBe(1);
  });
});
