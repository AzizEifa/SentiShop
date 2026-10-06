import { Component, computed, input } from '@angular/core';
import { initials } from '../../core/format';

/** Teintes sobres pour les initiales ; une personne garde toujours la même. */
const TONES = [
  ['#e0e7ff', '#3730a3'], ['#dcfce7', '#166534'], ['#fef3c7', '#92400e'],
  ['#fce7f3', '#9d174d'], ['#e0f2fe', '#075985'], ['#f4f4f5', '#3f3f46'],
];

/** Photo de profil, ou initiales sur fond coloré à défaut. */
@Component({
  selector: 'app-avatar',
  standalone: true,
  template: `
    @if (url()) { <img [src]="url()" [alt]="name()" [style.width.px]="size()" [style.height.px]="size()" /> }
    @else {
      <span class="initials" [class.admin]="admin()" [style.width.px]="size()" [style.height.px]="size()" [style.font-size.px]="size() * .38"
            [style.background]="admin() ? null : tone()[0]" [style.color]="admin() ? null : tone()[1]">{{ text() }}</span>
    }
  `,
  styles: [`
    :host { display: inline-flex; flex: 0 0 auto; }
    img, .initials { border-radius: 50%; }
    img { object-fit: cover; background: var(--surface-3); box-shadow: 0 0 0 1px rgba(17, 17, 19, .06); }
    .initials { display: grid; place-items: center; font-weight: 600; letter-spacing: .01em; }
    .initials.admin { color: #fff; background: var(--primary); }
  `],
})
export class AvatarComponent {
  readonly name = input<string | null | undefined>('');
  readonly url = input<string | null | undefined>(null);
  readonly size = input(32);
  readonly admin = input(false);
  readonly text = computed(() => initials(this.name()));
  readonly tone = computed(() => {
    const n = this.name() ?? '';
    let h = 0;
    for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return TONES[h % TONES.length];
  });
}
