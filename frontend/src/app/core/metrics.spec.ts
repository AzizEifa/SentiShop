import { roundPercents, smoothedNegativeRate, statsFromCounts, verdictOf } from './format';
import { detectLanguage, frequentWords } from './language';

describe('indicateurs', () => {
  it('arrondit des pourcentages dont la somme fait toujours 100', () => {
    expect(roundPercents([1, 1, 1])).toEqual([34, 33, 33]);
    expect(roundPercents([2, 1, 1])).toEqual([50, 25, 25]);
    expect(roundPercents([7, 0, 6]).reduce((a, b) => a + b)).toBe(100);
    expect(roundPercents([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it('calcule les statistiques à partir des effectifs', () => {
    expect(statsFromCounts(3, 1, 0)).toEqual({ positive: 3, neutral: 1, negative: 0, total: 4, positivePct: 75, neutralPct: 25, negativePct: 0 });
  });

  it('donne un verdict court', () => {
    expect(verdictOf(statsFromCounts(8, 1, 1)).short).toBe('Satisfaits');
    expect(verdictOf(statsFromCounts(3, 2, 5)).short).toBe('À surveiller');
    expect(verdictOf(statsFromCounts(4, 4, 2)).short).toBe('Avis partagés');
  });

  it('ne sur-pénalise pas un produit avec un seul avis négatif', () => {
    const single = smoothedNegativeRate(100, 1, 20);   // 1 avis, 100 % négatif
    const many = smoothedNegativeRate(40, 200, 20);    // 200 avis, 40 % négatifs
    expect(many).toBeGreaterThan(single);
    expect(smoothedNegativeRate(0, 0, 20)).toBe(0);
  });
});

describe('langue estimée', () => {
  it('reconnaît l’arabe, le français et l’anglais', () => {
    expect(detectLanguage('المنتج رائع جدا وأنصح به')).toBe('AR');
    expect(detectLanguage('Livraison rapide et produit conforme, je recommande')).toBe('FR');
    expect(detectLanguage('The strap broke after one week, very disappointed')).toBe('EN');
    expect(detectLanguage('👍')).toBe('?');
    expect(detectLanguage('')).toBe('?');
  });

  it('repère les mots qui reviennent dans plusieurs avis', () => {
    const words = frequentWords(['Batterie faible, livraison lente', 'La batterie ne tient pas', 'Livraison lente et colis abîmé']);
    expect(words.map((w) => w.word)).toEqual(['batterie', 'lente']);
    expect(words[0].count).toBe(2);
  });
});
