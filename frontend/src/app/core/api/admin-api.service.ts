import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { UserRow } from '../models/models';

@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  users() {
    return this.http.get<UserRow[]>('/api/admin/users');
  }
}
