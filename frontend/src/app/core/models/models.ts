// src/app/core/models/models.ts

export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export interface AnalyzeResponse {
  label: Sentiment;
  score: number;
  cached: boolean;
}

export interface ImportReport {
  total: number;
  analyzed: number;
  cacheHits: number;
  errors: string[];
}

export interface DashboardStats {
  positive: number;
  neutral: number;
  negative: number;
  total: number;
  positivePct: number;
  neutralPct: number;
  negativePct: number;
}

export interface SummaryResponse {
  summary: string;
  reviewsUsed: number;
}

export interface Review {
  id: number;
  text: string;
  product: string | null;
  label: Sentiment;
  score: number;
}

export interface Page<T> {
  content: T[];
  totalElements: number;
}
/** B3 : comparaison multilingue / anglais seul */
export interface ModelResult {
  model: string;
  label: Sentiment;
  score: number;
  cached: boolean;
}

export interface CompareResponse {
  multilingual: ModelResult;
  english: ModelResult;
  agree: boolean;
}
