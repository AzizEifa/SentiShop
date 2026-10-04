import { Component, ElementRef, HostListener, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../core/notifications/notification.service';
import { SENTIMENT_CLASS, SENTIMENT_LABEL, formatRelative } from '../../core/format';
import { Sentiment } from '../../core/models/models';
import { StarsComponent } from '../stars/stars.component';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [StarsComponent],
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
            <span class="live" [class.on]="n.connected()"><span class="pulse"></span>{{ n.connected() ? 'En direct' : 'Reconnexion…' }}</span>
          </div>
          @if (n.items().length) { <button class="link-btn" type="button" (click)="n.clear()">Tout effacer</button> }
        </header>
        @if (n.items().length) {
          <ul>
            @for (item of n.items(); track item.receivedAt) {
              <li [class.unread]="!item.read">
                <button type="button" (click)="openReviews(item.label)">
                  <span class="dot" [class]="'dot ' + tone(item.label)"></span>
                  <span class="body">
                    <span class="title"><strong>{{ item.authorName ?? 'Un client' }}</strong> a publié un avis {{ label(item.label).toLowerCase() }}</span>
                    <span class="excerpt" dir="auto">« {{ item.text }} »</span>
                    <span class="meta">
                      @if (item.rating) { <app-stars [value]="item.rating" /> }
                      <span class="tag">{{ item.product }}</span>
                      <span class="muted">{{ relative(item.createdAt) }}</span>
                    </span>
                  </span>
                </button>
              </li>
            }
          </ul>
        } @else {
          <div class="empty"><span class="icon">notifications_active</span><p>Aucune notification.<br />Les nouveaux avis clients apparaîtront ici en temps réel.</p></div>
        }
      </section>
    }
  `,
  styles: [`
    :host { position: relative; display: inline-flex; }
    .bell { position: relative; display: grid; place-items: center; width: 38px; height: 38px; color: var(--text-2); background: none; border: 1px solid transparent; border-radius: 10px; transition: background .15s, border-color .15s; }
    .bell:hover, .bell[aria-expanded='true'] { color: var(--text); background: var(--surface); border-color: var(--border); }
    .bell .icon { font-size: 22px; }
    .badge { position: absolute; top: 3px; right: 2px; min-width: 18px; height: 18px; padding: 0 5px; color: #fff; background: var(--neg); border: 2px solid var(--bg); border-radius: 99px; font-size: 10.5px; font-weight: 700; line-height: 14px; animation: pop .3s ease; }
    @keyframes pop { 0% { transform: scale(.4); } 70% { transform: scale(1.15); } 100% { transform: scale(1); } }
    .panel { position: absolute; top: calc(100% + 8px); right: -8px; z-index: 30; width: 380px; max-width: calc(100vw - 24px); background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-md); overflow: hidden; }
    header { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid var(--border); }
    header div { display: flex; align-items: center; gap: 10px; }
    .live { display: inline-flex; align-items: center; gap: 6px; color: var(--text-3); font-size: 12px; font-weight: 550; }
    .pulse { width: 7px; height: 7px; background: var(--text-4); border-radius: 50%; }
    .live.on { color: var(--pos-text); } .live.on .pulse { background: var(--pos); animation: pulse 1.8s infinite; }
    @keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(26, 154, 108, .45); } 70% { box-shadow: 0 0 0 7px rgba(26, 154, 108, 0); } 100% { box-shadow: 0 0 0 0 rgba(26, 154, 108, 0); } }
    ul { max-height: 420px; margin: 0; padding: 6px; overflow-y: auto; list-style: none; }
    li button { display: flex; gap: 10px; width: 100%; padding: 10px; background: none; border: 0; border-radius: 10px; text-align: start; }
    li button:hover { background: var(--surface-2); }
    li.unread button { background: var(--brand-50); } li.unread button:hover { background: var(--brand-100); }
    li .dot { margin-top: 6px; }
    .body { display: grid; gap: 4px; min-width: 0; }
    .title { font-size: 13.5px; } .title strong { font-weight: 600; }
    .excerpt { overflow: hidden; color: var(--text-2); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
    .meta { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .empty { display: grid; justify-items: center; gap: 8px; padding: 32px 24px; color: var(--text-3); text-align: center; font-size: 13.5px; }
    .empty .icon { color: var(--text-4); font-size: 32px; }
  `],
})
export class NotificationBellComponent {
  readonly n = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly open = signal(false);
  readonly tone = (l: Sentiment) => SENTIMENT_CLASS[l];
  readonly label = (l: Sentiment) => SENTIMENT_LABEL[l];
  readonly relative = (iso: string) => formatRelative(iso);

  toggle() {
    this.open.set(!this.open());
    if (this.open()) setTimeout(() => this.n.markAllRead(), 1500); // laisse le temps de repérer les nouveautés
  }

  openReviews(label: Sentiment) {
    this.open.set(false);
    this.router.navigate(['/reviews'], { queryParams: { label } });
  }

  @HostListener('document:click', ['$event'])
  closeOutside(e: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape() { this.open.set(false); }
}
