import { Component, HostListener, Injectable, inject, signal } from '@angular/core';

/** Visionneuse plein écran des photos (avis, produits). */
@Injectable({ providedIn: 'root' })
export class LightboxService {
  readonly images = signal<string[]>([]);
  readonly index = signal(0);

  open(images: string[], index = 0) {
    if (!images.length) return;
    this.images.set(images);
    this.index.set(index);
  }

  close() { this.images.set([]); }

  move(delta: number) {
    const n = this.images().length;
    if (n) this.index.set((this.index() + delta + n) % n);
  }
}

@Component({
  selector: 'app-lightbox',
  standalone: true,
  template: `
    @if (box.images().length) {
      <div class="lightbox" role="dialog" aria-modal="true" aria-label="Photo agrandie" (click)="box.close()">
        <img [src]="box.images()[box.index()]" alt="Photo agrandie" (click)="$event.stopPropagation()" />
        <button class="close" type="button" aria-label="Fermer" (click)="box.close()"><span class="icon">close</span></button>
        @if (box.images().length > 1) {
          <button class="nav prev" type="button" aria-label="Photo précédente" (click)="$event.stopPropagation(); box.move(-1)"><span class="icon">chevron_left</span></button>
          <button class="nav next" type="button" aria-label="Photo suivante" (click)="$event.stopPropagation(); box.move(1)"><span class="icon">chevron_right</span></button>
          <span class="counter tabular">{{ box.index() + 1 }} / {{ box.images().length }}</span>
        }
      </div>
    }
  `,
  styles: [`
    .lightbox { position: fixed; inset: 0; z-index: 95; display: grid; place-items: center; padding: 48px; background: rgba(10, 14, 20, .88); animation: fade .15s ease; }
    img { max-width: 100%; max-height: 100%; border-radius: 10px; box-shadow: 0 24px 64px rgba(0,0,0,.5); object-fit: contain; }
    button { position: absolute; display: grid; place-items: center; width: 44px; height: 44px; color: #fff; background: rgba(255,255,255,.12); border: 0; border-radius: 50%; }
    button:hover { background: rgba(255,255,255,.22); }
    .close { top: 16px; right: 16px; } .prev { left: 16px; } .next { right: 16px; }
    .counter { position: absolute; bottom: 18px; color: #e5e7eb; font-size: 13px; }
    @keyframes fade { from { opacity: 0; } }
  `],
})
export class LightboxComponent {
  readonly box = inject(LightboxService);

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (!this.box.images().length) return;
    if (e.key === 'Escape') this.box.close();
    if (e.key === 'ArrowLeft') this.box.move(-1);
    if (e.key === 'ArrowRight') this.box.move(1);
  }
}
