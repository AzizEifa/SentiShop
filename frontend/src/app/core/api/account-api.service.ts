import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AuthResponse, User } from '../models/models';
import { silentErrors } from '../interceptors/silent-errors';

/** Mon profil : nom, email, mot de passe, photo (client comme administrateur). */
@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly http = inject(HttpClient);

  get() {
    return this.http.get<User>('/api/account');
  }

  /** Renvoie un nouveau jeton (le nom et l'email y figurent). */
  updateProfile(fullName: string, email: string) {
    return this.http.put<AuthResponse>('/api/account', { fullName, email }, silentErrors());
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http.put<void>('/api/account/password', { currentPassword, newPassword }, silentErrors());
  }

  uploadAvatar(image: File) {
    const body = new FormData();
    body.append('image', image);
    return this.http.post<User>('/api/account/avatar', body, silentErrors());
  }

  removeAvatar() {
    return this.http.delete<User>('/api/account/avatar');
  }
}
