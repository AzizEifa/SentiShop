import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { AdminApi } from '../../core/api/admin-api.service';
import { AuthService } from '../../core/auth/auth.service';
import { Role, UserRow } from '../../core/models/models';
import { formatNumber, formatRelative, initials } from '../../core/format';

@Component({
  selector: 'app-users-page',
  standalone: true,
  template: `
    <header class="page-header">
      <div>
        <h1>Utilisateurs</h1>
        <p class="subtitle">Comptes clients et administrateurs de la boutique.</p>
      </div>
    </header>

    <section class="kpi-grid" aria-label="Indicateurs">
      <article class="card kpi"><div class="kpi-label"><span class="icon">group</span>Comptes</div><div class="kpi-value">{{ fmt(users().length) }}</div></article>
      <article class="card kpi"><div class="kpi-label"><span class="icon">person</span>Clients</div><div class="kpi-value">{{ fmt(count('CLIENT')) }}</div></article>
      <article class="card kpi"><div class="kpi-label"><span class="icon">shield_person</span>Administrateurs</div><div class="kpi-value">{{ fmt(count('ADMIN')) }}</div></article>
      <article class="card kpi"><div class="kpi-label"><span class="icon">rate_review</span>Avis déposés par des clients</div><div class="kpi-value">{{ fmt(totalReviews()) }}</div></article>
    </section>

    <section class="card">
      <div class="toolbar">
        <div class="segmented" role="group" aria-label="Filtrer par rôle">
          @for (f of filters; track f.value) {
            <button type="button" [class.active]="role() === f.value" [attr.aria-pressed]="role() === f.value" (click)="role.set(f.value)">{{ f.label }}</button>
          }
        </div>
        <div class="input-group search">
          <span class="icon">search</span>
          <input class="input" type="search" placeholder="Rechercher un nom ou un email…" aria-label="Rechercher" [value]="query()" (input)="query.set($any($event.target).value)" />
        </div>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Utilisateur</th><th>Rôle</th><th class="num">Avis déposés</th><th>Inscription</th></tr></thead>
          <tbody>
            @if (loading()) {
              @for (i of [1, 2, 3]; track i) { <tr><td colspan="4"><span class="skeleton" style="height: 36px"></span></td></tr> }
            } @else {
              @for (u of filtered(); track u.id) {
                <tr>
                  <td>
                    <div class="who">
                      <span class="avatar" [class.admin]="u.role === 'ADMIN'">{{ initialsOf(u.fullName) }}</span>
                      <div><strong>{{ u.fullName }}@if (u.id === me()) { <span class="you">vous</span> }</strong><small>{{ u.email }}</small></div>
                    </div>
                  </td>
                  <td><span class="role" [class.admin]="u.role === 'ADMIN'"><span class="icon fill">{{ u.role === 'ADMIN' ? 'shield_person' : 'person' }}</span>{{ u.role === 'ADMIN' ? 'Administrateur' : 'Client' }}</span></td>
                  <td class="num tabular">{{ u.role === 'ADMIN' ? '—' : fmt(u.reviewCount) }}</td>
                  <td class="muted nowrap" [title]="u.createdAt">{{ relative(u.createdAt) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="4"><div class="empty-state"><div class="empty-icon"><span class="icon">person_search</span></div><h3>Aucun utilisateur trouvé</h3><p>Modifiez la recherche ou le filtre.</p></div></td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    .kpi-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
    .toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    .search { width: 280px; }
    .num { text-align: right; }
    .who { display: flex; align-items: center; gap: 12px; }
    .who div { display: grid; line-height: 1.3; } .who strong { font-weight: 600; } .who small { color: var(--text-3); font-size: 12.5px; }
    .avatar { display: grid; place-items: center; width: 36px; height: 36px; flex: 0 0 auto; color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; font-size: 12.5px; font-weight: 650; }
    .avatar.admin { background: linear-gradient(135deg, var(--brand), #1aa37a); }
    .you { margin-left: 6px; padding: 1px 7px; color: var(--text-3); background: var(--neu-soft); border-radius: 99px; font-size: 11px; font-weight: 600; }
    .role { display: inline-flex; align-items: center; gap: 5px; height: 24px; padding: 0 10px 0 7px; color: #4f46e5; background: #eef2ff; border-radius: 99px; font-size: 12.5px; font-weight: 600; }
    .role.admin { color: var(--brand-600); background: var(--brand-50); } .role .icon { font-size: 16px; }
    @media (max-width: 900px) { .kpi-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } .search { width: 100%; } }
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
  readonly fmt = formatNumber;
  readonly relative = (iso: string) => formatRelative(iso);
  readonly initialsOf = initials;

  count(role: Role) { return this.users().filter((u) => u.role === role).length; }

  ngOnInit() {
    this.api.users().subscribe({
      next: (list) => { this.users.set(list); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
