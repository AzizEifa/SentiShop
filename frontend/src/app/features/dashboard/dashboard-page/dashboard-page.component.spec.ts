import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { DashboardPageComponent } from './dashboard-page.component';

describe('DashboardPageComponent', () => {
  let fixture: ComponentFixture<DashboardPageComponent>;
  let http: HttpTestingController;

  const stats = (positive: number, neutral: number, negative: number) => {
    const total = positive + neutral + negative;
    const pct = (v: number) => (total ? Math.round((v * 1000) / total) / 10 : 0);
    return { positive, neutral, negative, total, positivePct: pct(positive), neutralPct: pct(neutral), negativePct: pct(negative) };
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [DashboardPageComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), provideNoopAnimations(),
        provideCharts(withDefaultRegisterables())],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(DashboardPageComponent);
    fixture.detectChanges();
    http.expectOne('/api/dashboard/products').flush(['A', 'B']);
  });

  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('affiche les pourcentages et alimente le camembert', () => {
    http.expectOne((r) => r.url === '/api/dashboard/stats').flush(stats(2, 1, 1));
    fixture.detectChanges();
    expect(text()).toContain('50% du total');
    expect(text()).toContain('25% du total');
    expect(fixture.componentInstance.chartData().datasets[0].data).toEqual([2, 1, 1]);
    expect((fixture.nativeElement as HTMLElement).querySelector('canvas')).toBeTruthy();
  });

  it("affiche l'état vide quand il n'y a aucun avis", () => {
    http.expectOne((r) => r.url === '/api/dashboard/stats').flush(stats(0, 0, 0));
    fixture.detectChanges();
    expect(text()).toContain('Vos indicateurs apparaîtront ici');
    expect((fixture.nativeElement as HTMLElement).querySelector('canvas')).toBeNull();
  });

  it('signale un backend injoignable', () => {
    http.expectOne((r) => r.url === '/api/dashboard/stats').flush(null, { status: 0, statusText: 'Unknown' });
    fixture.detectChanges();
    expect(text()).toContain('Serveur injoignable');
  });

  it("met à jour l'URL d'export selon le produit filtré", () => {
    http.expectOne((r) => r.url === '/api/dashboard/stats').flush(stats(1, 0, 0));
    fixture.componentInstance.selectProduct({ target: { value: 'B' } } as unknown as Event);
    const req = http.expectOne((r) => r.url === '/api/dashboard/stats');
    expect(req.request.params.get('product')).toBe('B');
    expect(fixture.componentInstance.exportUrl()).toBe('/api/reviews/export?product=B');
  });
});
