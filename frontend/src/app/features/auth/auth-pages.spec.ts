import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AuthResponse, Role } from '../../core/models/models';
import { LoginPageComponent } from './login-page.component';
import { RegisterPageComponent, passwordStrength } from './register-page.component';

const ok = (role: Role): AuthResponse => ({
  token: 't', expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
  user: { id: 1, email: 'a@b.c', fullName: 'Sara', role, createdAt: '' },
});
const httpError = (status: number, error: object) => throwError(() => new HttpErrorResponse({ status, error }));

describe('Pages connexion / inscription', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let router: Router;

  function setup(query: Record<string, string> = {}) {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['login', 'register', 'homeUrl']);
    auth.homeUrl.and.callFake((role?: Role) => (role === 'ADMIN' ? '/dashboard' : '/espace'));
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: auth },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } }],
    });
    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);
  }

  describe('connexion', () => {
    it("valide les champs avant d'appeler l'API", () => {
      setup();
      const cmp = TestBed.createComponent(LoginPageComponent).componentInstance;
      cmp.email = 'pas-un-email';
      cmp.submit();
      expect(cmp.emailError()).toBe('Adresse email invalide');
      expect(auth.login).not.toHaveBeenCalled();
    });

    it('affiche le message du serveur en cas d’échec', () => {
      setup();
      auth.login.and.returnValue(httpError(401, { detail: 'Email ou mot de passe incorrect.' }));
      const fixture = TestBed.createComponent(LoginPageComponent);
      Object.assign(fixture.componentInstance, { email: 'a@b.c', password: 'x' });
      fixture.componentInstance.submit();
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('.alert-danger')?.textContent).toContain('Email ou mot de passe incorrect.');
    });

    it('redirige vers l’espace du rôle, ou vers la page demandée si elle est permise', () => {
      setup({ redirect: '/reviews' });
      auth.login.and.returnValue(of(ok('ADMIN')));
      const cmp = TestBed.createComponent(LoginPageComponent).componentInstance;
      Object.assign(cmp, { email: 'a@b.c', password: 'x' });
      cmp.submit();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/reviews');
    });

    it('un client ne suit pas une redirection vers le back-office', () => {
      setup({ redirect: '/dashboard' });
      auth.login.and.returnValue(of(ok('CLIENT')));
      const cmp = TestBed.createComponent(LoginPageComponent).componentInstance;
      Object.assign(cmp, { email: 'a@b.c', password: 'x' });
      cmp.submit();
      expect(router.navigateByUrl).toHaveBeenCalledWith('/espace');
    });

    it('signale une session expirée', () => {
      setup({ reason: 'expired' });
      const fixture = TestBed.createComponent(LoginPageComponent);
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).textContent).toContain('Votre session a expiré');
    });
  });

  describe('inscription', () => {
    it('évalue la solidité du mot de passe', () => {
      expect(passwordStrength('')).toBe(0);
      expect(passwordStrength('abc')).toBe(1);
      expect(passwordStrength('abcdefgh1')).toBe(3);
      expect(passwordStrength('Bonjour2026!')).toBe(4);
    });

    it('bloque un mot de passe sans chiffre', () => {
      setup();
      const cmp = TestBed.createComponent(RegisterPageComponent).componentInstance;
      cmp.fullName = 'Sara Benali';
      cmp.email = 'sara@test.local';
      cmp.password.set('motdepasse');
      cmp.submit();
      expect(cmp.fieldError('password')).toContain('chiffre');
      expect(auth.register).not.toHaveBeenCalled();
    });

    it('email déjà utilisé : erreur sous le champ email', () => {
      setup();
      auth.register.and.returnValue(httpError(409, { detail: 'Un compte existe déjà avec cet email.' }));
      const cmp = TestBed.createComponent(RegisterPageComponent).componentInstance;
      Object.assign(cmp, { fullName: 'Sara Benali', email: 'sara@test.local' });
      cmp.password.set('Secret123');
      cmp.submit();
      expect(cmp.fieldError('email')).toBe('Un compte existe déjà avec cet email.');
      expect(cmp.emailTaken()).toBeTrue();
    });

    it('succès : ouvre l’espace client', () => {
      setup();
      auth.register.and.returnValue(of(ok('CLIENT')));
      const cmp = TestBed.createComponent(RegisterPageComponent).componentInstance;
      Object.assign(cmp, { fullName: 'Sara Benali', email: 'sara@test.local' });
      cmp.password.set('Secret123');
      cmp.submit();
      expect(auth.register).toHaveBeenCalledWith('Sara Benali', 'sara@test.local', 'Secret123');
      expect(router.navigateByUrl).toHaveBeenCalledWith('/espace');
    });
  });
});
