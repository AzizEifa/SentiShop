import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { tap } from 'rxjs';
import { silentErrors } from '../interceptors/silent-errors';
import { AnalyzeResponse, CompareResponse, ImportReport, Page, Review, ReviewQuery, Sentiment } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ReviewApi {
  private readonly http = inject(HttpClient);

  /** Erreurs affichées par la page d'analyse elle-même (états « IA indisponible », « quota »…). */
  analyze(text: string, product?: string) {
    return this.http.post<AnalyzeResponse>('/api/reviews/analyze', {
      text,
      ...(product ? { product } : {}),
    }, silentErrors());
  }

  /** Envoie un CSV "text,product" (multipart, champ "file"). */
  importCsv(csv: Blob, fileName = 'avis.csv') {
    const body = new FormData();
    body.append('file', csv, fileName);
    return this.http.post<ImportReport>('/api/reviews/import', body);
  }

  /** B3 : même texte analysé par le modèle multilingue et par un modèle anglais seul. */
  compare(text: string) {
    return this.http.post<CompareResponse>('/api/reviews/compare', { text });
  }

  list(product: string, label: Sentiment | '', page: number, size: number) {
    return this.search({ product, label, page, size });
  }

  /** Liste filtrée, triée et paginée par le serveur. */
  search(query: ReviewQuery) {
    let params = new HttpParams().set('page', query.page).set('size', query.size);
    if (query.product) params = params.set('product', query.product);
    if (query.label) params = params.set('label', query.label);
    if (query.q?.trim()) params = params.set('q', query.q.trim());
    if (query.days) params = params.set('days', query.days);
    if (query.sort) params = params.set('sort', `${query.sort},${query.dir ?? 'desc'}`);
    return this.http.get<Page<Review>>('/api/reviews', { params });
  }

  /** URL de l'export CSV (filtré par produit si besoin). */
  exportUrl(product = '') {
    const p = product.trim();
    return '/api/reviews/export' + (p ? `?product=${encodeURIComponent(p)}` : '');
  }

  /**
   * Télécharge l'export CSV. Passe par HttpClient pour envoyer le jeton
   * (un simple lien <a href> ne porte pas l'en-tête Authorization).
   */
  downloadCsv(product = '') {
    return this.http.get(this.exportUrl(product), { responseType: 'blob' }).pipe(
      tap((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = product.trim() ? `avis-${slug(product)}.csv` : 'avis.csv';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      })
    );
  }
}

const slug = (s: string) => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
