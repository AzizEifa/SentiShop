import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { MyReview, Page, ReviewForm } from '../models/models';
import { silentErrors } from '../interceptors/silent-errors';

/** Espace client : déposer, consulter, modifier et supprimer ses avis. */
@Injectable({ providedIn: 'root' })
export class ClientApi {
  private readonly http = inject(HttpClient);

  /** Erreurs affichées dans le formulaire (champ par champ), pas en message global. */
  submit(review: ReviewForm, images: File[] = []) {
    return this.http.post<MyReview>('/api/me/reviews', reviewBody(review, images), silentErrors());
  }

  update(id: number, review: ReviewForm, images: File[] = []) {
    return this.http.put<MyReview>(`/api/me/reviews/${id}`, reviewBody(review, images), silentErrors());
  }

  delete(id: number) {
    return this.http.delete<void>(`/api/me/reviews/${id}`);
  }

  mine(page = 0, size = 20) {
    return this.http.get<Page<MyReview>>('/api/me/reviews', { params: new HttpParams().set('page', page).set('size', size) });
  }
}

/** Multipart : partie "review" en JSON + photos. */
function reviewBody(review: ReviewForm, images: File[]): FormData {
  const body = new FormData();
  body.append('review', new Blob([JSON.stringify(review)], { type: 'application/json' }));
  images.forEach((f) => body.append('images', f));
  return body;
}
