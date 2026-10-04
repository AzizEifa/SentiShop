import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Review, Role, UserRow } from '../models/models';

/** Administration : comptes et modération des avis. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  users() {
    return this.http.get<UserRow[]>('/api/admin/users');
  }

  changeRole(id: number, role: Role) {
    return this.http.put<UserRow>(`/api/admin/users/${id}/role`, { role });
  }

  deleteUser(id: number) {
    return this.http.delete<void>(`/api/admin/users/${id}`);
  }

  review(id: number) {
    return this.http.get<Review>(`/api/admin/reviews/${id}`);
  }

  deleteReview(id: number) {
    return this.http.delete<void>(`/api/admin/reviews/${id}`);
  }
}
