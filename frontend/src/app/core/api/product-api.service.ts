import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Product, ProductForm } from '../models/models';
import { silentErrors } from '../interceptors/silent-errors';

/** Catalogue : lecture pour tous, gestion réservée aux administrateurs. */
@Injectable({ providedIn: 'root' })
export class ProductApi {
  private readonly http = inject(HttpClient);

  list() {
    return this.http.get<Product[]>('/api/products');
  }

  create(form: ProductForm, image: File | null) {
    return this.http.post<Product>('/api/admin/products', productBody(form, image), silentErrors());
  }

  update(id: number, form: ProductForm, image: File | null) {
    return this.http.put<Product>(`/api/admin/products/${id}`, productBody(form, image), silentErrors());
  }

  delete(id: number) {
    return this.http.delete<void>(`/api/admin/products/${id}`);
  }
}

/** Multipart : partie "product" en JSON + image facultative. */
function productBody(form: ProductForm, image: File | null): FormData {
  const body = new FormData();
  body.append('product', new Blob([JSON.stringify(form)], { type: 'application/json' }));
  if (image) body.append('image', image);
  return body;
}
