import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AccountApi } from '../../core/api/account-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { ApiProblem } from '../../core/models/models';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog.component';
import { PASSWORD_RULES, passwordStrength } from '../auth/register-page.component';
import { imageProblem } from '../products/products-page.component';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRENGTH = ['', 'Faible', 'Moyen', 'Bon', 'Excellent'];

/** Mon profil : photo, nom, email et mot de passe (clients comme administrateurs). */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [FormsModule, AvatarComponent],
  template: `
    <header class="page-header">
      <div><h1>Mon profil</h1><p class="subtitle">Gérez vos informations personnelles et la sécurité de votre compte.</p></div>
    </header>

    @if (auth.user(); as u) {
      <div class="layout">
        <aside class="card identity">
          <div class="avatar-wrap">
            <app-avatar [name]="u.fullName" [url]="u.avatarUrl" [admin]="u.role === 'ADMIN'" [size]="104" />
            <label class="avatar-edit" for="avatar-input" title="Changer la photo"><span class="icon">{{ uploading() ? 'hourglass_top' : 'photo_camera' }}</span></label>
            <input id="avatar-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" (change)="onAvatar($event)" />
          </div>
          <h2>{{ u.fullName }}</h2>
          <p class="muted">{{ u.email }}</p>
          <span class="role" [class.admin]="u.role === 'ADMIN'"><span class="icon fill">{{ u.role === 'ADMIN' ? 'shield_person' : 'person' }}</span>{{ u.role === 'ADMIN' ? 'Administrateur' : 'Client' }}</span>
          @if (avatarError()) { <p class="field-error"><span class="icon">error</span>{{ avatarError() }}</p> }
          <div class="avatar-actions">
            <label class="btn btn-secondary btn-sm" for="avatar-input"><span class="icon">upload</span>{{ u.avatarUrl ? 'Changer la photo' : 'Ajouter une photo' }}</label>
            @if (u.avatarUrl) { <button class="btn btn-ghost btn-sm" type="button" (click)="removeAvatar()">Retirer</button> }
          </div>
          <div class="since"><span class="icon">calendar_month</span>Membre depuis {{ since(u.createdAt) }}</div>
        </aside>

        <div class="forms">
          <section class="card">
            <div class="card-header"><div><h2>Informations personnelles</h2><p class="card-subtitle">Votre nom apparaît sur vos avis publiés.</p></div></div>
            <form class="card-body form" (submit)="$event.preventDefault(); saveProfile()" novalidate>
              <div class="row">
                <div class="field">
                  <label class="label" for="fullName">Nom complet</label>
                  <input id="fullName" class="input" name="fullName" autocomplete="name" [(ngModel)]="fullName" [class.invalid]="!!profileErrors()['fullName']" />
                  @if (profileErrors()['fullName']; as m) { <span class="field-error"><span class="icon">error</span>{{ m }}</span> }
                </div>
                <div class="field">
                  <label class="label" for="email">Adresse email</label>
                  <input id="email" class="input" type="email" name="email" autocomplete="email" [(ngModel)]="email" [class.invalid]="!!profileErrors()['email']" />
                  @if (profileErrors()['email']; as m) { <span class="field-error"><span class="icon">error</span>{{ m }}</span> }
                </div>
              </div>
              <div class="actions">
                <button class="btn btn-primary" type="submit" [disabled]="savingProfile() || !profileChanged()"><span class="icon">check</span>{{ savingProfile() ? 'Enregistrement…' : 'Enregistrer' }}</button>
                @if (profileChanged()) { <button class="btn btn-ghost" type="button" (click)="resetProfile()">Annuler les modifications</button> }
              </div>
            </form>
          </section>

          <section class="card">
            <div class="card-header"><div><h2>Mot de passe</h2><p class="card-subtitle">Choisissez un mot de passe que vous n’utilisez nulle part ailleurs.</p></div></div>
            <form class="card-body form" (submit)="$event.preventDefault(); savePassword()" novalidate>
              <div class="field">
                <label class="label" for="current">Mot de passe actuel</label>
                <input id="current" class="input" type="password" name="current" autocomplete="current-password" [(ngModel)]="currentPassword" [class.invalid]="!!passwordErrors()['currentPassword']" />
                @if (passwordErrors()['currentPassword']; as m) { <span class="field-error"><span class="icon">error</span>{{ m }}</span> }
              </div>
              <div class="field">
                <label class="label" for="new">Nouveau mot de passe</label>
                <div class="password">
                  <input id="new" class="input" [type]="showPassword() ? 'text' : 'password'" name="new" autocomplete="new-password" [ngModel]="newPassword()" (ngModelChange)="newPassword.set($event)" [class.invalid]="!!passwordErrors()['newPassword']" />
                  <button class="toggle" type="button" (click)="showPassword.set(!showPassword())" [attr.aria-label]="showPassword() ? 'Masquer' : 'Afficher'"><span class="icon">{{ showPassword() ? 'visibility_off' : 'visibility' }}</span></button>
                </div>
                @if (newPassword()) {
                  <div class="strength" [attr.data-level]="strength()"><div class="bars">@for (i of [1, 2, 3, 4]; track i) { <span [class.on]="i <= strength()"></span> }</div><span>{{ strengthLabel() }}</span></div>
                }
                <ul class="rules">@for (r of rules; track r.label) { <li [class.ok]="r.test(newPassword())"><span class="icon">{{ r.test(newPassword()) ? 'check_circle' : 'radio_button_unchecked' }}</span>{{ r.label }}</li> }</ul>
                @if (passwordErrors()['newPassword']; as m) { <span class="field-error"><span class="icon">error</span>{{ m }}</span> }
              </div>
              <div class="actions">
                <button class="btn btn-primary" type="submit" [disabled]="savingPassword()"><span class="icon">lock_reset</span>{{ savingPassword() ? 'Modification…' : 'Changer le mot de passe' }}</button>
              </div>
            </form>
          </section>
        </div>
      </div>
    }
  `,
  styles: [`
    .layout { display: grid; grid-template-columns: 300px minmax(0, 1fr); align-items: start; gap: 20px; }
    .identity { display: grid; justify-items: center; gap: 6px; padding: 28px 22px; text-align: center; }
    .avatar-wrap { position: relative; margin-bottom: 8px; }
    .avatar-wrap app-avatar { box-shadow: 0 0 0 4px var(--surface), 0 0 0 5px var(--border); border-radius: 50%; }
    .avatar-edit { position: absolute; right: 0; bottom: 2px; display: grid; place-items: center; width: 34px; height: 34px; color: #fff; background: var(--brand); border: 3px solid var(--surface); border-radius: 50%; cursor: pointer; }
    .avatar-edit .icon { font-size: 17px; }
    #avatar-input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .identity h2 { font-size: 18px; } .identity .muted { font-size: 13.5px; overflow-wrap: anywhere; }
    .role { display: inline-flex; align-items: center; gap: 5px; margin-top: 4px; padding: 3px 10px 3px 7px; color: #4f46e5; background: #eef2ff; border-radius: 99px; font-size: 12.5px; font-weight: 600; }
    .role.admin { color: var(--brand-600); background: var(--brand-50); } .role .icon { font-size: 16px; }
    .avatar-actions { display: flex; gap: 6px; margin-top: 12px; }
    .since { display: flex; align-items: center; gap: 6px; width: 100%; margin-top: 16px; padding-top: 14px; color: var(--text-3); border-top: 1px solid var(--border); font-size: 13px; justify-content: center; }
    .since .icon { font-size: 17px; }
    .forms { display: grid; gap: 20px; min-width: 0; }
    .form { display: grid; gap: 18px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .password { position: relative; } .password .input { padding-right: 44px; }
    .toggle { position: absolute; top: 50%; right: 4px; display: grid; place-items: center; width: 34px; height: 34px; color: var(--text-3); background: none; border: 0; border-radius: 7px; transform: translateY(-50%); }
    .field-error { display: flex; align-items: center; gap: 4px; color: var(--neg-text); font-size: 12.5px; } .field-error .icon { font-size: 15px; }
    .input.invalid { border-color: var(--neg); }
    .strength { display: flex; align-items: center; gap: 10px; color: var(--text-3); font-size: 12.5px; font-weight: 550; }
    .bars { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; flex: 1; } .bars span { height: 4px; background: var(--neu-soft); border-radius: 4px; }
    [data-level='1'] .bars .on { background: var(--neg); } [data-level='2'] .bars .on { background: #f5a524; } [data-level='3'] .bars .on { background: #84cc16; } [data-level='4'] .bars .on { background: var(--pos); }
    .rules { display: flex; flex-wrap: wrap; gap: 4px 14px; margin: 0; padding: 0; list-style: none; }
    .rules li { display: inline-flex; align-items: center; gap: 4px; color: var(--text-3); font-size: 12.5px; } .rules li .icon { font-size: 15px; } .rules li.ok { color: var(--pos-text); }
    @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } .row { grid-template-columns: 1fr; } }
  `],
})
export class ProfilePageComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(AccountApi);
  private readonly snack = inject(MatSnackBar);
  private readonly confirm = inject(ConfirmService);

  fullName = this.auth.user()?.fullName ?? '';
  email = this.auth.user()?.email ?? '';
  currentPassword = '';
  readonly newPassword = signal('');
  readonly showPassword = signal(false);
  readonly profileErrors = signal<Record<string, string>>({});
  readonly passwordErrors = signal<Record<string, string>>({});
  readonly avatarError = signal('');
  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);
  readonly uploading = signal(false);
  readonly rules = PASSWORD_RULES;
  readonly strength = computed(() => passwordStrength(this.newPassword()));
  readonly strengthLabel = computed(() => STRENGTH[this.strength()]);
  /** « octobre 2026 » */
  readonly since = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  profileChanged() {
    const u = this.auth.user();
    return !!u && (this.fullName.trim() !== u.fullName || this.email.trim().toLowerCase() !== u.email);
  }

  resetProfile() {
    this.fullName = this.auth.user()?.fullName ?? '';
    this.email = this.auth.user()?.email ?? '';
    this.profileErrors.set({});
  }

  saveProfile() {
    const errors: Record<string, string> = {};
    if (this.fullName.trim().length < 2) errors['fullName'] = 'Indiquez votre nom (2 caractères minimum)';
    if (!EMAIL.test(this.email.trim())) errors['email'] = 'Adresse email invalide';
    this.profileErrors.set(errors);
    if (Object.keys(errors).length || this.savingProfile()) return;
    this.savingProfile.set(true);
    this.api.updateProfile(this.fullName.trim(), this.email.trim()).subscribe({
      next: (res) => {
        this.savingProfile.set(false);
        this.auth.replaceSession(res); // nouveau jeton : le nom et l'email y figurent
        this.resetProfile();
        this.snack.open('Profil mis à jour', 'OK', { duration: 3500 });
      },
      error: (e: HttpErrorResponse) => {
        this.savingProfile.set(false);
        const p = (e.error ?? {}) as ApiProblem;
        this.profileErrors.set(e.status === 409 ? { email: p.detail ?? 'Email déjà utilisé.' } : p.errors ?? { fullName: p.detail ?? 'Enregistrement impossible.' });
      },
    });
  }

  savePassword() {
    const errors: Record<string, string> = {};
    if (!this.currentPassword) errors['currentPassword'] = 'Saisissez votre mot de passe actuel';
    const broken = PASSWORD_RULES.find((r) => !r.test(this.newPassword()));
    if (broken) errors['newPassword'] = `Nouveau mot de passe : ${broken.label.toLowerCase()}`;
    this.passwordErrors.set(errors);
    if (Object.keys(errors).length || this.savingPassword()) return;
    this.savingPassword.set(true);
    this.api.changePassword(this.currentPassword, this.newPassword()).subscribe({
      next: () => {
        this.savingPassword.set(false);
        this.currentPassword = '';
        this.newPassword.set('');
        this.snack.open('Mot de passe modifié', 'OK', { duration: 3500 });
      },
      error: (e: HttpErrorResponse) => {
        this.savingPassword.set(false);
        const p = (e.error ?? {}) as ApiProblem;
        const detail = p.detail ?? 'Modification impossible.';
        this.passwordErrors.set(p.errors ?? (detail.includes('actuel incorrect') ? { currentPassword: detail } : { newPassword: detail }));
      },
    });
  }

  onAvatar(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const problem = imageProblem(file);
    this.avatarError.set(problem);
    if (problem) return;
    this.uploading.set(true);
    this.api.uploadAvatar(file).subscribe({
      next: (user) => { this.uploading.set(false); this.auth.updateUser(user); this.snack.open('Photo de profil mise à jour', 'OK', { duration: 3000 }); },
      error: (e: HttpErrorResponse) => { this.uploading.set(false); this.avatarError.set(e.error?.detail ?? 'Envoi impossible.'); },
    });
  }

  async removeAvatar() {
    const ok = await this.confirm.ask({ title: 'Retirer la photo ?', message: 'Vos initiales s’afficheront à la place.', confirmLabel: 'Retirer', icon: 'no_photography' });
    if (ok) this.api.removeAvatar().subscribe((user) => this.auth.updateUser(user));
  }
}
