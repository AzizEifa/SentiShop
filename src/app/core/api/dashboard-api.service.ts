// src/app/core/api/dashboard-api.service.ts

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { DashboardStats, SummaryResponse } from '../../models/models';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private http = inject(HttpClient);

  private p = (product: string) =>
    product ? new HttpParams().set('product', product) : new HttpParams();

  stats(product: string) {
    return this.http.get<DashboardStats>('/api/dashboard/stats', {
      params: this.p(product),
    });
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
