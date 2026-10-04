import { Component, inject, isDevMode, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/auth/auth.service';
import { AuthShellComponent } from './auth-shell.component';
import { AUTH_FORM_STYLES } from './auth-form.styles';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Comptes créés au démarrage du backend (cf. application.properties), affichés en développement seulement. */
export const DEMO_ACCOUNTS = [
  { label: 'Administrateur', icon: 'shield_person', email: 'admin@sentishop.local', password: 'Admin123!' },
  { label: 'Client', icon: 'person', email: 'client@sentishop.local', password: 'Client123!' },
];

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AuthShellComponent],
  template: `
    <app-auth-shell>
      <div class="mobile-brand"><span class="mark"><span class="icon fill">insights</span></span>SentiShop</div>
      <h1>Bon retour parmi nous</h1>
      <p class="lead">Connectez-vous pour accéder à votre espace.</p>

      @if (expired) { <div class="alert alert-info fade-in"><span class="icon">schedule</span><div>Votre session a expiré. Reconnectez-vous pour continuer.</div></div> }
      @if (error()) { <div class="alert alert-danger fade-in" role="alert"><span class="icon">error</span><div>{{ error() }}</div></div> }

      <form (submit)="$event.preventDefault(); submit()" novalidate>
        <div class="field">
          <label class="label" for="email">Adresse email</label>
          <input id="email" class="input" type="email" name="email" autocomplete="email" [(ngModel)]="email" [class.invalid]="touched() && emailError()" placeholder="vous@exemple.com" autofocus />
          @if (touched() && emailError()) { <span class="field-error"><span class="icon">error</span>{{ emailError() }}</span> }
        </div>
        <div class="field">
          <label class="label" for="password">Mot de passe</label>
          <div class="password">
            <input id="password" class="input" [type]="showPassword() ? 'text' : 'password'" name="password" autocomplete="current-password" [(ngModel)]="password" [class.invalid]="touched() && !password" placeholder="Votre mot de passe" />
            <button class="toggle" type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"><span class="icon">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span></button>
          </div>
          @if (touched() && !password) { <span class="field-error"><span class="icon">error</span>Saisissez votre mot de passe</span> }
        </div>
        <div class="row"><label class="check"><input type="checkbox" name="remember" [(ngModel)]="remember" />Se souvenir de moi</label></div>
        <button class="btn btn-primary btn-lg btn-block submit" type="submit" [disabled]="loading()">
          @if (loading()) { <span class="spinner"></span>Connexion… } @else { Se connecter }
        </button>
      </form>

      <p class="switch">Pas encore de compte ? <a routerLink="/register" [queryParams]="redirectParams">Créer un compte client</a></p>

      @if (demo) {
        <div class="demo">
          <span class="demo-title"><span class="icon">science</span>Comptes de démonstration</span>
          <div class="demo-buttons">
            @for (a of demoAccounts; track a.email) {
              <button class="chip" type="button" (click)="fill(a.email, a.password)"><span class="icon">{{ a.icon }}</span>{{ a.label }}</button>
            }
          </div>
        </div>
      }
    </app-auth-shell>
  `,
  styles: [AUTH_FORM_STYLES, `
    .demo { display: grid; gap: 10px; margin-top: 32px; padding: 14px 16px; background: var(--surface-2); border: 1px dashed var(--border-strong); border-radius: var(--r); }
    .demo-title { display: flex; align-items: center; gap: 6px; color: var(--text-3); font-size: 12.5px; font-weight: 600; letter-spacing: .02em; text-transform: uppercase; }
    .demo-title .icon { font-size: 16px; }
    .demo-buttons { display: flex; gap: 8px; flex-wrap: wrap; }
    .alert { margin-bottom: 18px; }
  `],
})
export class LoginPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly demo = isDevMode();
  readonly demoAccounts = DEMO_ACCOUNTS;
  readonly expired = this.route.snapshot.queryParamMap.get('reason') === 'expired';
  private readonly redirect = this.route.snapshot.queryParamMap.get('redirect');
  readonly redirectParams = this.redirect ? { redirect: this.redirect } : {};

  email = '';
  password = '';
  remember = true;
  readonly showPassword = signal(false);
  readonly touched = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  emailError(): string {
    if (!this.email.trim()) return 'Saisissez votre adresse email';
    return EMAIL.test(this.email.trim()) ? '' : 'Adresse email invalide';
  }

  fill(email: string, password: string) {
    this.email = email;
    this.password = password;
    this.error.set('');
  }

  submit() {
    this.touched.set(true);
    this.error.set('');
    if (this.emailError() || !this.password || this.loading()) return;
    this.loading.set(true);
    this.auth.login(this.email.trim(), this.password, this.remember).subscribe({
      next: (res) => {
        this.loading.set(false);
        // retour à la page demandée seulement si elle correspond au rôle (sinon, l'accueil du rôle)
        const target = this.redirect && (res.user.role === 'ADMIN') === !this.redirect.startsWith('/espace')
          ? this.redirect : this.auth.homeUrl(res.user.role);
        this.router.navigateByUrl(target);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(e.status === 0 || e.status === 504
          ? 'Le serveur ne répond pas. Vérifiez que le backend est démarré.'
          : e.error?.detail ?? 'Connexion impossible. Réessayez.');
      },
    });
  }
}
