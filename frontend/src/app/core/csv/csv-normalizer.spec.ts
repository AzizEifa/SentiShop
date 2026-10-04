import { MAX_PRODUCT, MAX_ROWS, MAX_TEXT, chunk, detectDelimiter, parseReviewsCsv, toBackendCsv } from './csv-normalizer';

describe('csv-normalizer', () => {
  it('lit le format attendu par le backend (text,product)', () => {
    const p = parseReviewsCsv('text,product\nTrès bon service,Produit A\nLivraison en retard,Produit B');
    expect(p.hasHeader).toBeTrue();
    expect(p.rows).toEqual([
      { line: 2, text: 'Très bon service', product: 'Produit A' },
      { line: 3, text: 'Livraison en retard', product: 'Produit B' },
    ]);
  });

  it('accepte un export Excel FR : point-virgule, en-têtes français, BOM et CRLF', () => {
    const p = parseReviewsCsv('﻿Produit;Texte\r\nCasque;Le son est excellent\r\n');
    expect(p.delimiter).toBe(';');
    expect(p.rows).toEqual([{ line: 2, text: 'Le son est excellent', product: 'Casque' }]);
  });

  it('garde intacts les avis arabes', () => {
    const p = parseReviewsCsv('avis,produit\nالمنتج رائع جدا,هاتف');
    expect(p.rows[0].text).toBe('المنتج رائع جدا');
    expect(p.rows[0].product).toBe('هاتف');
  });

  it('sans en-tête reconnu : 1re colonne = texte, 2e = produit', () => {
    const p = parseReviewsCsv('Super produit,A\nNul,B');
    expect(p.hasHeader).toBeFalse();
    expect(p.rows.map((r) => r.text)).toEqual(['Super produit', 'Nul']);
  });

  it('gère les guillemets, les virgules et les retours à la ligne dans un champ', () => {
    const p = parseReviewsCsv('text,product\n"Bien, mais ""cher""\nvraiment",X\nOK,Y');
    expect(p.rows[0].text).toBe('Bien, mais "cher"\nvraiment');
    expect(p.rows[1]).toEqual({ line: 4, text: 'OK', product: 'Y' });
  });

  it('ignore les lignes vides et signale les lignes sans texte', () => {
    const p = parseReviewsCsv('text,product\n\nBon,A\n,B\n');
    expect(p.rows.length).toBe(1);
    expect(p.warnings).toContain('1 ligne(s) sans texte ignorée(s)');
  });

  it('tronque texte et produit aux limites du backend', () => {
    const p = parseReviewsCsv(`text,product\n${'a'.repeat(MAX_TEXT + 5)},${'p'.repeat(MAX_PRODUCT + 5)}`);
    expect(p.rows[0].text.length).toBe(MAX_TEXT);
    expect(p.rows[0].product.length).toBe(MAX_PRODUCT);
    expect(p.warnings.length).toBe(2);
  });

  it(`limite l'import à ${MAX_ROWS} avis`, () => {
    const lines = Array.from({ length: MAX_ROWS + 3 }, (_, i) => `avis ${i},P`);
    expect(parseReviewsCsv('text,product\n' + lines.join('\n')).rows.length).toBe(MAX_ROWS);
  });

  it('produit un CSV conforme pour le backend', () => {
    const csv = toBackendCsv([{ line: 2, text: 'Dit "wow", vraiment', product: '' }]);
    expect(csv).toBe('text,product\n"Dit ""wow"", vraiment",""');
  });

  it('détecte le séparateur et découpe en lots', () => {
    expect(detectDelimiter('a;b;c')).toBe(';');
    expect(detectDelimiter('"a;b",c')).toBe(',');
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
