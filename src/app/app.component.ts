import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="app-shell">
      <aside class="sidebar">
        <a class="brand" routerLink="/dashboard" aria-label="Sentiment, accueil">
          <span class="brand-mark"><span class="material-icons">graphic_eq</span></span>
          <span class="brand-name">sentiment<span class="brand-dot">.</span><small>ESPACE ANALYTIQUE</small></span>
        </a>

        <div class="nav-label">ESPACE DE TRAVAIL</div>
        <nav aria-label="Navigation principale">
          <a routerLink="/dashboard" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">
            <span class="material-icons">space_dashboard</span><span>Vue d'ensemble</span>
          </a>
          <a routerLink="/reviews" routerLinkActive="active">
            <span class="material-icons">forum</span><span>Avis clients</span>
          </a>
          <a routerLink="/analyze" routerLinkActive="active">
            <span class="material-icons">auto_awesome</span><span>Analyser un avis</span>
          </a>
          <a routerLink="/import" routerLinkActive="active">
            <span class="material-icons">upload_file</span><span>Importer des avis</span>
          </a>
        </nav>

        <div class="sidebar-bottom">
          <div class="status-indicator"><span></span> Analyse des sentiments</div>
          <div class="profile"><div class="avatar">S</div><div><strong>Sentiment</strong><small>Espace de travail</small></div></div>
        </div>
      </aside>

      <div class="workspace">
        <header class="topbar">
          <div class="breadcrumb"><span>ESPACE DE TRAVAIL</span><span class="material-icons">chevron_right</span><strong>Analyse client</strong></div>
          <div class="topbar-meta"><span class="live-dot"></span><span>Plateforme d'analyse</span></div>
        </header>
        <main class="page-content"><router-outlet /></main>
        <footer class="app-footer"><span>Sentiment</span><span>Comprendre chaque retour.</span></footer>
      </div>
    </div>
  `,
})
export class AppComponent {}
