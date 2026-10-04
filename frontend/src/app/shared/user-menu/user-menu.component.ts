import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { initials } from '../../core/format';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  template: `
    @if (auth.user(); as u) {
      <button class="trigger" type="button" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="menu">
        <span class="avatar" [class.admin]="u.role === 'ADMIN'">{{ initialsOf() }}</span>
        <span class="who"><strong>{{ u.fullName }}</strong><small>{{ u.role === 'ADMIN' ? 'Administrateur' : 'Client' }}</small></span>
        <span class="icon chevron">expand_more</span>
      </button>
      @if (open()) {
        <div class="menu fade-in" role="menu">
          <div class="menu-head">
            <span class="avatar lg" [class.admin]="u.role === 'ADMIN'">{{ initialsOf() }}</span>
            <div><strong>{{ u.fullName }}</strong><small>{{ u.email }}</small></div>
          </div>
          <span class="role-tag" [class.admin]="u.role === 'ADMIN'"><span class="icon fill">{{ u.role === 'ADMIN' ? 'shield_person' : 'person' }}</span>{{ u.role === 'ADMIN' ? 'Administrateur' : 'Compte client' }}</span>
          <button class="menu-item danger" type="button" role="menuitem" (click)="logout()"><span class="icon">logout</span>Se déconnecter</button>
        </div>
      }
    }
  `,
  styles: [`
    :host { position: relative; display: inline-flex; }
    .trigger { display: flex; align-items: center; gap: 10px; height: 40px; padding: 0 8px 0 4px; background: none; border: 1px solid transparent; border-radius: 10px; transition: background .15s, border-color .15s; }
    .trigger:hover, .trigger[aria-expanded='true'] { background: var(--surface); border-color: var(--border); }
    .avatar { display: grid; place-items: center; width: 32px; height: 32px; flex: 0 0 auto; color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; font-size: 12.5px; font-weight: 650; letter-spacing: .02em; }
    .avatar.admin { background: linear-gradient(135deg, var(--brand), #1aa37a); }
    .avatar.lg { width: 40px; height: 40px; font-size: 14px; }
    .who { display: grid; text-align: start; line-height: 1.2; }
    .who strong { font-size: 13.5px; font-weight: 600; } .who small { color: var(--text-3); font-size: 12px; }
    .chevron { color: var(--text-4); font-size: 18px; }
    .menu { position: absolute; top: calc(100% + 8px); right: 0; z-index: 30; display: grid; gap: 10px; width: 270px; padding: 14px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-md); }
    .menu-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .menu-head div { display: grid; min-width: 0; } .menu-head strong { font-size: 14px; }
    .menu-head small { overflow: hidden; color: var(--text-3); font-size: 12.5px; text-overflow: ellipsis; white-space: nowrap; }
    .role-tag { display: inline-flex; align-items: center; gap: 6px; justify-self: start; padding: 4px 10px; color: #4f46e5; background: #eef2ff; border-radius: 99px; font-size: 12px; font-weight: 600; }
    .role-tag.admin { color: var(--brand-600); background: var(--brand-50); } .role-tag .icon { font-size: 16px; }
    .menu-item { display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 10px; background: none; border: 0; border-top: 1px solid var(--border); border-radius: 0; font-size: 14px; font-weight: 550; }
    .menu-item.danger { color: var(--neg-text); } .menu-item:hover { background: var(--neg-soft); border-radius: 8px; }
    @media (max-width: 700px) { .who { display: none; } }
  `],
})
export class UserMenuComponent {
  readonly auth = inject(AuthService);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly open = signal(false);
  readonly initialsOf = computed(() => initials(this.auth.user()?.fullName));

  @HostListener('document:click', ['$event'])
  closeOutside(e: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape() { this.open.set(false); }

  logout() {
    this.open.set(false);
    this.auth.logout();
  }
}
