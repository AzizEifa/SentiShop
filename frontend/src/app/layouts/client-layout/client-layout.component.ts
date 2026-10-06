import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserMenuComponent } from '../../shared/user-menu/user-menu.component';

/** Espace client : interface épurée, distincte du back-office. Sur mobile, navigation en bas d'écran. */
@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UserMenuComponent],
  template: `
    <a class="skip-link" href="#main">Aller au contenu</a>
    <header class="header">
      <div class="header-inner">
        <a class="brand" routerLink="/espace" aria-label="SentiShop, mon espace">
          <span class="brand-mark">S</span>
          <span>SentiShop</span>
        </a>
        <nav class="nav" aria-label="Navigation de l’espace client">
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }" #rla="routerLinkActive" [attr.aria-current]="rla.isActive ? 'page' : null">
              <span class="icon" [class.fill]="rla.isActive">{{ item.icon }}</span><span class="nav-text">{{ item.label }}</span>
            </a>
          }
        </nav>
        <app-user-menu />
      </div>
    </header>
    <main class="content" id="main" tabindex="-1"><router-outlet /></main>
    <footer class="footer">SentiShop · Vos avis aident la boutique à s’améliorer.</footer>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    .header { position: sticky; top: 0; z-index: 20; background: rgba(255, 255, 255, .94); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
    .header-inner { display: flex; align-items: center; gap: 32px; width: min(100%, 1120px); height: 64px; margin: 0 auto; padding: 0 24px; }
    .brand { display: flex; align-items: center; gap: 10px; color: var(--navy); font-size: 15.5px; font-weight: 700; letter-spacing: -.015em; text-decoration: none; border-radius: var(--r); }
    .nav { display: flex; align-self: stretch; gap: 4px; margin-right: auto; }
    .nav a { position: relative; display: inline-flex; align-items: center; gap: 7px; padding: 0 12px; color: var(--text-3); font-size: 14px; font-weight: 550; text-decoration: none; transition: color .12s; }
    .nav a .icon { font-size: 19px; }
    .nav a:hover { color: var(--text); }
    .nav a.active { color: var(--primary-text); }
    .nav a.active::after { content: ''; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 3px; background: var(--primary); border-radius: 3px 3px 0 0; }
    .content { flex: 1; width: min(100%, 1120px); margin: 0 auto; padding: 32px 24px 64px; outline: none; }
    .footer { padding: 20px; color: var(--text-3); border-top: 1px solid var(--border); font-size: 12.5px; text-align: center; }
    @media (max-width: 760px) {
      .header-inner { gap: 12px; height: 56px; padding: 0 16px; justify-content: space-between; }
      .nav { position: fixed; left: 0; right: 0; bottom: 0; z-index: 25; justify-content: space-around; gap: 0; height: 62px; margin: 0; padding-bottom: env(safe-area-inset-bottom); background: var(--surface); border-top: 1px solid var(--border); box-shadow: 0 -4px 16px -8px rgba(15, 39, 71, .15); }
      .nav a { flex: 1; flex-direction: column; justify-content: center; gap: 2px; padding: 0 4px; font-size: 11px; }
      .nav a .icon { font-size: 22px; }
      .nav a.active::after { top: 0; bottom: auto; left: 25%; right: 25%; border-radius: 0 0 3px 3px; }
      .content { padding: 20px 16px 96px; }
      .footer { padding-bottom: 80px; }
    }
  `],
})
export class ClientLayoutComponent {
  readonly nav = [
    { path: '/espace', label: 'Mon espace', icon: 'home' },
    { path: '/espace/nouveau', label: 'Déposer un avis', icon: 'edit_square' },
    { path: '/espace/avis', label: 'Mes avis', icon: 'rate_review' },
    { path: '/espace/profil', label: 'Mon profil', icon: 'manage_accounts' },
  ];
}
