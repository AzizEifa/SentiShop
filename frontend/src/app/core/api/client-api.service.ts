import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MyReview, Page } from '../models/models';
import { silentErrors } from '../interceptors/silent-errors';

/** Espace client : déposer un avis et consulter les siens. */
@Injectable({ providedIn: 'root' })
export class ClientApi {
  private readonly http = inject(HttpClient);

  /** Erreurs affichées dans le formulaire (champ par champ), pas en message global. */
  submit(review: { product: string; rating: number; text: string }) {
    return this.http.post<MyReview>('/api/me/reviews', review, silentErrors());
  }

  mine(page = 0, size = 20) {
    return this.http.get<Page<MyReview>>('/api/me/reviews', { params: new HttpParams().set('page', page).set('size', size) });
  }

  products() {
    return this.http.get<string[]>('/api/products');
  }
}
