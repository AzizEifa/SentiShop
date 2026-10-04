import { Component, computed, input } from '@angular/core';
import { initials } from '../../core/format';

/** Photo de profil, ou initiales sur fond coloré à défaut. */
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    @if (url()) { <img [src]="url()" [alt]="name()" [style.width.px]="size()" [style.height.px]="size()" /> }
    @else { <span class="initials" [class.admin]="admin()" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * .38">{{ text() }}</span> }
  `,
  styles: [`
    :host { display: inline-flex; flex: 0 0 auto; }
    img, .initials { border-radius: 50%; }
    img { object-fit: cover; background: var(--neu-soft); }
    .initials { display: grid; place-items: center; color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); font-weight: 650; letter-spacing: .02em; }
    .initials.admin { background: linear-gradient(135deg, var(--brand), #1aa37a); }
  `],
})
export class AvatarComponent {
  readonly name = input<string | null | undefined>('');
  readonly url = input<string | null | undefined>(null);
  readonly size = input(32);
  readonly admin = input(false);
  readonly text = computed(() => initials(this.name()));
}
