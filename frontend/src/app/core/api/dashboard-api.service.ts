// src/app/core/api/dashboard-api.service.ts

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { DashboardStats, SummaryResponse, TrendPoint } from '../models/models';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private http = inject(HttpClient);

  private p = (product: string) =>
    product ? new HttpParams().set('product', product) : new HttpParams();

  /** days : N derniers jours (absent = toute la période). */
  stats(product: string, days?: number | null) {
    const params = days ? this.p(product).set('days', days) : this.p(product);
    return this.http.get<DashboardStats>('/api/dashboard/stats', { params });
  }

  /** Un point par jour sur les N derniers jours. */
  trend(product: string, days: number) {
    return this.http.get<TrendPoint[]>('/api/dashboard/trend', { params: this.p(product).set('days', days) });
  }

  products() {
    return this.http.get<string[]>('/api/dashboard/products');
  }

  summarizeNegatives(product: string) {
    return this.http.post<SummaryResponse>(
      '/api/dashboard/summary/negative',
      null,
      { params: this.p(product) }
    );
  }
}
