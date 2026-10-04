import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ClientApi } from '../../core/api/client-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { MyReview } from '../../core/models/models';
import { ClientSpaceComponent } from './client-space.component';

const review = (id: number, product = 'Casque'): MyReview =>
  ({ id, product, rating: 4, text: 'Très bon produit, je recommande', createdAt: new Date().toISOString() });

describe('ClientSpaceComponent (dépôt d’avis)', () => {
  let api: jasmine.SpyObj<ClientApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ClientApi>('ClientApi', ['submit', 'mine', 'products']);
    api.products.and.returnValue(of(['Casque']));
    api.mine.and.returnValue(of({ content: [review(1)], totalElements: 1 }));
    TestBed.configureTestingModule({
      imports: [ClientSpaceComponent],
      providers: [provideRouter([]), provideHttpClient(), { provide: ClientApi, useValue: api }],
    });
    spyOn(TestBed.inject(AuthService), 'user').and.returnValue(
      { id: 1, email: 'sara@test.local', fullName: 'Sara Benali', role: 'CLIENT', createdAt: '' });
  });

  it('accueille le client par son prénom et affiche ses avis', () => {
    const fixture = TestBed.createComponent(ClientSpaceComponent);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Bonjour Sara');
    expect(fixture.componentInstance.total()).toBe(1);
  });

  it('vérifie produit, note et texte avant d’envoyer', () => {
    const cmp = TestBed.createComponent(ClientSpaceComponent).componentInstance;
    cmp.text = 'Court';
    cmp.submit();
    expect(cmp.fieldError('product')).toBe('Choisissez le produit concerné');
    expect(cmp.fieldError('rating')).toBe('Donnez une note de 1 à 5 étoiles');
    expect(cmp.fieldError('text')).toContain('Encore 5 caractère');
    expect(api.submit).not.toHaveBeenCalled();
  });

  it('publie, remercie et ajoute l’avis en tête de liste', () => {
    api.submit.and.returnValue(of(review(2, 'Montre')));
    const fixture = TestBed.createComponent(ClientSpaceComponent);
    fixture.detectChanges();
    const cmp = fixture.componentInstance;
    Object.assign(cmp, { product: ' Montre ', rating: 5, text: '  Superbe montre, très confortable  ' });
    cmp.submit();
    fixture.detectChanges();

    expect(api.submit).toHaveBeenCalledWith({ product: 'Montre', rating: 5, text: 'Superbe montre, très confortable' });
    expect(cmp.reviews()[0].id).toBe(2);
    expect(cmp.total()).toBe(2);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Merci Sara');
    cmp.reset();
    expect(cmp.sent()).toBeNull();
    expect(cmp.rating).toBe(0);
  });

  it('affiche les erreurs du serveur sous les champs', () => {
    api.submit.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { product: 'Nom de produit trop long' } } })));
    const cmp = TestBed.createComponent(ClientSpaceComponent).componentInstance;
    Object.assign(cmp, { product: 'X', rating: 3, text: 'Un avis suffisamment long' });
    cmp.submit();
    expect(cmp.fieldError('product')).toBe('Nom de produit trop long');
  });

  it('IA indisponible : message clair, l’avis reste dans le formulaire', () => {
    api.submit.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503, error: { detail: 'Réessayez dans quelques instants.' } })));
    const cmp = TestBed.createComponent(ClientSpaceComponent).componentInstance;
    Object.assign(cmp, { product: 'Casque', rating: 3, text: 'Un avis suffisamment long' });
    cmp.submit();
    expect(cmp.error()).toContain('Réessayez');
    expect(cmp.text).toBe('Un avis suffisamment long');
  });
});
