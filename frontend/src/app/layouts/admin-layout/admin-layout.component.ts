import { Component, DestroyRef, HostListener, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRouteSnapshot, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { ApiStatusService } from '../../core/api/api-status.service';
import { NotificationService } from '../../core/notifications/notification.service';
import { PageData } from '../../app.routes';
import { NotificationBellComponent } from '../../shared/notification-bell/notification-bell.component';
import { ToastStackComponent } from '../../shared/toast-stack/toast-stack.component';
import { UserMenuComponent } from '../../shared/user-menu/user-menu.component';

interface NavItem { path: string; label: string; icon: string; badge?: 'unread'; }
interface NavSection { label: string; items: NavItem[]; }

const COLLAPSED_KEY = 'sentishop.sidebar.collapsed';

/** Navigation du back-office : uniquement les pages ouvertes au rôle administrateur (cf. app.routes). */
export const ADMIN_NAV: NavSection[] = [
  { label: 'Pilotage', items: [
    { path: '/dashboard', label: 'Tableau de bord', icon: 'space_dashboard' },
    { path: '/reviews', label: 'Avis clients', icon: 'reviews' },
  ] },
  { label: 'Intelligence', items: [
    { path: '/analyze', label: 'Analyser un avis', icon: 'psychology' },
    { path: '/import', label: 'Importer des avis', icon: 'upload_file' },
    { path: '/compare', label: 'Comparer les modèles', icon: 'compare_arrows' },
  ] },
  { label: 'Gestion', items: [
    { path: '/products', label: 'Produits', icon: 'inventory_2' },
    { path: '/users', label: 'Utilisateurs', icon: 'group' },
    { path: '/notifications', label: 'Notifications', icon: 'notifications', badge: 'unread' },
  ] },
];

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationBellComponent, UserMenuComponent, ToastStackComponent],
  template: `
    <a class="skip-link" href="#main">Aller au contenu</a>
    <div class="shell" [class.collapsed]="collapsed()" [class.menu-open]="menuOpen()">
      <aside class="sidebar" id="sidebar" aria-label="Menu du back-office">
        <div class="sidebar-head">
          <a class="brand" routerLink="/dashboard" aria-label="SentiShop Intelligence, tableau de bord">
            <span class="brand-mark">S</span>
            <span class="brand-text"><strong>SentiShop</strong><small>Intelligence</small></span>
          </a>
          <button class="close-menu" type="button" aria-label="Fermer le menu" (click)="menuOpen.set(false)"><span class="icon">close</span></button>
        </div>

        <nav class="nav" aria-label="Navigation principale">
          @for (section of nav; track section.label) {
            <div class="nav-section">
              <span class="nav-section-label">{{ section.label }}</span>
              @for (item of section.items; track item.path) {
                <a class="nav-link" [routerLink]="item.path" routerLinkActive="active" #rla="routerLinkActive"
                   [attr.aria-current]="rla.isActive ? 'page' : null" [attr.title]="collapsed() ? item.label : null">
                  <span class="icon" [class.fill]="rla.isActive">{{ item.icon }}</span>
                  <span class="nav-label">{{ item.label }}</span>
                  @if (item.badge === 'unread' && notifications.unread()) {
                    <span class="nav-badge tabular" [attr.aria-label]="notifications.unread() + ' non lue(s)'">{{ notifications.unread() > 99 ? '99+' : notifications.unread() }}</span>
                  }
                </a>
              }
            </div>
          }
        </nav>

        <div class="sidebar-foot">
          <div class="api-status" [class]="'api-status ' + api.status()" role="status" aria-live="polite" title="Backend Spring Boot · modèle XLM-RoBERTa via Hugging Face">
            <span class="status-dot"></span>
            <span class="status-text">{{ statusText[api.status()] }}</span>
          </div>
          <button class="collapse-btn" type="button" (click)="toggleCollapsed()" [attr.aria-label]="collapsed() ? 'Déplier le menu' : 'Replier le menu'" [attr.aria-expanded]="!collapsed()">
            <span class="icon">{{ collapsed() ? 'left_panel_open' : 'left_panel_close' }}</span><span class="nav-label">Replier</span>
          </button>
        </div>
      </aside>
      <div class="menu-backdrop" (click)="menuOpen.set(false)"></div>

      <div class="main">
        <header class="topbar">
          <button class="menu-btn btn btn-ghost btn-icon" type="button" aria-label="Ouvrir le menu" aria-controls="sidebar" [attr.aria-expanded]="menuOpen()" (click)="menuOpen.set(true)"><span class="icon">menu</span></button>
          <div class="context">
            <nav class="breadcrumb" aria-label="Fil d'Ariane">
              <span>SentiShop</span><span class="icon">chevron_right</span><span>{{ page()?.section }}</span>
            </nav>
            <strong class="context-title">{{ page()?.title }}</strong>
          </div>
          <div class="topbar-actions">
            <a class="btn btn-secondary btn-sm quick" routerLink="/analyze"><span class="icon">bolt</span>Analyse rapide</a>
            <app-notification-bell />
            <span class="divider"></span>
            <app-user-menu />
          </div>
        </header>
        <main class="content" id="main" tabindex="-1"><router-outlet /></main>
      </div>
    </div>
    <app-toast-stack />
  `,
  styles: [`
    .shell { min-height: 100vh; }
    .sidebar {
      position: fixed; inset: 0 auto 0 0; z-index: 40; width: var(--sidebar-w);
      display: flex; flex-direction: column; gap: 4px; padding: 16px 12px 12px;
      background: var(--sidebar-bg); transition: width .2s ease, transform .22s ease;
    }
    .sidebar-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
    .brand { display: flex; align-items: center; gap: 11px; min-width: 0; height: 40px; padding: 0 6px; color: var(--sidebar-text-strong); text-decoration: none; border-radius: var(--r); }
    .brand-text { display: grid; line-height: 1.15; white-space: nowrap; }
    .brand-text strong { font-size: 15px; font-weight: 650; letter-spacing: -.015em; }
    .brand-text small { color: var(--sidebar-muted); font-size: 11.5px; font-weight: 550; letter-spacing: .06em; text-transform: uppercase; }
    .close-menu { display: none; place-items: center; width: 34px; height: 34px; color: var(--sidebar-text); background: none; border: 0; border-radius: var(--r); }
    .nav { display: grid; gap: 18px; overflow-y: auto; }
    .nav-section { display: grid; gap: 2px; }
    .nav-section-label { padding: 0 12px 6px; color: var(--sidebar-muted); font-size: 11px; font-weight: 650; letter-spacing: .07em; text-transform: uppercase; white-space: nowrap; }
    .nav-link {
      position: relative; display: flex; align-items: center; gap: 12px; height: 38px; padding: 0 12px;
      color: var(--sidebar-text); border-radius: var(--r); font-size: 13.5px; font-weight: 500; text-decoration: none; white-space: nowrap;
      transition: background .12s, color .12s;
    }
    .nav-link .icon { color: var(--sidebar-muted); font-size: 20px; transition: color .12s; }
    .nav-link:hover { color: var(--sidebar-text-strong); background: var(--sidebar-hover); }
    .nav-link:hover .icon { color: var(--sidebar-text); }
    .nav-link.active { color: var(--sidebar-text-strong); background: var(--sidebar-active); font-weight: 600; }
    .nav-link.active::before { content: ''; position: absolute; left: -12px; top: 8px; bottom: 8px; width: 3px; background: var(--primary); border-radius: 0 3px 3px 0; }
    .nav-link.active .icon { color: #8cc0ff; }
    .nav-link:focus-visible, .collapse-btn:focus-visible, .brand:focus-visible { box-shadow: 0 0 0 2px #8cc0ff; }
    .nav-badge { min-width: 20px; height: 20px; margin-left: auto; padding: 0 6px; color: #fff; background: var(--primary); border-radius: 99px; font-size: 11px; font-weight: 700; line-height: 20px; text-align: center; }
    .sidebar-foot { display: grid; gap: 4px; margin-top: auto; padding-top: 12px; border-top: 1px solid var(--sidebar-border); }
    .api-status { display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 12px; color: var(--sidebar-text); font-size: 12.5px; white-space: nowrap; }
    .status-dot { width: 8px; height: 8px; flex: 0 0 auto; border-radius: 50%; background: var(--sidebar-muted); }
    .api-status.online .status-dot { background: #3ccf9b; box-shadow: 0 0 0 3px rgba(60, 207, 155, .18); }
    .api-status.offline .status-dot { background: #ff7b7b; box-shadow: 0 0 0 3px rgba(255, 123, 123, .18); }
    .api-status.offline { color: #ffb4b4; }
    .collapse-btn { display: flex; align-items: center; gap: 12px; height: 36px; padding: 0 12px; color: var(--sidebar-muted); background: none; border: 0; border-radius: var(--r); font-size: 13px; }
    .collapse-btn:hover { color: var(--sidebar-text-strong); background: var(--sidebar-hover); }
    .menu-backdrop { display: none; }

    /* Menu replié : icônes seules */
    .collapsed .sidebar { width: var(--sidebar-w-collapsed); }
    .collapsed .brand-text, .collapsed .nav-label, .collapsed .status-text, .collapsed .nav-section-label { display: none; }
    .collapsed .nav-section { padding-top: 6px; border-top: 1px solid var(--sidebar-border); } .collapsed .nav-section:first-child { border-top: 0; }
    .collapsed .nav-link, .collapsed .collapse-btn, .collapsed .api-status { justify-content: center; padding: 0; }
    .collapsed .nav-badge { position: absolute; top: 2px; right: 6px; min-width: 16px; height: 16px; padding: 0 4px; font-size: 10px; line-height: 16px; }
    .collapsed .main { margin-left: var(--sidebar-w-collapsed); }

    .main { min-height: 100vh; margin-left: var(--sidebar-w); transition: margin-left .2s ease; }
    .topbar {
      position: sticky; top: 0; z-index: 30; display: flex; align-items: center; gap: 12px;
      height: var(--topbar-h); padding: 0 32px; background: rgba(255, 255, 255, .92); backdrop-filter: blur(8px);
      border-bottom: 1px solid var(--border);
    }
    .menu-btn { display: none; }
    .context { display: grid; min-width: 0; line-height: 1.25; }
    .breadcrumb { display: flex; align-items: center; gap: 2px; color: var(--text-3); font-size: 12px; }
    .breadcrumb .icon { font-size: 14px; color: var(--text-5); }
    .context-title { overflow: hidden; color: var(--text); font-size: 14.5px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
    .topbar-actions { display: flex; align-items: center; gap: 6px; margin-left: auto; }
    .divider { width: 1px; height: 22px; margin: 0 6px; background: var(--border); }
    .content { width: min(100%, 1360px); margin: 0 auto; padding: 28px 32px 64px; outline: none; }

    @media (max-width: 1024px) {
      .sidebar, .collapsed .sidebar { width: min(288px, 86vw); transform: translateX(-100%); box-shadow: var(--shadow-lg); }
      .menu-open .sidebar { transform: none; }
      .collapsed .brand-text, .collapsed .nav-label, .collapsed .status-text, .collapsed .nav-section-label { display: revert; }
      .collapsed .nav-link, .collapsed .api-status { justify-content: flex-start; padding: 0 12px; }
      .collapse-btn { display: none; }
      .close-menu { display: grid; }
      .menu-open .menu-backdrop { display: block; position: fixed; inset: 0; z-index: 35; background: rgba(15, 39, 71, .4); animation: fade-in .15s ease both; }
      .main, .collapsed .main { margin-left: 0; }
      .menu-btn { display: inline-flex; }
      .topbar { padding: 0 16px; }
      .content { padding: 20px 16px 48px; }
    }
    @media (max-width: 640px) { .quick, .divider, .breadcrumb { display: none; } }
  `],
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  readonly api = inject(ApiStatusService);
  readonly notifications = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly statusText = { checking: 'Connexion…', online: 'API connectée', offline: 'API hors ligne' };
  readonly nav = ADMIN_NAV;
  readonly collapsed = signal(readCollapsed());
  readonly menuOpen = signal(false);

  readonly page = toSignal(
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), startWith(null), map(() => this.currentPage())),
    { initialValue: undefined }
  );

  /** Notifications temps réel actives tant que l'admin est dans le back-office. */
  ngOnInit() {
    this.notifications.connect();
    // menu mobile refermé après chaque navigation
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd), takeUntilDestroyed(this.destroyRef)).subscribe(() => this.menuOpen.set(false));
  }
  ngOnDestroy() { this.notifications.disconnect(); }

  toggleCollapsed() {
    this.collapsed.update((c) => !c);
    try { localStorage.setItem(COLLAPSED_KEY, this.collapsed() ? '1' : '0'); } catch { /* stockage indisponible */ }
  }

  @HostListener('document:keydown.escape')
  closeMenu() { this.menuOpen.set(false); }

  private currentPage(): PageData | undefined {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    while (route?.firstChild) route = route.firstChild;
    return route?.data as PageData | undefined;
  }
}

function readCollapsed(): boolean {
  try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
}
