import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { DashboardPageComponent } from './dashboard-page.component';

const stats = (positive: number, neutral: number, negative: number) => {
  const total = positive + neutral + negative;
  const pct = (v: number) => (total ? Math.round((v * 1000) / total) / 10 : 0);
  return { positive, neutral, negative, total, positivePct: pct(positive), neutralPct: pct(neutral), negativePct: pct(negative) };
};

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;
  let http: HttpTestingController;

  /** Statistiques globales (sans paramètre produit) ou d'un produit précis. */
  const statsReq = (product?: string): TestRequest =>
    http.expectOne((r) => r.url === '/api/dashboard/stats' && r.params.get('product') === (product ?? null));
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations(),
        provideCharts(withDefaultRegisterables())],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.url === '/api/reviews' && r.params.get('label') === 'NEGATIVE')
      .flush({ content: [{ id: 1, text: 'Colis abîmé', product: 'A', label: 'NEGATIVE', score: 0.9 }], totalElements: 1 });
  });

  it('affiche les pourcentages, le verdict et alimente le camembert', () => {
    http.expectOne('/api/dashboard/products').flush([]);
    statsReq().flush(stats(2, 1, 1));
    fixture.detectChanges();
    expect(text()).toContain('50%');
    expect(text()).toContain('25%');
    expect(text()).toContain('Avis partagés');
    expect(fixture.componentInstance.chartData().datasets[0].data).toEqual([2, 1, 1]);
    expect((fixture.nativeElement as HTMLElement).querySelector('canvas')).toBeTruthy();
    expect(text()).toContain('Colis abîmé'); // avis à traiter
  });

  it('conclut que les clients sont satisfaits avec un score net positif', () => {
    http.expectOne('/api/dashboard/products').flush([]);
    statsReq().flush(stats(8, 1, 1));
    fixture.detectChanges();
    expect(text()).toContain('Vos clients sont satisfaits');
    expect(fixture.componentInstance.net()).toBe(70);
  });

  it('classe les produits du plus critiqué au moins critiqué', () => {
    http.expectOne('/api/dashboard/products').flush(['A', 'B']);
    statsReq().flush(stats(4, 0, 3));
    statsReq('A').flush(stats(3, 0, 0));
    statsReq('B').flush(stats(1, 0, 3));
    fixture.detectChanges();
    expect(fixture.componentInstance.productRows().map((r) => r.product)).toEqual(['B', 'A']);
    expect(text()).toContain('À surveiller');
  });

  it("affiche un parcours de démarrage quand il n'y a aucun avis", () => {
    http.expectOne('/api/dashboard/products').flush([]);
    statsReq().flush(stats(0, 0, 0));
    fixture.detectChanges();
    expect(text()).toContain('Aucun avis pour le moment');
    expect((fixture.nativeElement as HTMLElement).querySelector('canvas')).toBeNull();
  });

  it('signale un backend injoignable', () => {
    http.expectOne('/api/dashboard/products').flush([]);
    statsReq().flush(null, { status: 0, statusText: 'Unknown' });
    fixture.detectChanges();
    expect(text()).toContain('Serveur injoignable');
  });

  it('filtre par produit : statistiques, avis à traiter et export', () => {
    http.expectOne('/api/dashboard/products').flush([]);
    statsReq().flush(stats(1, 0, 0));
    fixture.componentInstance.selectProduct('B');
    statsReq('B').flush(stats(1, 0, 0));
    expect(http.expectOne((r) => r.url === '/api/reviews' && r.params.get('product') === 'B').request.params.get('label')).toBe('NEGATIVE');
    expect(fixture.componentInstance.exportUrl()).toBe('/api/reviews/export?product=B');
  });
});
