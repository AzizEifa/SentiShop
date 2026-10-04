import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ReviewApi } from '../../../core/api/review-api.service';
import { DashboardApi } from '../../../core/api/dashboard-api.service';
import { AnalyzePageComponent, EXAMPLES } from './analyze-page.component';

describe('AnalyzePageComponent', () => {
  let api: jasmine.SpyObj<ReviewApi>;

  beforeEach(() => {
    sessionStorage.clear();
    api = jasmine.createSpyObj<ReviewApi>('ReviewApi', ['analyze']);
    const dashboard = jasmine.createSpyObj<DashboardApi>('DashboardApi', { products: of(['Casque Bluetooth']) });
    TestBed.configureTestingModule({
      imports: [AnalyzePageComponent],
      providers: [{ provide: ReviewApi, useValue: api }, { provide: DashboardApi, useValue: dashboard },
        provideRouter([]), provideNoopAnimations()],
    });
  });

  it('remplit le formulaire avec un exemple en un clic', () => {
    const cmp = TestBed.createComponent(AnalyzePageComponent).componentInstance;
    cmp.useExample(EXAMPLES[2]);
    expect(cmp.text).toBe(EXAMPLES[2].text);
    expect(cmp.product).toBe(EXAMPLES[2].product);
  });

  it("analyse, affiche le résultat et l'ajoute à l'historique (sans doublon)", () => {
    api.analyze.and.returnValue(of({ label: 'POSITIVE', score: 0.9, cached: false }));
    const fixture = TestBed.createComponent(AnalyzePageComponent);
    const cmp = fixture.componentInstance;
    cmp.text = '  Super produit  ';
    cmp.product = 'Casque';
    cmp.analyze();
    cmp.analyze();
    fixture.detectChanges();

    expect(api.analyze).toHaveBeenCalledWith('Super produit', 'Casque');
    expect(cmp.result()?.label).toBe('POSITIVE');
    expect(cmp.history().length).toBe(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Analysé par Hugging Face');
  });

  it("signale un résultat issu du cache (aucun crédit consommé)", () => {
    api.analyze.and.returnValue(of({ label: 'NEGATIVE', score: 0.8, cached: true }));
    const fixture = TestBed.createComponent(AnalyzePageComponent);
    fixture.componentInstance.text = 'Nul';
    fixture.componentInstance.analyze();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('aucun crédit Hugging Face consommé');
  });

  it("n'envoie rien si le texte est vide", () => {
    const cmp = TestBed.createComponent(AnalyzePageComponent).componentInstance;
    cmp.text = '   ';
    cmp.analyze();
    expect(api.analyze).not.toHaveBeenCalled();
  });
});
