import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, Role, User } from '../models/models';
import { silentErrors } from '../interceptors/silent-errors';

const STORAGE_KEY = 'sentishop.session';

interface Session { token: string; expiresAt: string; user: User; }

export type LogoutReason = 'expired' | 'manual';

/**
 * Session de l'utilisateur connecté (jeton JWT + profil).
 * « Se souvenir de moi » : localStorage (persiste) ; sinon sessionStorage (onglet uniquement).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly session = signal<Session | null>(readSession());
  private expiryTimer?: ReturnType<typeof setTimeout>;

  readonly user = computed(() => this.session()?.user ?? null);
  readonly isLoggedIn = computed(() => this.session() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  constructor() {
    this.scheduleExpiry();
  }

  /** Jeton valide, ou null (un jeton expiré est retiré immédiatement). */
  token(): string | null {
    const s = this.session();
    if (!s) return null;
    if (Date.parse(s.expiresAt) <= Date.now()) { this.clear(); return null; }
    return s.token;
  }

  login(email: string, password: string, remember = true): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }, silentErrors())
      .pipe(tap((res) => this.store(res, remember)));
  }

  register(fullName: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', { fullName, email, password }, silentErrors())
      .pipe(tap((res) => this.store(res, true)));
  }

  logout(reason: LogoutReason = 'manual') {
    this.clear();
    this.router.navigate(['/login'], reason === 'expired' ? { queryParams: { reason } } : {});
  }

  /** Profil modifié : nouveau jeton (nom / email changés), même mode de conservation qu'à la connexion. */
  replaceSession(res: AuthResponse) {
    this.store(res, isRemembered());
  }

  /** Profil modifié sans nouveau jeton (photo). */
  updateUser(user: User) {
    const s = this.session();
    if (!s) return;
    const next = { ...s, user };
    writeSession(next, isRemembered());
    this.session.set(next);
  }

  /** Page d'accueil selon le rôle. */
  homeUrl(role: Role | undefined = this.user()?.role): string {
    return role === 'ADMIN' ? '/dashboard' : '/espace';
  }

  private store(res: AuthResponse, remember: boolean) {
    const session: Session = { token: res.token, expiresAt: res.expiresAt, user: res.user };
    writeSession(session, remember);
    this.session.set(session);
    this.scheduleExpiry();
  }

  private clear() {
    writeSession(null, false);
    this.session.set(null);
    clearTimeout(this.expiryTimer);
  }

  /** Déconnexion automatique à l'expiration du jeton, avec un message explicite. */
  private scheduleExpiry() {
    clearTimeout(this.expiryTimer);
    const s = this.session();
    if (!s) return;
    const delay = Date.parse(s.expiresAt) - Date.now();
    if (delay <= 0) { this.clear(); return; }
    if (delay < 2_147_483_647) this.expiryTimer = setTimeout(() => this.logout('expired'), delay);
  }
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    const s = raw ? (JSON.parse(raw) as Session) : null;
    return s && Date.parse(s.expiresAt) > Date.now() ? s : null;
  } catch {
    return null;
  }
}

function isRemembered(): boolean {
  try { return localStorage.getItem(STORAGE_KEY) !== null; } catch { return false; }
}

function writeSession(session: Session | null, remember: boolean) {
  try {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (session) (remember ? localStorage : sessionStorage).setItem(STORAGE_KEY, JSON.stringify(session));
  } catch { /* stockage indisponible (navigation privée) : session en mémoire seulement */ }
}
