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

/** Avis d'un jour, par sentiment (GET /api/dashboard/trend). */
export interface TrendPoint {
  date: string;
  positive: number;
  neutral: number;
  negative: number;
}

export type ReviewSort = 'createdAt' | 'score' | 'product' | 'authorName';

/** Filtres, tri et pagination de la liste des avis (GET /api/reviews). */
export interface ReviewQuery {
  product?: string;
  label?: Sentiment | '';
  /** Recherche dans le texte ou le nom de l'auteur. */
  q?: string;
  /** Période : N derniers jours (vide = tout). */
  days?: number | null;
  sort?: ReviewSort;
  dir?: 'asc' | 'desc';
  page: number;
  size: number;
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
  imageUrls?: string[];
  updatedAt?: string | null;
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
  avatarUrl?: string | null;
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
  imageUrls: string[];
  createdAt: string;
  updatedAt?: string | null;
}

/** Formulaire d'avis client (création ou modification). */
export interface ReviewForm {
  product: string;
  rating: number;
  text: string;
  /** Modification : photos déjà publiées à conserver. */
  keepImages?: string[];
}

/* ---------- Catalogue ---------- */
export interface ProductStats {
  reviewCount: number;
  averageRating: number | null;
  positivePct: number;
  negativePct: number;
}

export interface Product {
  id: number;
  name: string;
  description: string | null;
  category: string | null;
  imageUrl: string | null;
  createdAt: string;
  stats: ProductStats;
}

export interface ProductForm {
  name: string;
  description: string;
  category: string;
  removeImage: boolean;
}

export interface UserRow extends User {
  reviewCount: number;
}

/** Notification temps réel reçue par les administrateurs. */
export interface ReviewEvent {
  type: 'review.created' | 'review.updated' | 'review.deleted';
  id: number;
  text: string;
  product: string;
  label: Sentiment;
  score: number;
  rating: number | null;
  authorName: string | null;
  imageUrls: string[];
  createdAt: string;
}

/** Erreur renvoyée par l'API (ProblemDetail), avec le détail champ par champ en cas de validation. */
export interface ApiProblem {
  detail?: string;
  errors?: Record<string, string>;
}
