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

export const formatNumber = (n: number) => number.format(n);

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
  title: string;
  message: string;
}

/** Score net = % positifs − % négatifs (de −100 à +100). */
export const netScore = (s: DashboardStats) => Math.round(s.positivePct - s.negativePct);

/** Traduit les chiffres en une conclusion lisible « en un coup d'œil ». */
export function verdictOf(s: DashboardStats): Verdict {
  if (s.positivePct >= 60) {
    return { tone: 'pos', title: 'Vos clients sont satisfaits', message: `${s.positivePct}% des avis sont positifs. Continuez sur cette lancée.` };
  }
  if (s.negativePct >= 35) {
    return { tone: 'neg', title: 'Satisfaction à surveiller', message: `${s.negativePct}% des avis sont négatifs. Consultez les avis à traiter ci-dessous.` };
  }
  return { tone: 'neu', title: 'Avis partagés', message: `${s.positivePct}% de positifs pour ${s.negativePct}% de négatifs : des points restent à améliorer.` };
}

/** Initiales pour les avatars : « Sara Benali » → « SB ». */
export function initials(name: string | null | undefined): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}

export const RATING_LABEL = ['', 'Très décevant', 'Décevant', 'Correct', 'Bien', 'Excellent'];
