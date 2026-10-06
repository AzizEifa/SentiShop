import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ReviewApi } from '../../../core/api/review-api.service';
import { CompareResponse, Sentiment } from '../../../core/models/models';
import { ARABIC_CASES, ComparePageComponent } from './compare-page.component';

const response = (multi: Sentiment, english: Sentiment): CompareResponse => ({
  multilingual: { model: 'xlm', label: multi, score: 0.9, cached: false },
  english: { model: 'en', label: english, score: 0.5, cached: false },
  agree: multi === english,
});

describe('ComparePageComponent (B3)', () => {
  let api: jasmine.SpyObj<ReviewApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ReviewApi>('ReviewApi', ['compare']);
    TestBed.configureTestingModule({
      imports: [ComparePageComponent],
      providers: [{ provide: ReviewApi, useValue: api }, provideNoopAnimations()],
    });
  });

  it('propose un jeu de test arabe couvrant les 3 sentiments', () => {
    const cmp = TestBed.createComponent(ComparePageComponent).componentInstance;
    expect(cmp.cases().length).toBe(ARABIC_CASES.length);
    expect(new Set(ARABIC_CASES.map((c) => c.expected))).toEqual(new Set(['POSITIVE', 'NEUTRAL', 'NEGATIVE']));
  });

  it('compte les bonnes réponses de chaque modèle et leur accord', async () => {
    // le multilingue a toujours raison, l'anglais répond toujours "neutre"
    api.compare.and.callFake((text: string) =>
      of(response(ARABIC_CASES.find((c) => c.text === text)!.expected, 'NEUTRAL')));
    const fixture = TestBed.createComponent(ComparePageComponent);
    await fixture.componentInstance.runAll();
    fixture.detectChanges();

    expect(api.compare).toHaveBeenCalledTimes(ARABIC_CASES.length);
    expect(fixture.componentInstance.accuracy()).toEqual({ done: 12, multi: 12, english: 4, agree: 4 });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('12 / 12');
  });

  it("un échec n'arrête pas la comparaison, un quota dépassé si", async () => {
    api.compare.and.returnValues(
      throwError(() => ({ status: 502 })),
      of(response('POSITIVE', 'POSITIVE')),
      throwError(() => ({ status: 429 })),
    );
    const cmp = TestBed.createComponent(ComparePageComponent).componentInstance;
    await cmp.runAll();

    expect(api.compare).toHaveBeenCalledTimes(3);
    expect(cmp.cases()[0].error).toBeTrue();
    expect(cmp.cases()[1].result).toBeTruthy();
    expect(cmp.running()).toBeFalse();
  });

  it('permet d’ajouter et de retirer un avis', () => {
    const cmp = TestBed.createComponent(ComparePageComponent).componentInstance;
    cmp.newText = 'سيء';
    cmp.newExpected = 'NEGATIVE';
    cmp.add(new Event('submit'));
    expect(cmp.cases().at(-1)).toEqual({ text: 'سيء', expected: 'NEGATIVE' });
    cmp.remove(0);
    expect(cmp.cases().length).toBe(ARABIC_CASES.length);
  });
});
