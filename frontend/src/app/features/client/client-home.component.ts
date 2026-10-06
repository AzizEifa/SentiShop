import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ClientApi } from '../../core/api/client-api.service';
import { MyReview } from '../../core/models/models';
import { formatRelative } from '../../core/format';
import { StarsComponent } from '../../shared/stars/stars.component';
import { AvatarComponent } from '../../shared/avatar/avatar.component';

/** Espace client — accueil : où j'en suis, et l'action principale (déposer un avis). */
@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [RouterLink, StarsComponent, AvatarComponent],
  template: `
    @if (auth.user(); as u) {
      <section class="hero card">
        <app-avatar [name]="u.fullName" [url]="u.avatarUrl" [size]="56" />
        <div class="hero-text">
          <h1>Bonjour {{ firstName() }}</h1>
          <p>Votre avis compte : il aide la boutique à améliorer ses produits et son service.</p>
        </div>
        <a class="btn btn-primary btn-lg" routerLink="/espace/nouveau"><span class="icon">edit</span>Déposer un avis</a>
      </section>
    }

    <section class="stats" aria-label="Mon activité">
      <article class="card stat"><span class="icon">rate_review</span><div><strong class="tabular">{{ loading() ? '…' : total() }}</strong><span>avis publié{{ total() > 1 ? 's' : '' }}</span></div></article>
      <article class="card stat"><span class="icon">star</span><div><strong class="tabular">{{ average() ?? '—' }}</strong><span>note moyenne donnée</span></div></article>
      <article class="card stat"><span class="icon">schedule</span><div><strong>{{ last() ? relative(last()!) : '—' }}</strong><span>dernier avis</span></div></article>
    </section>

    <div class="grid">
      <section class="card">
        <div class="card-header">
          <div><h2>Mes derniers avis</h2><p class="card-subtitle">Les trois plus récents</p></div>
          @if (total()) { <a class="link-btn" routerLink="/espace/avis">Tout voir<span class="icon">arrow_forward</span></a> }
        </div>
        @if (loading()) {
          <div class="pad">@for (i of [1, 2]; track i) { <span class="skeleton" style="height: 60px; margin-bottom: 10px"></span> }</div>
        } @else if (recent().length) {
          <ul class="recent">
            @for (r of recent(); track r.id) {
              <li>
                <div class="recent-head"><strong>{{ r.product }}</strong><app-stars [value]="r.rating" /></div>
                <p class="review-text" dir="auto">{{ r.text }}</p>
                <span class="muted small">{{ relative(r.createdAt) }}</span>
              </li>
            }
          </ul>
        } @else {
          <div class="empty-state compact">
            <div class="empty-icon"><span class="icon">rate_review</span></div>
            <h3>Aucun avis pour l’instant</h3>
            <p>Vous n’avez pas encore publié d’avis. Partagez votre expérience avec un premier produit.</p>
            <div class="page-actions"><a class="btn btn-primary btn-sm" routerLink="/espace/nouveau">Déposer mon premier avis</a></div>
          </div>
        }
      </section>

      <nav class="shortcuts" aria-label="Raccourcis">
        <a class="card shortcut" routerLink="/espace/nouveau"><span class="sc-icon"><span class="icon">edit</span></span><span><strong>Déposer un avis</strong><small>Note, texte, émojis et jusqu’à 3 photos</small></span><span class="icon chev">chevron_right</span></a>
        <a class="card shortcut" routerLink="/espace/avis"><span class="sc-icon"><span class="icon">rate_review</span></span><span><strong>Mes avis</strong><small>Modifier ou supprimer un avis publié</small></span><span class="icon chev">chevron_right</span></a>
        <a class="card shortcut" routerLink="/espace/profil"><span class="sc-icon"><span class="icon">manage_accounts</span></span><span><strong>Mon profil</strong><small>Photo, nom, email et mot de passe</small></span><span class="icon chev">chevron_right</span></a>
      </nav>
    </div>
  `,
  styles: [`
    .hero { display: flex; align-items: center; gap: 18px; margin-bottom: 16px; padding: 24px; background: linear-gradient(120deg, var(--surface) 55%, var(--primary-50)); }
    .hero-text { flex: 1; min-width: 0; } .hero-text p { margin-top: 4px; color: var(--text-2); }
    .stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 16px; }
    .stat { display: flex; align-items: center; gap: 14px; padding: 18px 20px; }
    .stat > .icon { display: grid; place-items: center; width: 40px; height: 40px; color: var(--primary); background: var(--primary-50); border-radius: var(--r); font-size: 20px; }
    .stat div { display: grid; } .stat strong { font-size: 20px; font-weight: 650; letter-spacing: -.02em; } .stat div span { color: var(--text-3); font-size: 13px; }
    .grid { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(260px, 1fr); align-items: start; gap: 16px; }
    .pad { padding: 16px 20px; }
    .recent { margin: 0; padding: 0; list-style: none; }
    .recent li { display: grid; gap: 6px; padding: 14px 20px; border-bottom: 1px solid var(--border); } .recent li:last-child { border-bottom: 0; }
    .recent-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; } .recent-head strong { font-weight: 600; }
    .shortcuts { display: grid; gap: 10px; }
    .shortcut { display: flex; align-items: center; gap: 14px; padding: 16px; color: var(--text); text-decoration: none; transition: border-color .12s, box-shadow .12s; }
    .shortcut:hover { border-color: var(--primary-100); box-shadow: var(--shadow-sm); }
    .shortcut > span:nth-child(2) { display: grid; flex: 1; } .shortcut strong { font-weight: 600; } .shortcut small { color: var(--text-3); font-size: 12.5px; }
    .sc-icon { display: grid; place-items: center; width: 38px; height: 38px; color: var(--navy); background: var(--surface-3); border-radius: var(--r); }
    .chev { color: var(--text-4); }
    @media (max-width: 800px) { .grid { grid-template-columns: 1fr; } .stats { grid-template-columns: 1fr; } .hero { flex-wrap: wrap; } .hero .btn { width: 100%; } }
  `],
})
export class ClientHomeComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(ClientApi);

  readonly reviews = signal<MyReview[]>([]);
  readonly total = signal(0);
  readonly loading = signal(true);
  readonly firstName = computed(() => (this.auth.user()?.fullName ?? '').split(' ')[0]);
  readonly recent = computed(() => this.reviews().slice(0, 3));
  readonly last = computed(() => this.reviews()[0]?.createdAt ?? null);
  /** Moyenne des notes sur les avis chargés (les 50 plus récents). */
  readonly average = computed(() => {
    const list = this.reviews();
    return list.length ? (list.reduce((a, r) => a + r.rating, 0) / list.length).toLocaleString('fr-FR', { maximumFractionDigits: 1 }) + ' / 5' : null;
  });
  readonly relative = (iso: string) => formatRelative(iso);

  ngOnInit() {
    this.api.mine(0, 50).subscribe({
      next: (page) => { this.reviews.set(page.content); this.total.set(page.totalElements); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
