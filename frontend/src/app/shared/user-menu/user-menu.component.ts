import { Component, ElementRef, HostListener, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AvatarComponent } from '../avatar/avatar.component';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-user-menu',
  standalone: true,
  imports: [AvatarComponent, RouterLink],
  template: `
    @if (auth.user(); as u) {
      <button class="trigger" type="button" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="menu">
        <app-avatar [name]="u.fullName" [url]="u.avatarUrl" [admin]="u.role === 'ADMIN'" [size]="32" />
        <span class="who"><strong>{{ u.fullName }}</strong><small>{{ u.role === 'ADMIN' ? 'Administrateur' : 'Client' }}</small></span>
        <span class="icon chevron">expand_more</span>
      </button>
      @if (open()) {
        <div class="menu fade-in" role="menu">
          <div class="menu-head">
            <app-avatar [name]="u.fullName" [url]="u.avatarUrl" [admin]="u.role === 'ADMIN'" [size]="40" />
            <div><strong>{{ u.fullName }}</strong><small>{{ u.email }}</small></div>
          </div>
          <span class="role-tag"><span class="icon fill">{{ u.role === 'ADMIN' ? 'shield_person' : 'person' }}</span>{{ u.role === 'ADMIN' ? 'Administrateur' : 'Compte client' }}</span>
          <span class="sep" role="separator"></span>
          <a class="menu-item" role="menuitem" [routerLink]="profileUrl()" (click)="open.set(false)"><span class="icon">manage_accounts</span>Mon profil</a>
          <button class="menu-item danger" type="button" role="menuitem" (click)="logout()"><span class="icon">logout</span>Se déconnecter</button>
        </div>
      }
    }
  `,
  styles: [`
    :host { position: relative; display: inline-flex; }
    .trigger { display: flex; align-items: center; gap: 10px; height: 38px; padding: 0 6px 0 4px; background: none; border: 1px solid transparent; border-radius: var(--r-lg); transition: background .12s, border-color .12s; }
    .trigger:hover, .trigger[aria-expanded='true'] { background: var(--surface); border-color: var(--border); }
    .who { display: grid; text-align: start; line-height: 1.2; }
    .who strong { font-size: 13px; font-weight: 500; } .who small { color: var(--text-3); font-size: 12px; }
    .chevron { color: var(--text-4); font-size: 18px; }
    .menu { position: absolute; top: calc(100% + 8px); right: 0; z-index: 30; display: grid; gap: 2px; width: 260px; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-md); }
    .menu-head { display: flex; align-items: center; gap: 10px; min-width: 0; padding: 6px 6px 2px; }
    .menu-head div { display: grid; min-width: 0; } .menu-head strong { font-size: 14px; }
    .menu-head small { overflow: hidden; color: var(--text-3); font-size: 12.5px; text-overflow: ellipsis; white-space: nowrap; }
    .role-tag { display: inline-flex; align-items: center; gap: 6px; justify-self: start; margin: 6px 6px 4px; padding: 2px 7px; color: var(--text-2); background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-sm); font-size: 12px; font-weight: 500; }
    .role-tag .icon { font-size: 14px; color: var(--text-3); }
    .sep { height: 1px; margin: 4px -8px; background: var(--border); }
    .menu-item { display: flex; align-items: center; gap: 10px; height: 34px; padding: 0 8px; color: var(--text); background: none; border: 0; border-radius: var(--r); font-size: 13.5px; font-weight: 450; text-decoration: none; }
    .menu-item .icon { color: var(--text-3); font-size: 18px; }
    .menu-item:hover { background: var(--surface-3); }
    .menu-item.danger { color: var(--neg-text); } .menu-item.danger .icon { color: var(--neg); } .menu-item.danger:hover { background: var(--neg-soft); }
    @media (max-width: 700px) { .who { display: none; } }
  `],
})
export class UserMenuComponent {
  readonly auth = inject(AuthService);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly open = signal(false);
  readonly profileUrl = computed(() => (this.auth.user()?.role === 'ADMIN' ? '/profile' : '/espace/profil'));

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
