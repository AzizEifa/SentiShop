import { formatRelative, netScore, verdictOf } from './format';

const s = (positivePct: number, neutralPct: number, negativePct: number) =>
  ({ positive: 0, neutral: 0, negative: 0, total: 10, positivePct, neutralPct, negativePct });

describe('format', () => {
  it('traduit les chiffres en verdict', () => {
    expect(verdictOf(s(70, 20, 10)).tone).toBe('pos');
    expect(verdictOf(s(40, 20, 40)).tone).toBe('neg');
    expect(verdictOf(s(45, 30, 25)).tone).toBe('neu');
  });

  it('calcule le score net (% positifs − % négatifs)', () => {
    expect(netScore(s(70, 20, 10))).toBe(60);
    expect(netScore(s(20, 30, 50))).toBe(-30);
  });

  it('affiche des dates relatives en français', () => {
    const now = Date.parse('2026-10-04T12:00:00Z');
    expect(formatRelative('2026-10-04T11:59:50Z', now)).toBe("à l'instant");
    expect(formatRelative('2026-10-04T11:55:00Z', now)).toBe('il y a 5 minutes');
    expect(formatRelative('2026-10-03T12:00:00Z', now)).toBe('hier');
    expect(formatRelative(undefined, now)).toBe('—');
  });
});
