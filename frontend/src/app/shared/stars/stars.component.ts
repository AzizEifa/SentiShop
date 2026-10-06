import { Component, computed, input, model, signal } from '@angular/core';
import { RATING_LABEL } from '../../core/format';

/**
 * Note en étoiles. Lecture seule par défaut ; en saisie (`editable`), utilisable à la souris
 * et au clavier (flèches gauche / droite), avec l'intitulé de la note affiché au survol.
 */
@Component({
  selector: 'app-stars',
  standalone: true,
  template: `
    @if (editable()) {
      <div class="stars editable" [class]="'stars editable ' + size()" role="radiogroup" aria-label="Note sur 5 étoiles"
           (mouseleave)="hover.set(0)" (keydown)="onKey($event)">
        @for (n of five; track n) {
          <button type="button" role="radio" [attr.aria-checked]="value() === n" [attr.aria-label]="n + ' étoile' + (n > 1 ? 's' : '') + ' : ' + labels[n]"
                  [attr.tabindex]="(value() || 1) === n ? 0 : -1" [class.on]="n <= shown()" (mouseenter)="hover.set(n)" (click)="value.set(n)">
            <span class="icon fill">star</span>
          </button>
        }
        @if (showLabel()) { <span class="label" [class.muted]="!shown()">{{ shown() ? labels[shown()] : 'Choisissez une note' }}</span> }
      </div>
    } @else {
      <span class="stars" [class]="'stars ' + size()" role="img" [attr.aria-label]="value() + ' sur 5 étoiles'">
        @for (n of five; track n) { <span class="icon fill" [class.on]="n <= value()">star</span> }
      </span>
    }
  `,
  styles: [`
    :host { display: inline-flex; }
    .stars { display: inline-flex; align-items: center; gap: 1px; }
    .icon { color: #e4e4e7; font-size: 15px; }
    .icon.on, .on .icon { color: var(--star); }
    .md .icon { font-size: 20px; }
    .lg .icon { font-size: 28px; }
    .editable button { display: grid; place-items: center; padding: 2px; background: none; border: 0; border-radius: var(--r-sm); transition: transform .12s; }
    .editable button:hover { transform: scale(1.06); }
    .editable button:focus-visible { box-shadow: var(--focus); }
    .label { margin-left: 10px; color: var(--text-2); font-size: 13.5px; font-weight: 500; }
    .label.muted { color: var(--text-4); font-weight: 400; }
  `],
})
export class StarsComponent {
  readonly value = model(0);
  readonly editable = input(false);
  readonly showLabel = input(true);
  readonly size = input<'sm' | 'md' | 'lg'>('sm');
  readonly hover = signal(0);
  readonly shown = computed(() => this.hover() || this.value());
  readonly five = [1, 2, 3, 4, 5];
  readonly labels = RATING_LABEL;

  onKey(e: KeyboardEvent) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = Math.min(5, Math.max(1, (this.value() || 0) + delta));
    this.value.set(next);
    const buttons = (e.currentTarget as HTMLElement).querySelectorAll('button');
    buttons[next - 1]?.focus();
  }
}
