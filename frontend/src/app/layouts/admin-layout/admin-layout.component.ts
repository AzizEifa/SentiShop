import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { ApiStatusService } from '../../core/api/api-status.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { PageData } from '../../app.routes';
import { NotificationBellComponent } from '../../shared/notification-bell/notification-bell.component';
import { ToastStackComponent } from '../../shared/toast-stack/toast-stack.component';
import { UserMenuComponent } from '../../shared/user-menu/user-menu.component';

interface NavItem { path: string; label: string; icon: string; }
interface NavSection { label: string; items: NavItem[]; }

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationBellComponent, UserMenuComponent, ToastStackComponent],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <a class="brand" routerLink="/dashboard" aria-label="SentiShop, accueil">
          <span class="brand-mark"><span class="icon fill">insights</span></span>
          <span class="brand-text">SentiShop<small>Avis clients · IA</small></span>
        </a>

        <nav class="nav" aria-label="Navigation principale">
          @for (section of nav; track section.label) {
            <div class="nav-section">
              <span class="nav-section-label">{{ section.label }}</span>
              @for (item of section.items; track item.path) {
                <a class="nav-link" [routerLink]="item.path" routerLinkActive="active">
                  <span class="icon">{{ item.icon }}</span><span class="nav-label">{{ item.label }}</span>
                </a>
              }
            </div>
          }
        </nav>

        <div class="api-status" [class]="'api-status ' + api.status()" role="status" aria-live="polite">
          <span class="status-dot"></span>
          <div>
            <strong>{{ statusText[api.status()] }}</strong>
            <small>Modèle XLM-RoBERTa · Hugging Face</small>
          </div>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <nav class="breadcrumb" aria-label="Fil d'Ariane">
            <span>{{ page()?.section }}</span>
            <span class="icon">chevron_right</span>
            <strong>{{ page()?.title }}</strong>
          </nav>
          <div class="topbar-actions">
            <a class="btn btn-secondary btn-sm" routerLink="/analyze"><span class="icon">bolt</span>Analyse rapide</a>
            <app-notification-bell />
            <span class="divider"></span>
            <app-user-menu />
          </div>
        </header>
        <main class="content"><router-outlet /></main>
      </div>
    </div>
    <app-toast-stack />
  `,
  styles: [`
    .shell { min-height: 100vh; }
    .sidebar {
      position: fixed; inset: 0 auto 0 0; z-index: 10; width: var(--sidebar-w);
      display: flex; flex-direction: column; gap: 8px; padding: 20px 14px 16px;
      background: var(--surface); border-right: 1px solid var(--border);
    }
    .brand { display: flex; align-items: center; gap: 10px; padding: 4px 8px 20px; color: var(--text); text-decoration: none; }
    .brand-mark { display: grid; place-items: center; width: 36px; height: 36px; color: #fff; background: linear-gradient(135deg, var(--brand), #1aa37a); border-radius: 10px; box-shadow: var(--shadow-sm); }
    .brand-mark .icon { font-size: 22px; }
    .brand-text { display: grid; font-size: 16px; font-weight: 700; letter-spacing: -.02em; line-height: 1.2; }
    .brand-text small { color: var(--text-3); font-size: 12px; font-weight: 500; letter-spacing: 0; }
    .nav { display: grid; gap: 18px; }
    .nav-section { display: grid; gap: 2px; }
    .nav-section-label { padding: 0 10px 6px; color: var(--text-4); font-size: 11.5px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; }
    .nav-link {
      display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 10px;
      color: var(--text-2); border-radius: 8px; font-size: 14px; font-weight: 500; text-decoration: none;
      transition: background .15s, color .15s;
    }
    .nav-link .icon { color: var(--text-4); font-size: 20px; transition: color .15s; }
    .nav-link:hover { color: var(--text); background: var(--surface-2); }
    .nav-link.active { color: var(--brand-600); background: var(--brand-50); font-weight: 600; }
    .nav-link.active .icon { color: var(--brand); font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24; }
    .api-status { display: flex; align-items: center; gap: 10px; margin-top: auto; padding: 12px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r); }
    .api-status strong { display: block; font-size: 13px; font-weight: 600; }
    .api-status small { display: block; color: var(--text-3); font-size: 11.5px; }
    .status-dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: var(--text-4); }
    .api-status.online .status-dot { background: var(--pos); box-shadow: 0 0 0 3px var(--pos-soft); }
    .api-status.offline .status-dot { background: var(--neg); box-shadow: 0 0 0 3px var(--neg-soft); }
    .api-status.offline strong { color: var(--neg-text); }
    .main { min-height: 100vh; margin-left: var(--sidebar-w); }
    .topbar {
      position: sticky; top: 0; z-index: 5; display: flex; align-items: center; justify-content: space-between;
      height: 60px; padding: 0 32px; background: rgba(245, 246, 248, .85); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
    }
    .topbar-actions { display: flex; align-items: center; gap: 8px; }
    .divider { width: 1px; height: 24px; margin: 0 4px; background: var(--border); }
    .breadcrumb { display: flex; align-items: center; gap: 6px; color: var(--text-3); font-size: 13.5px; }
    .breadcrumb .icon { font-size: 18px; color: var(--text-4); }
    .breadcrumb strong { color: var(--text); font-weight: 600; }
    .content { width: min(100%, 1280px); margin: 0 auto; padding: 28px 32px 56px; }

    @media (max-width: 900px) {
      .sidebar { position: sticky; top: 0; inset: auto; width: 100%; flex-direction: row; align-items: center; gap: 12px; padding: 10px 16px; border-right: 0; border-bottom: 1px solid var(--border); overflow-x: auto; }
      .brand { padding: 0; } .brand-text small, .nav-section-label, .api-status div { display: none; }
      .nav { display: flex; gap: 2px; } .nav-section { display: flex; gap: 2px; }
      .nav-link { height: 36px; white-space: nowrap; }
      .api-status { margin: 0 0 0 auto; padding: 8px; }
      .main { margin-left: 0; }
      .topbar { position: static; height: 56px; padding: 0 16px; } .breadcrumb { display: none; } .topbar-actions { margin-left: auto; } .topbar-actions .btn { display: none; }
      .content { padding: 20px 16px 40px; }
    }
    @media (max-width: 600px) { .nav-label { display: none; } }
  `],
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  readonly api = inject(ApiStatusService);
  private readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);

  readonly statusText = { checking: 'Connexion…', online: 'API connectée', offline: 'API hors ligne' };

  readonly nav: NavSection[] = [
    { label: 'Pilotage', items: [
      { path: '/dashboard', label: "Vue d'ensemble", icon: 'space_dashboard' },
      { path: '/reviews', label: 'Avis clients', icon: 'reviews' },
    ] },
    { label: 'Analyse', items: [
      { path: '/analyze', label: 'Analyser un avis', icon: 'edit_note' },
      { path: '/import', label: 'Importer des avis', icon: 'upload_file' },
    ] },
    { label: 'Laboratoire', items: [
      { path: '/compare', label: 'Comparer les modèles', icon: 'compare_arrows' },
    ] },
    { label: 'Administration', items: [
      { path: '/users', label: 'Utilisateurs', icon: 'group' },
    ] },
  ];

  readonly page = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), map(() => this.currentPage()), startWith(undefined), map(() => this.currentPage())),
    { initialValue: undefined }
  );

  /** Notifications temps réel actives tant que l'admin est dans le back-office. */
  ngOnInit() { this.notifications.connect(); }
  ngOnDestroy() { this.notifications.disconnect(); }

  private currentPage(): PageData | undefined {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (route?.firstChild) route = route.firstChild;
    return route?.data as PageData | undefined;
  }
}
