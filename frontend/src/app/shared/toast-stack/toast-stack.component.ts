import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationService } from '../../core/notifications/notification.service';
import { SENTIMENT_CLASS, SENTIMENT_LABEL } from '../../core/format';
import { ReviewEvent } from '../../core/models/models';
import { StarsComponent } from '../stars/stars.component';

/** Alertes éphémères (coin inférieur droit) à l'arrivée d'un nouvel avis client. */
@Component({
  selector: 'app-toast-stack',
  standalone: true,
  imports: [StarsComponent],
  template: `
    <div class="stack" aria-live="polite" aria-atomic="false">
      @for (t of n.toasts(); track t.key) {
        <article class="toast" [class]="'toast ' + tone(t.event)" role="status">
          <span class="toast-icon"><span class="icon fill">rate_review</span></span>
          <div class="content">
            <div class="head">
              <strong>Nouvel avis {{ label(t.event).toLowerCase() }}</strong>
              @if (t.event.rating) { <app-stars [value]="t.event.rating" /> }
            </div>
            <p class="who">{{ t.event.authorName ?? 'Un client' }} · {{ t.event.product }}</p>
            <p class="excerpt" dir="auto">« {{ t.event.text }} »</p>
            <button class="link-btn" type="button" (click)="view(t.key, t.event)">Voir l’avis<span class="icon">arrow_forward</span></button>
          </div>
          <button class="close" type="button" aria-label="Fermer" (click)="n.dismiss(t.key)"><span class="icon">close</span></button>
          <span class="timer"></span>
        </article>
      }
    </div>
  `,
  styles: [`
    .stack { position: fixed; right: 20px; bottom: 20px; z-index: 50; display: grid; gap: 10px; width: 360px; max-width: calc(100vw - 32px); pointer-events: none; }
    .toast { position: relative; display: flex; gap: 12px; padding: 14px 14px 16px; overflow: hidden; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-md); pointer-events: auto; animation: slide-in .35s cubic-bezier(.2, .9, .3, 1.2) both; }
    @keyframes slide-in { from { opacity: 0; transform: translateX(24px) scale(.98); } to { opacity: 1; transform: none; } }
    .toast-icon { display: grid; place-items: center; width: 36px; height: 36px; flex: 0 0 auto; border-radius: 10px; color: var(--neu-text); background: var(--neu-soft); }
    .pos .toast-icon { color: var(--pos); background: var(--pos-soft); } .neg .toast-icon { color: var(--neg); background: var(--neg-soft); }
    .toast-icon .icon { font-size: 20px; }
    .content { display: grid; gap: 3px; min-width: 0; flex: 1; }
    .head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .head strong { font-size: 14px; }
    .who { color: var(--text-3); font-size: 12.5px; }
    .excerpt { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--text-2); font-size: 13px; }
    .content .link-btn { justify-self: start; margin-top: 4px; }
    .close { align-self: flex-start; display: grid; place-items: center; width: 26px; height: 26px; color: var(--text-4); background: none; border: 0; border-radius: 6px; }
    .close:hover { color: var(--text); background: var(--surface-2); } .close .icon { font-size: 18px; }
    .timer { position: absolute; left: 0; bottom: 0; height: 3px; width: 100%; background: var(--neu); transform-origin: left; animation: countdown 7s linear forwards; }
    .pos .timer { background: var(--pos); } .neg .timer { background: var(--neg); }
    @keyframes countdown { to { transform: scaleX(0); } }
  `],
})
export class ToastStackComponent {
  readonly n = inject(NotificationService);
  private readonly router = inject(Router);
  readonly tone = (e: ReviewEvent) => SENTIMENT_CLASS[e.label];
  readonly label = (e: ReviewEvent) => SENTIMENT_LABEL[e.label];

  view(key: number, e: ReviewEvent) {
    this.n.dismiss(key);
    this.router.navigate(['/reviews'], { queryParams: { label: e.label } });
  }
}
