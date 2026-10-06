import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AdminApi } from '../../core/api/admin-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { Role, UserRow } from '../../core/models/models';
import { formatNumber, formatRelative } from '../../core/format';
import { AvatarComponent } from '../../shared/avatar/avatar.component';
import { ConfirmService } from '../../shared/confirm-dialog/confirm-dialog.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ErrorStateComponent } from '../../shared/states/states.component';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-users-page',
  standalone: true,
  imports: [AvatarComponent, ErrorStateComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Utilisateurs</h1>
        <p class="subtitle">Comptes clients et administrateurs. Les droits sont vérifiés par le serveur à chaque action.</p>
      </div>
    </header>

    <section class="kpi-grid" aria-label="Indicateurs">
      <article class="card kpi"><div class="kpi-label"><span class="icon">group</span>Comptes</div><div class="kpi-value">{{ fmt(users().length) }}</div></article>
      <article class="card kpi"><div class="kpi-label"><span class="icon">person</span>Clients</div><div class="kpi-value">{{ fmt(count('CLIENT')) }}</div></article>
      <article class="card kpi"><div class="kpi-label"><span class="icon">shield_person</span>Administrateurs</div><div class="kpi-value">{{ fmt(count('ADMIN')) }}</div></article>
      <article class="card kpi"><div class="kpi-label"><span class="icon">rate_review</span>Avis déposés par des clients</div><div class="kpi-value">{{ fmt(totalReviews()) }}</div></article>
    </section>

    <section class="card">
      @if (error()) { <app-error-state title="Utilisateurs indisponibles" message="La liste des comptes n’a pas pu être chargée." (retry)="ngOnInit()" /> } @else {
      <div class="filter-bar">
        <div class="segmented" role="group" aria-label="Filtrer par rôle">
          @for (f of filters; track f.value) {
            <button type="button" [class.active]="role() === f.value" [attr.aria-pressed]="role() === f.value" (click)="role.set(f.value); page.set(0)">{{ f.label }}</button>
          }
        </div>
        <div class="input-group search">
          <span class="icon">search</span>
          <input class="input" type="search" placeholder="Rechercher un nom ou un email…" aria-label="Rechercher" [value]="query()" (input)="query.set($any($event.target).value); page.set(0)" />
        </div>
      </div>
      <div class="table-wrap">
        <table class="table stack">
          <thead><tr><th>Utilisateur</th><th>Rôle</th><th class="num">Avis déposés</th><th>Inscription</th><th class="actions-col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            @if (loading()) {
              @for (i of [1, 2, 3]; track i) { <tr><td colspan="5"><span class="skeleton" style="height: 36px"></span></td></tr> }
            } @else {
              @for (u of paged(); track u.id) {
                <tr>
                  <td>
                    <div class="who">
                      <app-avatar [name]="u.fullName" [url]="u.avatarUrl" [admin]="u.role === 'ADMIN'" [size]="36" />
                      <div><strong>{{ u.fullName }}@if (u.id === me()) { <span class="you">vous</span> }</strong><small>{{ u.email }}</small></div>
                    </div>
                  </td>
                  <td data-label="Rôle"><span class="role" [class.admin]="u.role === 'ADMIN'"><span class="icon fill">{{ u.role === 'ADMIN' ? 'shield_person' : 'person' }}</span>{{ u.role === 'ADMIN' ? 'Administrateur' : 'Client' }}</span></td>
                  <td class="num tabular" data-label="Avis">{{ u.role === 'ADMIN' ? '—' : fmt(u.reviewCount) }}</td>
                  <td class="muted nowrap" data-label="Inscription" [title]="u.createdAt">{{ relative(u.createdAt) }}</td>
                  <td class="actions-col">
                    @if (u.id !== me()) {
                      <div class="row-actions">
                        <button class="btn btn-ghost btn-sm" type="button" (click)="toggleRole(u)" [disabled]="busy() === u.id"
                                [title]="u.role === 'ADMIN' ? 'Retirer les droits administrateur' : 'Donner les droits administrateur'">
                          <span class="icon">{{ u.role === 'ADMIN' ? 'remove_moderator' : 'add_moderator' }}</span>{{ u.role === 'ADMIN' ? 'Passer client' : 'Passer admin' }}
                        </button>
                        <button class="btn btn-ghost btn-icon danger" type="button" title="Supprimer le compte" [attr.aria-label]="'Supprimer le compte de ' + u.fullName" (click)="remove(u)" [disabled]="busy() === u.id"><span class="icon">delete</span></button>
                      </div>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5"><div class="empty-state"><div class="empty-icon"><span class="icon">person_search</span></div><h3>Aucun utilisateur trouvé</h3><p>Modifiez la recherche ou le filtre.</p></div></td></tr>
              }
            }
          </tbody>
        </table>
      </div>
      @if (filtered().length > pageSize) {
        <footer class="pager">
          <span class="muted tabular">{{ page() * pageSize + 1 }}–{{ min((page() + 1) * pageSize, filtered().length) }} sur {{ filtered().length }}</span>
          <div class="pager-controls">
            <button class="btn btn-secondary btn-icon btn-sm" type="button" aria-label="Page précédente" [disabled]="page() === 0" (click)="page.set(page() - 1)"><span class="icon">chevron_left</span></button>
            <span class="tabular page-indicator">Page {{ page() + 1 }} / {{ pages() }}</span>
            <button class="btn btn-secondary btn-icon btn-sm" type="button" aria-label="Page suivante" [disabled]="page() + 1 >= pages()" (click)="page.set(page() + 1)"><span class="icon">chevron_right</span></button>
          </div>
        </footer>
      }
      }
    </section>
  `,
  styles: [`
    :host { display: block; min-width: 0; }

    .num { text-align: right; }
    .who { display: flex; align-items: center; gap: 12px; }
    .who div { display: grid; line-height: 1.3; } .who strong { font-weight: 600; } .who small { color: var(--text-3); font-size: 12.5px; }
    .actions-col { width: 1%; white-space: nowrap; }
    .row-actions { display: flex; justify-content: flex-end; gap: 4px; }
    .btn.danger { color: var(--neg-text); } .btn.danger:hover:not(:disabled) { background: var(--neg-soft); }
    .you { margin-left: 6px; padding: 1px 7px; color: var(--text-3); background: var(--neu-soft); border-radius: 99px; font-size: 11px; font-weight: 600; }
    .role { display: inline-flex; align-items: center; gap: 5px; height: 22px; padding: 0 7px; color: var(--text-2); background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 12px; font-weight: 500; }
    .role.admin { color: #fff; background: var(--navy); border-color: var(--navy); } .role .icon { font-size: 14px; }
    @media (max-width: 720px) { .row-actions { justify-content: flex-start; margin-top: 6px; } .actions-col { width: auto; } .segmented { width: 100%; overflow-x: auto; } }
  `],
})
export class UsersPageComponent implements OnInit {
  private readonly api = inject(AdminApi);
  private readonly auth = inject(AuthService);

  readonly filters: { value: Role | ''; label: string }[] = [
    { value: '', label: 'Tous' }, { value: 'CLIENT', label: 'Clients' }, { value: 'ADMIN', label: 'Administrateurs' },
  ];
  readonly users = signal<UserRow[]>([]);
  readonly loading = signal(true);
  readonly role = signal<Role | ''>('');
  readonly query = signal('');
  readonly me = computed(() => this.auth.user()?.id);
  readonly totalReviews = computed(() => this.users().reduce((s, u) => s + u.reviewCount, 0));
  readonly filtered = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.users().filter((u) => (!this.role() || u.role === this.role())
      && (!q || u.fullName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)));
  });
  readonly pageSize = PAGE_SIZE;
  readonly page = signal(0);
  readonly error = signal(false);
  readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly paged = computed(() => this.filtered().slice(this.page() * PAGE_SIZE, (this.page() + 1) * PAGE_SIZE));
  readonly min = Math.min;
  readonly fmt = formatNumber;
  readonly relative = (iso: string) => formatRelative(iso);
  readonly busy = signal<number | null>(null);
  private readonly confirm = inject(ConfirmService);
  private readonly snack = inject(MatSnackBar);

  async toggleRole(u: UserRow) {
    const toAdmin = u.role !== 'ADMIN';
    const ok = await this.confirm.ask({
      title: toAdmin ? `Donner les droits administrateur à ${u.fullName} ?` : `Retirer les droits administrateur de ${u.fullName} ?`,
      message: toAdmin
        ? 'Ce compte aura accès à tout le back-office : avis, produits, imports et gestion des utilisateurs.'
        : 'Ce compte deviendra un compte client : il pourra seulement déposer et gérer ses propres avis.',
      confirmLabel: toAdmin ? 'Passer administrateur' : 'Passer client',
      tone: 'primary',
      icon: toAdmin ? 'add_moderator' : 'remove_moderator',
    });
    if (!ok) return;
    this.busy.set(u.id);
    this.api.changeRole(u.id, toAdmin ? 'ADMIN' : 'CLIENT').subscribe({
      next: (row) => { this.busy.set(null); this.users.update((l) => l.map((x) => (x.id === row.id ? row : x))); this.snack.open('Rôle mis à jour', 'OK', { duration: 3000 }); },
      error: () => this.busy.set(null),
    });
  }

  async remove(u: UserRow) {
    const ok = await this.confirm.ask({
      title: `Supprimer le compte de ${u.fullName} ?`,
      message: u.reviewCount
        ? `Le compte sera supprimé. Ses ${u.reviewCount} avis restent dans les statistiques, signés « Ancien client ».`
        : 'Le compte sera définitivement supprimé.',
      confirmLabel: 'Supprimer le compte',
    });
    if (!ok) return;
    this.busy.set(u.id);
    this.api.deleteUser(u.id).subscribe({
      next: () => { this.busy.set(null); this.users.update((l) => l.filter((x) => x.id !== u.id)); this.snack.open('Compte supprimé', 'OK', { duration: 3000 }); },
      error: () => this.busy.set(null),
    });
  }

  count(role: Role) { return this.users().filter((u) => u.role === role).length; }

  ngOnInit() {
    this.loading.set(true);
    this.error.set(false);
    this.api.users().subscribe({
      next: (list) => { this.users.set(list); this.loading.set(false); },
      error: () => { this.loading.set(false); this.error.set(true); },
    });
  }
}
