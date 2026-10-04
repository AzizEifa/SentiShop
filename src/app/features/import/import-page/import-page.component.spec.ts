import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ReviewApi } from '../../../core/api/review-api.service';
import { CHUNK_SIZE, ImportPageComponent, remapLine } from './import-page.component';

describe('ImportPageComponent', () => {
  let api: jasmine.SpyObj<ReviewApi>;

  beforeEach(() => {
    api = jasmine.createSpyObj<ReviewApi>('ReviewApi', ['importCsv']);
    TestBed.configureTestingModule({
      imports: [ImportPageComponent],
      providers: [{ provide: ReviewApi, useValue: api }, provideRouter([]), provideNoopAnimations()],
    });
  });

  const csvFile = (rows: number) =>
    new File(['texte;produit\n' + Array.from({ length: rows }, (_, i) => `avis ${i};P`).join('\n')], 'avis.csv');

  it('envoie le fichier par lots et additionne les rapports', async () => {
    api.importCsv.and.returnValues(
      of({ total: CHUNK_SIZE, analyzed: CHUNK_SIZE, cacheHits: 10, errors: [] }),
      of({ total: 5, analyzed: 4, cacheHits: 1, errors: ['Ligne 2 : API IA indisponible (500)'] }),
    );
    const cmp = TestBed.createComponent(ImportPageComponent).componentInstance;
    await cmp.selectFile(csvFile(CHUNK_SIZE + 5));
    await cmp.upload();

    expect(api.importCsv).toHaveBeenCalledTimes(2);
    expect(cmp.report()).toEqual({
      total: CHUNK_SIZE + 5, analyzed: CHUNK_SIZE + 4, cacheHits: 11,
      // ligne 2 du 2e lot = 52e avis = ligne 53 du fichier (en-tête en ligne 1)
      errors: [`Ligne ${CHUNK_SIZE + 3} : API IA indisponible (500)`],
    });
    expect(cmp.progress()).toBe(100);
    expect(cmp.loading()).toBeFalse();
  });

  it("envoie au backend l'en-tête exact text,product", async () => {
    api.importCsv.and.returnValue(of({ total: 1, analyzed: 1, cacheHits: 0, errors: [] }));
    const cmp = TestBed.createComponent(ImportPageComponent).componentInstance;
    await cmp.selectFile(csvFile(1));
    await cmp.upload();
    const sent = await (api.importCsv.calls.first().args[0] as Blob).text();
    expect(sent).toBe('text,product\n"avis 0","P"');
  });

  it("s'arrête dès que le quota Hugging Face est dépassé", async () => {
    api.importCsv.and.returnValue(of({ total: 3, analyzed: 2, cacheHits: 0, errors: ['Ligne 3 : Quota Hugging Face dépassé'] }));
    const cmp = TestBed.createComponent(ImportPageComponent).componentInstance;
    await cmp.selectFile(csvFile(CHUNK_SIZE * 3));
    await cmp.upload();
    expect(api.importCsv).toHaveBeenCalledTimes(1);
    expect(cmp.report()!.errors.at(-1)).toContain('quota');
  });

  it('garde le rapport partiel si le serveur tombe', async () => {
    api.importCsv.and.returnValue(throwError(() => new Error('down')));
    const cmp = TestBed.createComponent(ImportPageComponent).componentInstance;
    await cmp.selectFile(csvFile(2));
    await cmp.upload();
    expect(cmp.report()!.errors).toEqual(['Import interrompu : le serveur ne répond pas.']);
    expect(cmp.loading()).toBeFalse();
  });

  it('refuse un fichier sans avis', async () => {
    const cmp = TestBed.createComponent(ImportPageComponent).componentInstance;
    await cmp.selectFile(new File(['text,product\n'], 'vide.csv'));
    expect(cmp.parseError()).toContain('Aucun avis');
  });

  it('renumérote les erreurs selon le fichier d’origine', () => {
    const part = [{ line: 10, text: 'a', product: '' }, { line: 12, text: 'b', product: '' }];
    expect(remapLine('Ligne 2 : texte vide', part)).toBe('Ligne 12 : texte vide');
    expect(remapLine('Autre erreur', part)).toBe('Autre erreur');
  });
});
