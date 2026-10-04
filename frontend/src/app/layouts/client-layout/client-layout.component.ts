import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { UserMenuComponent } from '../../shared/user-menu/user-menu.component';

/** Espace client : interface épurée, distincte du back-office. */
@Component({
  selector: 'app-client-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, UserMenuComponent],
  template: `
    <header class="header">
      <div class="header-inner">
        <a class="brand" routerLink="/espace" aria-label="SentiShop, mon espace">
          <span class="brand-mark"><span class="icon fill">insights</span></span>
          <span>SentiShop</span>
        </a>
        <nav class="nav" aria-label="Navigation">
          <a routerLink="/espace" routerLinkActive="active"><span class="icon">rate_review</span>Mes avis</a>
        </nav>
        <app-user-menu />
      </div>
    </header>
    <main class="content"><router-outlet /></main>
    <footer class="footer">SentiShop · Vos avis aident la boutique à s’améliorer.</footer>
  `,
  styles: [`
    :host { display: flex; flex-direction: column; min-height: 100vh; }
    .header { position: sticky; top: 0; z-index: 20; background: rgba(255, 255, 255, .9); backdrop-filter: blur(10px); border-bottom: 1px solid var(--border); }
    .header-inner { display: flex; align-items: center; gap: 24px; width: min(100%, 1120px); height: 64px; margin: 0 auto; padding: 0 24px; }
    .brand { display: flex; align-items: center; gap: 10px; color: var(--text); font-size: 17px; font-weight: 700; letter-spacing: -.02em; text-decoration: none; }
    .brand-mark { display: grid; place-items: center; width: 34px; height: 34px; color: #fff; background: linear-gradient(135deg, var(--brand), #1aa37a); border-radius: 10px; }
    .brand-mark .icon { font-size: 20px; }
    .nav { display: flex; gap: 4px; margin-right: auto; }
    .nav a { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; color: var(--text-2); border-radius: 8px; font-size: 14px; font-weight: 550; text-decoration: none; }
    .nav a .icon { font-size: 19px; }
    .nav a:hover { background: var(--surface-2); } .nav a.active { color: var(--brand-600); background: var(--brand-50); }
    .content { flex: 1; width: min(100%, 1120px); margin: 0 auto; padding: 32px 24px 56px; }
    .footer { padding: 20px; color: var(--text-4); border-top: 1px solid var(--border); font-size: 12.5px; text-align: center; }
    @media (max-width: 600px) { .header-inner, .content { padding-left: 16px; padding-right: 16px; } .nav a { padding: 0 8px; } }
  `],
})
export class ClientLayoutComponent {}
