import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/auth/auth.service';
import { ApiProblem } from '../../core/models/models';
import { AuthShellComponent } from './auth-shell.component';
import { AUTH_FORM_STYLES } from './auth-form.styles';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Mêmes règles que le backend (AuthDtos.RegisterRequest). */
export const PASSWORD_RULES = [
  { label: '8 caractères minimum', test: (p: string) => p.length >= 8 },
  { label: 'Au moins une lettre', test: (p: string) => /[A-Za-z]/.test(p) },
  { label: 'Au moins un chiffre', test: (p: string) => /\d/.test(p) },
];

/** 0 à 4 : règles respectées + bonus longueur / caractère spécial. */
export function passwordStrength(p: string): number {
  if (!p) return 0;
  const base = PASSWORD_RULES.filter((r) => r.test(p)).length;
  return Math.min(4, base + (p.length >= 12 || /[^A-Za-z0-9]/.test(p) ? 1 : 0));
}

const STRENGTH = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'];

@Component({
  selector: 'app-register-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AuthShellComponent],
  template: `
    <app-auth-shell>
      <div class="mobile-brand"><span class="brand-mark">S</span>SentiShop</div>
      <p class="mobile-pitch">Comprenez vos avis clients grâce à l’analyse multilingue.</p>
      <h1>Créer un compte</h1>
      <p class="lead">Partagez votre expérience sur nos produits en quelques secondes.</p>

      @if (error()) { <div class="alert alert-danger fade-in" role="alert"><span class="icon">error</span><div>{{ error() }}</div></div> }

      <form (submit)="$event.preventDefault(); submit()" novalidate>
        <div class="field">
          <label class="label" for="fullName">Nom complet</label>
          <input id="fullName" class="input" name="fullName" (blur)="touch('fullName')" autocomplete="name" [(ngModel)]="fullName" (ngModelChange)="clearServer('fullName')" [class.invalid]="!!fieldError('fullName')" placeholder="Ex. Sara Benali" autofocus />
          @if (fieldError('fullName'); as msg) { <span class="field-error"><span class="icon">error</span>{{ msg }}</span> }
        </div>
        <div class="field">
          <label class="label" for="email">Adresse email</label>
          <input id="email" class="input" type="email" name="email" (blur)="touch('email')" autocomplete="email" [(ngModel)]="email" (ngModelChange)="clearServer('email')" [class.invalid]="!!fieldError('email')" placeholder="vous@exemple.com" />
          @if (fieldError('email'); as msg) {
            <span class="field-error"><span class="icon">error</span>{{ msg }}@if (emailTaken()) {&nbsp;<a routerLink="/login">Se connecter</a>}</span>
          }
        </div>
        <div class="field">
          <label class="label" for="password">Mot de passe</label>
          <div class="password">
            <input id="password" class="input" [type]="showPassword() ? 'text' : 'password'" name="password" autocomplete="new-password" [ngModel]="password()" (ngModelChange)="password.set($event); clearServer('password')" [class.invalid]="!!fieldError('password')" placeholder="Choisissez un mot de passe" />
            <button class="toggle" type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Masquer le mot de passe' : 'Afficher le mot de passe'"><span class="icon">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span></button>
          </div>
          @if (password()) {
            <div class="strength" [attr.data-level]="strength()">
              <div class="bars">@for (i of [1, 2, 3, 4]; track i) { <span [class.on]="i <= strength()"></span> }</div>
              <span>{{ strengthLabel() }}</span>
            </div>
          }
          <ul class="rules">
            @for (r of rules; track r.label) {
              <li [class.ok]="r.test(password())"><span class="icon">{{ r.test(password()) ? 'check_circle' : 'radio_button_unchecked' }}</span>{{ r.label }}</li>
            }
          </ul>
          @if (fieldError('password'); as msg) { <span class="field-error"><span class="icon">error</span>{{ msg }}</span> }
        </div>
        <div class="field">
          <label class="label" for="confirm">Confirmer le mot de passe</label>
          <input id="confirm" class="input" [type]="showPassword() ? 'text' : 'password'" name="confirm" (blur)="touch('confirm')" autocomplete="new-password" [ngModel]="confirm()" (ngModelChange)="confirm.set($event)" [class.invalid]="!!fieldError('confirm')" placeholder="Saisissez-le à nouveau" />
          @if (fieldError('confirm'); as msg) { <span class="field-error"><span class="icon">error</span>{{ msg }}</span> }
          @else if (confirm() && confirm() === password()) { <span class="field-ok"><span class="icon">check_circle</span>Les mots de passe correspondent</span> }
        </div>
        <button class="btn btn-primary btn-lg btn-block submit" type="submit" [disabled]="loading()">
          @if (loading()) { <span class="spinner"></span>Création du compte… } @else { Créer mon compte client }
        </button>
        <p class="legal">En créant un compte, vous acceptez que vos avis soient analysés pour aider la boutique à s’améliorer.</p>
      </form>

      <p class="switch">Déjà inscrit ? <a routerLink="/login">Se connecter</a></p>
    </app-auth-shell>
  `,
  styles: [AUTH_FORM_STYLES, `
    .alert { margin-bottom: 18px; }
    .strength { display: flex; align-items: center; gap: 10px; color: var(--text-3); font-size: 12.5px; font-weight: 550; }
    .bars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; flex: 1; }
    .bars span { height: 4px; background: var(--surface-3); border-radius: 2px; transition: background .2s; }
    [data-level='1'] .bars .on { background: var(--neg); } [data-level='2'] .bars .on { background: var(--star); }
    [data-level='3'] .bars .on { background: var(--primary); } [data-level='4'] .bars .on { background: var(--pos); }
    .rules { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; padding: 0; list-style: none; }
    .rules li { display: inline-flex; align-items: center; gap: 4px; color: var(--text-3); font-size: 12.5px; transition: color .15s; }
    .rules li .icon { font-size: 15px; } .rules li.ok { color: var(--pos-text); }
    .legal { color: var(--text-4); font-size: 12px; text-align: center; }
  `],
})
export class RegisterPageComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snack = inject(MatSnackBar);

  readonly rules = PASSWORD_RULES;
  fullName = '';
  email = '';
  readonly password = signal('');
  readonly confirm = signal('');
  readonly showPassword = signal(false);
  readonly submitted = signal(false);
  /** Champs quittés au moins une fois (validation en temps réel ensuite). */
  readonly touchedFields = signal(new Set<string>());
  readonly loading = signal(false);
  readonly error = signal('');
  readonly serverErrors = signal<Record<string, string>>({});
  readonly emailTaken = signal(false);
  readonly strength = computed(() => passwordStrength(this.password()));
  readonly strengthLabel = computed(() => STRENGTH[this.strength()]);

  /** Erreur affichée sous un champ : celle du serveur en priorité, sinon la validation locale après envoi. */
  fieldError(field: 'fullName' | 'email' | 'password' | 'confirm'): string {
    const server = this.serverErrors()[field];
    if (server) return server;
    if (!this.submitted() && !this.touchedFields().has(field)) return '';
    return this.localErrors()[field] ?? '';
  }

  touch(field: string) { this.touchedFields.update((s) => new Set(s).add(field)); }

  clearServer(field: string) {
    if (this.serverErrors()[field]) this.serverErrors.update(({ [field]: _, ...rest }) => rest);
    if (field === 'email') this.emailTaken.set(false);
  }

  private localErrors(): Record<string, string> {
    const e: Record<string, string> = {};
    if (this.fullName.trim().length < 2) e['fullName'] = 'Indiquez votre nom (2 caractères minimum)';
    if (!EMAIL.test(this.email.trim())) e['email'] = this.email.trim() ? 'Adresse email invalide' : 'Saisissez votre adresse email';
    const broken = PASSWORD_RULES.find((r) => !r.test(this.password()));
    if (broken) e['password'] = `Mot de passe : ${broken.label.toLowerCase()}`;
    if (this.confirm() !== this.password()) e['confirm'] = this.confirm() ? 'Les deux mots de passe ne correspondent pas' : 'Confirmez votre mot de passe';
    return e;
  }

  submit() {
    this.submitted.set(true);
    this.error.set('');
    if (Object.keys(this.localErrors()).length || this.loading()) return;
    this.loading.set(true);
    this.auth.register(this.fullName.trim(), this.email.trim(), this.password()).subscribe({
      next: (res) => {
        this.loading.set(false);
        this.router.navigateByUrl(this.auth.homeUrl(res.user.role));
        this.snack.open(`Compte créé. Bienvenue ${res.user.fullName.split(' ')[0]} !`, 'OK', { duration: 4000 });
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        const problem = (e.error ?? {}) as ApiProblem;
        if (e.status === 409) {
          this.emailTaken.set(true);
          this.serverErrors.set({ email: problem.detail ?? 'Un compte existe déjà avec cet email.' });
        } else if (e.status === 400 && problem.errors) {
          this.serverErrors.set(problem.errors);
        } else {
          this.error.set(e.status === 0 || e.status === 504
            ? 'Le serveur ne répond pas. Vérifiez que le backend est démarré.'
            : problem.detail ?? 'Inscription impossible. Réessayez.');
        }
      },
    });
  }
}
