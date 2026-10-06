// src/app/core/format.ts — formatage partagé (français)

import { DashboardStats, Sentiment } from './models/models';

export const SENTIMENT_LABEL: Record<Sentiment, string> = {
  POSITIVE: 'Positif',
  NEUTRAL: 'Neutre',
  NEGATIVE: 'Négatif',
};

/** Classe CSS courte utilisée par le design system (.pos / .neu / .neg). */
export const SENTIMENT_CLASS: Record<Sentiment, 'pos' | 'neu' | 'neg'> = {
  POSITIVE: 'pos',
  NEUTRAL: 'neu',
  NEGATIVE: 'neg',
};

const number = new Intl.NumberFormat('fr-FR');
const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

const percent = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });

export const formatNumber = (n: number) => number.format(n);

/** Pourcentage déjà calculé (0 à 100) : 42.857 → « 42,9 % ». */
export const formatPct = (n: number) => `${percent.format(n)} %`;

/** « à l'instant », « il y a 5 min », « hier », puis date courte au-delà d'une semaine. */
export function formatRelative(iso: string | undefined, now = Date.now()): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const s = Math.round((date.getTime() - now) / 1000);
  const abs = Math.abs(s);
  if (abs < 45) return "à l'instant";
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 7 * 86400) return rtf.format(Math.round(s / 86400), 'day');
  return dateFmt.format(date);
}

export interface Verdict {
  tone: 'pos' | 'neu' | 'neg';
  /** Verdict court affiché en badge : « Satisfaits », « Avis partagés », « À surveiller ». */
  short: string;
  title: string;
  message: string;
}

/**
 * Règles du score de satisfaction, réunies ici pour être ajustées sans toucher aux écrans.
 * C'est un indicateur du sentiment détecté par l'IA : il ne mesure pas la note moyenne en étoiles.
 */
export const SATISFACTION_RULES = {
  /** Verdict « Satisfaits » à partir de ce pourcentage d'avis positifs. */
  satisfiedMinPositivePct: 60,
  /** Verdict « À surveiller » à partir de ce pourcentage d'avis négatifs. */
  watchMinNegativePct: 35,
  /** En dessous de ce nombre d'avis sur une période, son évolution n'est pas affichée. */
  minReviewsForTrend: 5,
} as const;

export const SATISFACTION_FORMULA =
  'Score net = % d’avis positifs − % d’avis négatifs, de −100 à +100. Les avis neutres ne comptent ni pour ni contre.';

/** Score net = % positifs − % négatifs (de −100 à +100). */
export const netScore = (s: DashboardStats) => Math.round(s.positivePct - s.negativePct);

/** Traduit les chiffres en une conclusion lisible « en un coup d'œil ». */
export function verdictOf(s: DashboardStats): Verdict {
  if (s.positivePct >= SATISFACTION_RULES.satisfiedMinPositivePct) {
    return { tone: 'pos', short: 'Satisfaits', title: 'Vos clients sont satisfaits', message: `${formatPct(s.positivePct)} des avis sont positifs. Continuez sur cette lancée.` };
  }
  if (s.negativePct >= SATISFACTION_RULES.watchMinNegativePct) {
    return { tone: 'neg', short: 'À surveiller', title: 'Satisfaction à surveiller', message: `${formatPct(s.negativePct)} des avis sont négatifs. Consultez les avis à traiter ci-dessous.` };
  }
  return { tone: 'neu', short: 'Avis partagés', title: 'Avis partagés', message: `${formatPct(s.positivePct)} de positifs pour ${formatPct(s.negativePct)} de négatifs : des points restent à améliorer.` };
}

/**
 * Pourcentages entiers dont la somme fait exactement 100 (méthode du plus fort reste) :
 * 1 / 1 / 1 → 34 / 33 / 33 plutôt que 33 / 33 / 33.
 */
export function roundPercents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (!total) return counts.map(() => 0);
  const raw = counts.map((c) => (c * 100) / total);
  const result = raw.map(Math.floor);
  let rest = 100 - result.reduce((a, b) => a + b, 0);
  raw.map((v, i) => ({ i, frac: v - result[i] }))
    .sort((a, b) => b.frac - a.frac)
    .forEach(({ i }) => { if (rest-- > 0) result[i]++; });
  return result;
}

/** Statistiques à partir des effectifs (pourcentages à une décimale, comme le backend). */
export function statsFromCounts(positive: number, neutral: number, negative: number): DashboardStats {
  const total = positive + neutral + negative;
  const pct = (v: number) => (total ? Math.round((v * 1000) / total) / 10 : 0);
  return { positive, neutral, negative, total, positivePct: pct(positive), neutralPct: pct(neutral), negativePct: pct(negative) };
}

/**
 * Taux d'avis négatifs « lissé » pour classer les produits : un produit avec 1 avis négatif sur 1
 * ne passe pas devant un produit à 40 % de négatifs sur 200 avis. On ajoute `weight` avis au taux
 * moyen de la boutique (moyenne bayésienne) ; l'effet s'estompe à mesure que les avis s'accumulent.
 */
export function smoothedNegativeRate(negativePct: number, reviewCount: number, globalNegativePct: number, weight = 5): number {
  if (!reviewCount) return 0;
  return (negativePct * reviewCount + globalNegativePct * weight) / (reviewCount + weight);
}

const longDate = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
/** « 4 octobre 2026 à 14:32 » */
export const formatDateTime = (iso?: string | null) => (iso ? longDate.format(new Date(iso)) : '—');

/** Initiales pour les avatars : « Sara Benali » → « SB ». */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export const RATING_LABEL = ['', 'Très décevant', 'Décevant', 'Correct', 'Bien', 'Excellent'];
