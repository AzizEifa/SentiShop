import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ReviewApi } from './review-api.service';
import { DashboardApi } from './dashboard-api.service';

describe('API services (contrat avec le backend Spring)', () => {
  let http: HttpTestingController;
  let reviews: ReviewApi;
  let dashboard: DashboardApi;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    reviews = TestBed.inject(ReviewApi);
    dashboard = TestBed.inject(DashboardApi);
  });

  afterEach(() => http.verify());

  it('POST /api/reviews/analyze avec {text, product}', () => {
    reviews.analyze('Super', 'A').subscribe((r) => expect(r.cached).toBeTrue());
    const req = http.expectOne('/api/reviews/analyze');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'Super', product: 'A' });
    req.flush({ label: 'POSITIVE', score: 0.9, cached: true });
  });

  it("n'envoie pas de produit vide", () => {
    reviews.analyze('Super').subscribe();
    expect(http.expectOne('/api/reviews/analyze').request.body).toEqual({ text: 'Super' });
  });

  it('POST /api/reviews/import en multipart avec le champ "file"', () => {
    reviews.importCsv(new Blob(['text,product\nok,']), 'a.csv').subscribe();
    const req = http.expectOne('/api/reviews/import');
    expect(req.request.body instanceof FormData).toBeTrue();
    expect((req.request.body as FormData).get('file')).toBeTruthy();
    req.flush({ total: 1, analyzed: 1, cacheHits: 0, errors: [] });
  });

  it('POST /api/reviews/compare avec {text} (B3)', () => {
    reviews.compare('المنتج رائع').subscribe();
    const req = http.expectOne('/api/reviews/compare');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'المنتج رائع' });
    req.flush({});
  });

  it('GET /api/reviews avec pagination et filtres', () => {
    reviews.list('casque', 'NEGATIVE', 2, 20).subscribe();
    const req = http.expectOne((r) => r.url === '/api/reviews');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.get('size')).toBe('20');
    expect(req.request.params.get('product')).toBe('casque');
    expect(req.request.params.get('label')).toBe('NEGATIVE');
    req.flush({ content: [], totalElements: 0 });
  });

  it("construit l'URL d'export CSV", () => {
    expect(reviews.exportUrl()).toBe('/api/reviews/export');
    expect(reviews.exportUrl(' Café & thé ')).toBe('/api/reviews/export?product=Caf%C3%A9%20%26%20th%C3%A9');
  });

  it('GET /api/dashboard/stats filtré par produit', () => {
    dashboard.stats('A').subscribe();
    const req = http.expectOne((r) => r.url === '/api/dashboard/stats');
    expect(req.request.params.get('product')).toBe('A');
    req.flush({});
  });

  it('POST /api/dashboard/summary/negative', () => {
    dashboard.summarizeNegatives('').subscribe();
    const req = http.expectOne('/api/dashboard/summary/negative');
    expect(req.request.method).toBe('POST');
    expect(req.request.params.has('product')).toBeFalse();
    req.flush({ summary: 'x', reviewsUsed: 1 });
  });
});
