import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FeedItem, NotificationService } from '../../core/notifications/notification.service';
import { SENTIMENT_CLASS, SENTIMENT_LABEL, formatDateTime, formatRelative } from '../../core/format';
import { Sentiment } from '../../core/models/models';
import { StarsComponent } from '../../shared/stars/stars.component';
import { EmptyStateComponent } from '../../shared/states/states.component';
import { ReviewDetailDrawerComponent } from '../../shared/review-detail/review-detail-drawer.component';
import { SENTIMENT_ICON } from '../../shared/sentiment-badge/sentiment-badge.component';

type Filter = 'all' | 'unread' | Sentiment | 'system';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Toutes' },
  { value: 'unread', label: 'Non lues' },
  { value: 'NEGATIVE', label: 'Négatifs' },
  { value: 'NEUTRAL', label: 'Neutres' },
  { value: 'POSITIVE', label: 'Positifs' },
  { value: 'system', label: 'Imports & IA' },
];

const SYSTEM_META = {
  'import.done': { icon: 'task_alt', label: 'Import terminé', tone: 'pos' },
  'import.errors': { icon: 'rule', label: 'Import avec erreurs', tone: 'neu' },
  'analysis.unavailable': { icon: 'cloud_off', label: 'Analyse indisponible', tone: 'neg' },
} as const;

/** Centre de notifications : avis reçus en temps réel (WebSocket) et événements de la session. */
@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [RouterLink, StarsComponent, EmptyStateComponent, ReviewDetailDrawerComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Notifications</h1>
        <p class="subtitle">Avis clients reçus en temps réel et événements de vos imports, pendant cette session.</p>
      </div>
      <div class="page-actions">
        <span class="live" [class.on]="n.connected()" role="status"><span class="pulse"></span>{{ n.connected() ? 'Connecté en temps réel' : 'Reconnexion…' }}</span>
        <button class="btn btn-secondary" type="button" (click)="n.markAllRead()" [disabled]="!n.unread()"><span class="icon">done_all</span>Tout marquer comme lu</button>
        <button class="btn btn-ghost" type="button" (click)="n.clear()" [disabled]="!n.feed().length"><span class="icon">delete_sweep</span>Effacer</button>
      </div>
    </header>

    <section class="card">
      <div class="filter-bar">
        <div class="segmented" role="group" aria-label="Filtrer les notifications">
          @for (f of filters; track f.value) {
            <button type="button" [class.active]="filter() === f.value" [attr.aria-pressed]="filter() === f.value" (click)="filter.set(f.value)">
              {{ f.label }}@if (f.value === 'unread' && n.unread()) { <span class="count tabular">{{ n.unread() }}</span> }
            </button>
          }
        </div>
      </div>

      @if (visible().length) {
        <ul class="feed">
          @for (f of visible(); track f.item.receivedAt) {
            <li [class.unread]="!f.item.read">
              @if (f.source === 'review') {
                <span class="type-icon" [class]="'type-icon ' + tone(f.item.label)"><span class="icon fill">{{ sentimentIcon(f.item.label) }}</span></span>
                <div class="body">
                  <div class="title">
                    <strong>{{ f.item.type === 'review.updated' ? 'Avis modifié' : 'Nouvel avis ' + label(f.item.label).toLowerCase() }}</strong>
                    @if (!f.item.read) { <span class="new-tag">Nouveau</span> }
                  </div>
                  <p class="message"><span>{{ f.item.authorName ?? 'Un client' }}</span> sur <span class="tag">{{ f.item.product }}</span>
                    @if (f.item.rating) { <app-stars [value]="f.item.rating" /> }
                  </p>
                  <p class="excerpt review-text" dir="auto">« {{ f.item.text }} »</p>
                </div>
                <div class="side">
                  <time class="muted small" [attr.datetime]="f.item.createdAt" [title]="dateTime(f.item.createdAt)">{{ relative(f.item.createdAt) }}</time>
                  <button class="btn btn-secondary btn-sm" type="button" (click)="openReview(f)">Voir l’avis</button>
                </div>
              } @else {
                <span class="type-icon" [class]="'type-icon ' + system(f).tone"><span class="icon">{{ system(f).icon }}</span></span>
                <div class="body">
                  <div class="title"><strong>{{ f.item.title }}</strong>@if (!f.item.read) { <span class="new-tag">Nouveau</span> }</div>
                  <p class="message">{{ f.item.message }}</p>
                </div>
                <div class="side">
                  <time class="muted small" [title]="dateTime(iso(f.item.receivedAt))">{{ relative(iso(f.item.receivedAt)) }}</time>
                  @if (f.item.link) { <a class="btn btn-secondary btn-sm" [routerLink]="f.item.link" (click)="n.markRead(f.item.receivedAt)">Ouvrir</a> }
                </div>
              }
            </li>
          }
        </ul>
      } @else {
        <app-empty-state icon="notifications_active" [title]="n.feed().length ? 'Aucune notification pour ce filtre' : 'Aucune notification'"
          [message]="n.feed().length ? 'Choisissez un autre filtre.' : 'Les avis publiés par les clients et les résultats de vos imports apparaîtront ici dès qu’ils arrivent.'" />
      }
    </section>

    <app-review-detail-drawer [review]="detail()" (closed)="detail.set(null)" />
  `,
  styles: [`
    .live { display: inline-flex; align-items: center; gap: 6px; margin-right: 6px; color: var(--text-3); font-size: 13px; font-weight: 550; }
    .pulse { width: 8px; height: 8px; background: var(--text-5); border-radius: 50%; }
    .live.on { color: var(--pos-text); } .live.on .pulse { background: var(--pos); }
    .count { min-width: 18px; height: 18px; padding: 0 5px; color: #fff; background: var(--primary); border-radius: 99px; font-size: 11px; line-height: 18px; }
    .feed { margin: 0; padding: 0; list-style: none; }
    .feed li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 14px; padding: 16px 20px; border-bottom: 1px solid var(--border); }
    .feed li:last-child { border-bottom: 0; }
    .feed li.unread { background: linear-gradient(90deg, var(--primary-50), transparent 60%); box-shadow: inset 3px 0 0 var(--primary); }
    .type-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; color: var(--text-2); background: var(--surface-3); }
    .type-icon.pos { color: var(--pos-text); background: var(--pos-soft); } .type-icon.neu { color: var(--neu-text); background: var(--neu-soft); } .type-icon.neg { color: var(--neg-text); background: var(--neg-soft); }
    .type-icon .icon { font-size: 20px; }
    .body { display: grid; gap: 4px; min-width: 0; }
    .title { display: flex; align-items: center; gap: 8px; } .title strong { font-weight: 600; }
    .new-tag { padding: 1px 7px; color: var(--primary-text); background: var(--primary-50); border-radius: 99px; font-size: 11px; font-weight: 650; }
    .message { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; color: var(--text-2); font-size: 13.5px; }
    .excerpt { color: var(--text-2); font-size: 13.5px; }
    .side { display: grid; justify-items: end; align-content: start; gap: 8px; }
    @media (max-width: 640px) {
      .feed li { grid-template-columns: auto minmax(0, 1fr); } .side { grid-column: 2; justify-items: start; grid-auto-flow: column; align-items: center; justify-content: space-between; }
      .segmented { width: 100%; overflow-x: auto; }
    }
  `],
})
export class NotificationsPageComponent {
  readonly n = inject(NotificationService);

  readonly filters = FILTERS;
  readonly filter = signal<Filter>('all');
  readonly detail = signal<number | null>(null);

  readonly visible = computed(() => {
    const f = this.filter();
    return this.n.feed().filter((x) =>
      f === 'all' ? true
        : f === 'unread' ? !x.item.read
        : f === 'system' ? x.source === 'system'
        : x.source === 'review' && x.item.label === f);
  });

  readonly tone = (l: Sentiment) => SENTIMENT_CLASS[l];
  readonly label = (l: Sentiment) => SENTIMENT_LABEL[l];
  readonly sentimentIcon = (l: Sentiment) => SENTIMENT_ICON[l];
  readonly relative = (iso: string) => formatRelative(iso);
  readonly dateTime = formatDateTime;
  readonly iso = (ms: number) => new Date(ms).toISOString();
  readonly system = (f: FeedItem) => SYSTEM_META[(f.item as { kind: keyof typeof SYSTEM_META }).kind];

  openReview(f: FeedItem) {
    if (f.source !== 'review') return;
    this.n.markRead(f.item.receivedAt);
    this.detail.set(f.item.id);
  }
}
