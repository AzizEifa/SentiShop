import { Component, ElementRef, HostListener, inject, output, signal } from '@angular/core';

export const EMOJI_GROUPS: { label: string; icon: string; emojis: string[] }[] = [
  { label: 'Émotions', icon: 'mood', emojis: ['😀', '😃', '😄', '😁', '😊', '🙂', '😍', '🤩', '😎', '🥳', '😌', '😅', '🤔', '😐', '😕', '🙁', '😞', '😢', '😭', '😤', '😠', '😡', '🤬', '😱', '🥺', '😴', '🤢', '🤯'] },
  { label: 'Gestes', icon: 'thumb_up', emojis: ['👍', '👎', '👏', '🙌', '👌', '🤝', '🙏', '💪', '✌️', '🤞', '👋', '☝️'] },
  { label: 'Symboles', icon: 'favorite', emojis: ['❤️', '💚', '💙', '💔', '⭐', '🌟', '✨', '🔥', '💯', '✅', '❌', '⚠️', '💡', '🎉', '🏆', '💸'] },
  { label: 'Achats', icon: 'shopping_bag', emojis: ['📦', '🚚', '🛒', '🛍️', '🎁', '💳', '🏷️', '📱', '💻', '🎧', '⌚', '👟', '👕', '🧴', '☕', '🍫'] },
];

/** Bouton « émoji » : ouvre une palette et émet l'émoji choisi (inséré au curseur par le parent). */
@Component({
  selector: 'app-emoji-picker',
  standalone: true,
  template: `
    <button class="trigger" type="button" (click)="open.set(!open())" [attr.aria-expanded]="open()" aria-haspopup="dialog" title="Ajouter un émoji">
      <span class="icon">add_reaction</span>
    </button>
    @if (open()) {
      <div class="palette fade-in" role="dialog" aria-label="Choisir un émoji">
        <div class="tabs" role="tablist">
          @for (g of groups; track g.label; let i = $index) {
            <button type="button" role="tab" [class.active]="tab() === i" [attr.aria-selected]="tab() === i" [title]="g.label" (click)="tab.set(i)"><span class="icon">{{ g.icon }}</span></button>
          }
        </div>
        <div class="grid">
          @for (e of groups[tab()].emojis; track e) {
            <button type="button" class="emoji" (click)="choose(e)" [attr.aria-label]="'Insérer ' + e">{{ e }}</button>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    :host { position: relative; display: inline-flex; }
    .trigger { display: grid; place-items: center; width: 34px; height: 34px; color: var(--text-3); background: none; border: 0; border-radius: 8px; }
    .trigger:hover, .trigger[aria-expanded='true'] { color: var(--text); background: var(--surface-3); }
    .palette { position: absolute; bottom: calc(100% + 6px); left: 0; z-index: 40; width: 300px; padding: 8px; background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-md); }
    .tabs { display: flex; gap: 2px; padding-bottom: 6px; border-bottom: 1px solid var(--border); }
    .tabs button { display: grid; place-items: center; width: 34px; height: 30px; color: var(--text-3); background: none; border: 0; border-radius: 7px; }
    .tabs button.active { color: var(--text); background: var(--surface-3); }
    .tabs .icon { font-size: 18px; }
    .grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 2px; max-height: 190px; padding-top: 6px; overflow-y: auto; }
    .emoji { display: grid; place-items: center; height: 32px; padding: 0; background: none; border: 0; border-radius: 7px; font-size: 20px; transition: transform .1s, background .1s; }
    .emoji:hover { background: var(--surface-2); transform: scale(1.15); }
  `],
})
export class EmojiPickerComponent {
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly picked = output<string>();
  readonly open = signal(false);
  readonly tab = signal(0);
  readonly groups = EMOJI_GROUPS;

  choose(emoji: string) {
    this.picked.emit(emoji);
  }

  @HostListener('document:click', ['$event'])
  closeOutside(e: MouseEvent) {
    if (this.open() && !this.host.nativeElement.contains(e.target as Node)) this.open.set(false);
  }

  @HostListener('document:keydown.escape')
  closeOnEscape() { this.open.set(false); }
}
