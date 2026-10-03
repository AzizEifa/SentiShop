import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AnalyzeResponse, Page, Review, Sentiment } from '../../models/models';

@Injectable({ providedIn: 'root' })
export class ReviewApi {
  private readonly http = inject(HttpClient);

  analyze(text: string, product?: string) {
    return this.http.post<AnalyzeResponse>('/api/reviews/analyze', {
      text,
      ...(product ? { product } : {}),
    });
  }

  list(product: string, label: Sentiment | '', page: number, size: number) {
    let params = new HttpParams().set('page', page).set('size', size);
    if (product) params = params.set('product', product);
    if (label) params = params.set('label', label);
    return this.http.get<Page<Review>>('/api/reviews', { params });
  }
}
