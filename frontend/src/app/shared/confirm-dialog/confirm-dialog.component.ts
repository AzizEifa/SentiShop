import { Component, ElementRef, Injectable, effect, inject, signal, viewChild } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  icon?: string;
}

interface Pending extends ConfirmOptions { resolve: (ok: boolean) => void; }

/** Demande de confirmation (suppression…) : `await confirm.ask({...})` renvoie true / false. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<Pending | null>(null);

  ask(options: ConfirmOptions): Promise<boolean> {
    this.pending()?.resolve(false);
    return new Promise((resolve) => this.pending.set({ ...options, resolve }));
  }

  close(ok: boolean) {
    const p = this.pending();
    this.pending.set(null);
    p?.resolve(ok);
  }
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (confirm.pending(); as p) {
      <div class="backdrop" (click)="confirm.close(false)"></div>
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" (keydown.escape)="confirm.close(false)">
        <span class="dialog-icon" [class.danger]="(p.tone ?? 'danger') === 'danger'"><span class="icon fill">{{ p.icon ?? 'delete' }}</span></span>
        <h2 id="confirm-title">{{ p.title }}</h2>
        <p id="confirm-message">{{ p.message }}</p>
        <div class="actions">
          <button class="btn btn-secondary" type="button" (click)="confirm.close(false)">{{ p.cancelLabel ?? 'Annuler' }}</button>
          <button #confirmBtn class="btn" [class.btn-danger]="(p.tone ?? 'danger') === 'danger'" [class.btn-primary]="p.tone === 'primary'" type="button" (click)="confirm.close(true)">{{ p.confirmLabel ?? 'Supprimer' }}</button>
        </div>
      </div>
    }
  `,
  styles: [`
    .backdrop { position: fixed; inset: 0; z-index: 90; background: rgba(17, 17, 19, .4); animation: fade .15s ease; }
    .dialog { position: fixed; top: 50%; left: 50%; z-index: 91; display: grid; justify-items: center; gap: 8px; width: min(420px, calc(100vw - 32px)); padding: 28px 24px 22px; text-align: center; background: var(--surface); border: 1px solid var(--border); border-radius: 12px; box-shadow: 0 24px 48px -12px rgba(17, 17, 19, .25); transform: translate(-50%, -50%); animation: pop .2s cubic-bezier(.2, .9, .3, 1.2); }
    .dialog-icon { display: grid; place-items: center; width: 40px; height: 40px; margin-bottom: 6px; color: var(--text-2); background: var(--surface-3); border: 1px solid var(--border); border-radius: 50%; }
    .dialog-icon.danger { color: var(--neg-text); background: var(--neg-soft); border-color: #fecdd6; }
    .dialog-icon .icon { font-size: 20px; }
    h2 { font-size: 18px; }
    p { color: var(--text-2); }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; width: 100%; margin-top: 14px; }
    @keyframes fade { from { opacity: 0; } }
    @keyframes pop { from { opacity: 0; transform: translate(-50%, -46%) scale(.97); } }
  `],
})
export class ConfirmDialogComponent {
  readonly confirm = inject(ConfirmService);
  private readonly confirmBtn = viewChild<ElementRef<HTMLButtonElement>>('confirmBtn');

  constructor() {
    // focus sur le bouton principal à l'ouverture (Entrée confirme, Échap annule)
    effect(() => { if (this.confirm.pending()) setTimeout(() => this.confirmBtn()?.nativeElement.focus()); });
  }
}
