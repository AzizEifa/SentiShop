import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ClientApi } from '../../core/api/client-api.service';
import { ProductApi } from '../../core/api/product-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { MyReview, Product } from '../../core/models/models';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog.component';
import { ClientSpaceComponent, MAX_PHOTOS } from './client-space.component';

const review = (id: number, product = 'Casque', imageUrls: string[] = []): MyReview =>
  ({ id, product, rating: 4, text: 'Très bon produit, je recommande', imageUrls, createdAt: new Date().toISOString() });
const product = (id: number, name: string): Product =>
  ({ id, name, description: null, category: 'Audio', imageUrl: null, createdAt: '', stats: { reviewCount: 0, averageRating: null, positivePct: 0, negativePct: 0 } });
const png = (name = 'a.png') => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' });

describe('ClientSpaceComponent (avis client)', () => {
  let api: jasmine.SpyObj<ClientApi>;
  let confirm: ConfirmService;

  beforeEach(() => {
    api = jasmine.createSpyObj<ClientApi>('ClientApi', ['submit', 'update', 'delete', 'mine']);
    api.mine.and.returnValue(of({ content: [review(1, 'Casque', ['/uploads/reviews/x.png'])], totalElements: 1 }));
    const products = jasmine.createSpyObj<ProductApi>('ProductApi', { list: of([product(1, 'Casque'), product(2, 'Montre')]) });
    TestBed.configureTestingModule({
      imports: [ClientSpaceComponent],
      providers: [provideRouter([]), provideHttpClient(), provideNoopAnimations(),
        { provide: ClientApi, useValue: api }, { provide: ProductApi, useValue: products }],
    });
    spyOn(TestBed.inject(AuthService), 'user').and.returnValue(
      { id: 1, email: 'sara@test.local', fullName: 'Sara Benali', role: 'CLIENT', createdAt: '' });
    confirm = TestBed.inject(ConfirmService);
    spyOn(URL, 'createObjectURL').and.callFake((f: Blob | MediaSource) => `blob:${(f as File).name}`);
    spyOn(URL, 'revokeObjectURL');
  });

  const create = () => {
    const fixture = TestBed.createComponent(ClientSpaceComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('accueille le client et charge le catalogue', () => {
    const fixture = create();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Bonjour Sara');
    expect(fixture.componentInstance.products().map((p) => p.name)).toEqual(['Casque', 'Montre']);
  });

  it('vérifie produit, note et texte avant d’envoyer', () => {
    const cmp = create().componentInstance;
    cmp.text = 'Court';
    cmp.submit();
    expect(cmp.fieldError('product')).toBe('Choisissez le produit concerné');
    expect(cmp.fieldError('rating')).toBe('Donnez une note de 1 à 5 étoiles');
    expect(cmp.fieldError('text')).toContain('Encore 5 caractère');
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('insère un émoji à la position du curseur', () => {
    const fixture = create();
    const cmp = fixture.componentInstance;
    cmp.text = 'Super produit';
    fixture.detectChanges();
    const textarea = (fixture.nativeElement as HTMLElement).querySelector('textarea')!;
    textarea.value = cmp.text;
    textarea.setSelectionRange(5, 5);
    cmp.insertEmoji('😍');
    expect(cmp.text).toBe('Super😍 produit');
  });

  it(`accepte ${MAX_PHOTOS} photos maximum et refuse les fichiers qui ne sont pas des images`, () => {
    const cmp = create().componentInstance;
    cmp.addPhotos([new File(['x'], 'doc.pdf', { type: 'application/pdf' })]);
    expect(cmp.photos().length).toBe(0);
    expect(cmp.photoError()).toContain('Format non pris en charge');
    cmp.addPhotos([png('1.png'), png('2.png'), png('3.png'), png('4.png')]);
    expect(cmp.photos().length).toBe(MAX_PHOTOS);
    expect(cmp.photoError()).toBe(`${MAX_PHOTOS} photos maximum par avis.`);
    cmp.removePhoto(0);
    expect(cmp.photos().length).toBe(MAX_PHOTOS - 1);
  });

  it('publie avec photos, remercie et ajoute l’avis en tête de liste', () => {
    api.submit.and.returnValue(of(review(2, 'Montre')));
    const fixture = create();
    const cmp = fixture.componentInstance;
    cmp.chooseProduct(product(2, 'Montre'));
    Object.assign(cmp, { rating: 5, text: '  Superbe montre 😍 très confortable  ' });
    const photo = png();
    cmp.addPhotos([photo]);
    cmp.submit();
    fixture.detectChanges();

    expect(api.submit).toHaveBeenCalledWith({ product: 'Montre', rating: 5, text: 'Superbe montre 😍 très confortable', keepImages: [] }, [photo]);
    expect(cmp.reviews()[0].id).toBe(2);
    expect(cmp.total()).toBe(2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Merci Sara');
  });

  it('modifie un avis : formulaire prérempli, photos existantes conservées', () => {
    api.update.and.returnValue(of({ ...review(1, 'Casque', ['/uploads/reviews/x.png']), rating: 2 }));
    const cmp = create().componentInstance;
    cmp.edit(cmp.reviews()[0]);
    expect(cmp.editingId()).toBe(1);
    expect(cmp.product).toBe('Casque');
    expect(cmp.photos()).toEqual([{ url: '/uploads/reviews/x.png' }]);

    cmp.rating = 2;
    cmp.submit();
    expect(api.update).toHaveBeenCalledWith(1,
      { product: 'Casque', rating: 2, text: 'Très bon produit, je recommande', keepImages: ['/uploads/reviews/x.png'] }, []);
    expect(cmp.reviews()[0].rating).toBe(2);
    expect(cmp.editingId()).toBeNull(); // retour au formulaire vide
  });

  it('supprime un avis après confirmation seulement', async () => {
    api.delete.and.returnValue(of(undefined));
    const cmp = create().componentInstance;
    spyOn(confirm, 'ask').and.returnValues(Promise.resolve(false), Promise.resolve(true));
    await cmp.remove(cmp.reviews()[0]);
    expect(api.delete).not.toHaveBeenCalled();
    await cmp.remove(cmp.reviews()[0]);
    expect(api.delete).toHaveBeenCalledWith(1);
    expect(cmp.reviews().length).toBe(0);
    expect(cmp.total()).toBe(0);
  });

  it('produit hors catalogue refusé par le serveur : erreur sous le champ produit', () => {
    api.submit.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'Choisissez un produit du catalogue.' } })));
    const cmp = create().componentInstance;
    Object.assign(cmp, { product: 'Inconnu', rating: 3, text: 'Un avis suffisamment long' });
    cmp.submit();
    expect(cmp.fieldError('product')).toBe('Choisissez un produit du catalogue.');
  });
});
