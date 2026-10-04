import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { AuthService } from './auth.service';
import { guestGuard, roleGuard } from './auth.guards';
import { authInterceptor } from './auth.interceptor';
import { errorInterceptor } from '../interceptors/error.interceptor';
import { AuthResponse, Role } from '../models/models';

const response = (role: Role, minutes = 60): AuthResponse => ({
  token: `jwt-${role}`,
  expiresAt: new Date(Date.now() + minutes * 60_000).toISOString(),
  user: { id: 1, email: 'x@test.local', fullName: 'Sara Benali', role, createdAt: new Date().toISOString() },
});

describe('Authentification (front)', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideNoopAnimations(),
        provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
  });

  afterEach(() => { localStorage.clear(); sessionStorage.clear(); });

  const login = (role: Role, remember = true, minutes = 60) => {
    auth.login('x@test.local', 'secret', remember).subscribe();
    http.expectOne('/api/auth/login').flush(response(role, minutes));
  };

  it('connexion : stocke la session et donne la page d’accueil du rôle', () => {
    login('ADMIN');
    expect(auth.isLoggedIn()).toBeTrue();
    expect(auth.isAdmin()).toBeTrue();
    expect(auth.homeUrl()).toBe('/dashboard');
    expect(localStorage.getItem('sentishop.session')).toContain('jwt-ADMIN');
  });

  it('« Se souvenir de moi » décoché : session limitée à l’onglet', () => {
    login('CLIENT', false);
    expect(localStorage.getItem('sentishop.session')).toBeNull();
    expect(sessionStorage.getItem('sentishop.session')).toContain('jwt-CLIENT');
    expect(auth.homeUrl()).toBe('/espace');
  });

  it('ajoute le jeton aux appels de l’API uniquement', () => {
    login('ADMIN');
    const client = TestBed.inject(HttpClient);
    client.get('/api/dashboard/stats').subscribe();
    client.get('https://example.com/data').subscribe();
    expect(http.expectOne('/api/dashboard/stats').request.headers.get('Authorization')).toBe('Bearer jwt-ADMIN');
    expect(http.expectOne('https://example.com/data').request.headers.has('Authorization')).toBeFalse();
  });

  it('jeton expiré : ignoré', () => {
    login('ADMIN', true, -1);
    expect(auth.token()).toBeNull();
    expect(auth.isLoggedIn()).toBeFalse();
  });

  it('401 pendant la navigation : déconnexion avec le motif « expirée »', () => {
    login('ADMIN');
    TestBed.inject(HttpClient).get('/api/reviews').subscribe({ error: () => {} });
    http.expectOne('/api/reviews').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.isLoggedIn()).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], { queryParams: { reason: 'expired' } });
  });

  it('401 à la connexion (mauvais mot de passe) : pas de déconnexion forcée', () => {
    auth.login('x@test.local', 'faux').subscribe({ error: () => {} });
    http.expectOne('/api/auth/login').flush({ detail: 'Email ou mot de passe incorrect.' }, { status: 401, statusText: 'Unauthorized' });
    expect(router.navigate).not.toHaveBeenCalled();
  });

  describe('gardes de navigation', () => {
    const state = (url: string) => ({ url }) as RouterStateSnapshot;
    const run = (guard: typeof guestGuard, url = '/dashboard') =>
      TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, state(url)));
    const path = (r: unknown) => router.serializeUrl(r as UrlTree);

    it('non connecté → /login avec retour prévu', () => {
      expect(path(run(roleGuard('ADMIN')))).toBe('/login?redirect=%2Fdashboard');
    });

    it('client sur une page admin → son espace ; admin sur sa page → autorisé', () => {
      login('CLIENT');
      expect(path(run(roleGuard('ADMIN')))).toBe('/espace');
      expect(run(roleGuard('CLIENT'), '/espace')).toBeTrue();
    });

    it('déjà connecté sur /login → redirigé vers son espace', () => {
      expect(run(guestGuard, '/login')).toBeTrue();
      login('ADMIN');
      expect(path(run(guestGuard, '/login'))).toBe('/dashboard');
    });
  });
});
