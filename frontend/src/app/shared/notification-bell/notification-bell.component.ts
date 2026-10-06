import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FeedItem, NotificationService } from '../../core/notifications/notification.service';
import { SENTIMENT_CLASS, SENTIMENT_LABEL, formatRelative } from '../../core/format';
import { Sentiment } from '../../core/models/models';
import { StarsComponent } from '../stars/stars.component';

const PREVIEW = 6;

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [StarsComponent, RouterLink],
  template: `
    <button class="bell" type="button" (click)="toggle()" [attr.aria-expanded]="open()" aria-haspopup="dialog"
            [attr.aria-label]="'Notifications' + (n.unread() ? ', ' + n.unread() + ' non lue(s)' : '')">
      <span class="icon" [class.fill]="n.unread() > 0">notifications</span>
      @if (n.unread()) { <span class="badge tabular">{{ n.unread() > 9 ? '9+' : n.unread() }}</span> }
    </button>

    @if (open()) {
      <section class="panel fade-in" role="dialog" aria-label="Notifications">
        <header>
          <div>
            <h3>Notifications</h3>
            <span class="live" [class.on]="n.connected()"><span class="pulse"></span>{{ n.connected() ? 'Temps réel' : 'Reconnexion…' }}</span>
          </div>
          @if (n.unread()) { <button class="link-btn" type="button" (click)="n.markAllRead()">Tout marquer lu</button> }
        </header>
        @if (preview().length) {
          <ul>
            @for (f of preview(); track f.item.receivedAt) {
              <li [class.unread]="!f.item.read">
                @if (f.source === 'review') {
                  <button type="button" (click)="openReview(f.item.id, f.item.receivedAt)">
                    <span class="dot" [class]="'dot ' + tone(f.item.label)"></span>
                    <span class="body">
                      <span class="title"><strong>{{ f.item.authorName ?? 'Un client' }}</strong> {{ f.item.type === 'review.updated' ? 'a modifié son avis' : 'a publié un avis' }} <span [class]="'sent ' + tone(f.item.label)">{{ label(f.item.label).toLowerCase() }}</span>@if (f.item.imageUrls.length) { <span class="icon photo-ic" title="Avec photos">photo_camera</span> }</span>
                      <span class="excerpt" dir="auto">« {{ f.item.text }} »</span>
                      <span class="meta">
                        @if (f.item.rating) { <app-stars [value]="f.item.rating" /> }
                        <span class="tag">{{ f.item.product }}</span>
                        <span class="muted">{{ relative(f.item.createdAt) }}</span>
                      </span>
                    </span>
                  </button>
                } @else {
                  <button type="button" (click)="openLink(f)">
                    <span class="icon sys-ic">{{ f.item.kind === 'import.done' ? 'task_alt' : f.item.kind === 'import.errors' ? 'rule' : 'cloud_off' }}</span>
                    <span class="body">
                      <span class="title"><strong>{{ f.item.title }}</strong></span>
                      <span class="excerpt">{{ f.item.message }}</span>
                    </span>
                  </button>
                }
              </li>
            }
          </ul>
        } @else {
          <div class="empty"><span class="icon">notifications_active</span><p>Aucune notification.<br />Les nouveaux avis clients apparaîtront ici en temps réel.</p></div>
        }
        <footer><a class="link-btn" routerLink="/notifications" (click)="open.set(false)">Voir toutes les notifications<span class="icon">arrow_forward</span></a></footer>
      </section>
    }
  `,
  styles: [`
    :host { position: relative; display: inline-flex; }
    .bell { position: relative; display: grid; place-items: center; width: 38px; height: 38px; color: var(--text-2); background: none; border: 1px solid transparent; border-radius: var(--r); transition: background .12s, border-color .12s; }
    .bell:hover, .bell[aria-expanded='true'] { color: var(--text); background: var(--surface-3); }
    .bell .icon { font-size: 22px; }
    .badge { position: absolute; top: 3px; right: 2px; min-width: 18px; height: 18px; padding: 0 4px; color: #fff; background: var(--neg); border: 2px solid var(--surface); border-radius: 99px; font-size: 10px; font-weight: 700; line-height: 14px; animation: pop .3s ease; }
    @keyframes pop { 0% { transform: scale(.4); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
    .panel { position: absolute; top: calc(100% + 8px); right: -8px; z-index: 30; width: 400px; max-width: calc(100vw - 24px); background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-md); overflow: hidden; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    header div { display: flex; align-items: center; gap: 10px; }
    .live { display: inline-flex; align-items: center; gap: 6px; color: var(--text-3); font-size: 12px; font-weight: 550; }
    .pulse { width: 7px; height: 7px; background: var(--text-5); border-radius: 50%; }
    .live.on { color: var(--pos-text); } .live.on .pulse { background: var(--pos); }
    ul { max-height: 420px; margin: 0; padding: 6px; overflow-y: auto; list-style: none; }
    li button { display: flex; gap: 10px; width: 100%; padding: 10px; background: none; border: 0; border-radius: var(--r); text-align: start; }
    li button:hover { background: var(--surface-2); }
    li.unread button { background: var(--primary-50); } li.unread button:hover { background: var(--primary-100); }
    li .dot { margin-top: 6px; }
    .sys-ic { color: var(--primary); font-size: 18px; }
    .body { display: grid; gap: 4px; min-width: 0; }
    .title { font-size: 13.5px; } .title strong { font-weight: 600; }
    .sent { font-weight: 600; } .sent.pos { color: var(--pos-text); } .sent.neg { color: var(--neg-text); } .sent.neu { color: var(--neu-text); }
    .photo-ic { margin-left: 4px; color: var(--text-4); font-size: 15px; vertical-align: -3px; }
    .excerpt { overflow: hidden; color: var(--text-2); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .meta { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .empty { display: grid; justify-items: center; gap: 8px; padding: 32px 24px; color: var(--text-3); text-align: center; font-size: 13.5px; }
    .empty .icon { color: var(--text-4); font-size: 32px; }
    footer { padding: 10px 16px; border-top: 1px solid var(--border); background: var(--surface-2); text-align: center; }
  `],
})
export class NotificationBellComponent {
  readonly n = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly open = signal(false);
  readonly preview = computed(() => this.n.feed().slice(0, PREVIEW));
  readonly tone = (l: Sentiment) => SENTIMENT_CLASS[l];
  readonly label = (l: Sentiment) => SENTIMENT_LABEL[l];
  readonly relative = (iso: string) => formatRelative(iso);

  toggle() { this.open.set(!this.open()); }

  /** Ouvre le détail de l'avis dans la page Avis clients. */
  openReview(id: number, receivedAt: number) {
    this.open.set(false);
    this.n.markRead(receivedAt);
    this.router.navigate(['/reviews'], { queryParams: { review: id } });
  }

  openLink(f: FeedItem) {
    this.open.set(false);
    this.n.markRead(f.item.receivedAt);
    if (f.source === 'system' && f.item.link) this.router.navigateByUrl(f.item.link);
  }

  @HostListener('document:click', ['$event'])
  closeOutside(e: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape() { this.open.set(false); }
}
