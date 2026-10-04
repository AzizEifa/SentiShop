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
  createdAt?: string;
  /** Client auteur de l'avis (absent pour un avis importé ou analysé par un admin). */
  authorName?: string | null;
  rating?: number | null;
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

/* ---------- Comptes et espace client ---------- */
export type Role = 'ADMIN' | 'CLIENT';

export interface User {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  expiresAt: string;
  user: User;
}

/** Avis vu par son auteur (le sentiment détecté reste interne à la boutique). */
export interface MyReview {
  id: number;
  product: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface UserRow extends User {
  reviewCount: number;
}

/** Notification temps réel reçue par les administrateurs. */
export interface ReviewEvent {
  type: 'review.created';
  id: number;
  text: string;
  product: string;
  label: Sentiment;
  score: number;
  rating: number | null;
  authorName: string | null;
  createdAt: string;
}

/** Erreur renvoyée par l'API (ProblemDetail), avec le détail champ par champ en cas de validation. */
export interface ApiProblem {
  detail?: string;
  errors?: Record<string, string>;
}
