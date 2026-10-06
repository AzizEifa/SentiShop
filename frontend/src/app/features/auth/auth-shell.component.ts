import { Component } from '@angular/core';

/** Cadre des pages connexion / inscription : panneau de marque à gauche, formulaire à droite. */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  template: `
    <div class="auth">
      <aside class="showcase" aria-hidden="true">
        <div class="brand"><span class="brand-mark">S</span><span><strong>SentiShop</strong><small>Intelligence</small></span></div>
        <div class="pitch">
          <h2>Comprenez vos avis clients grâce à l’analyse multilingue.</h2>
          <p>Chaque avis, en français, en anglais ou en arabe, est classé par l’IA (positif, neutre ou négatif) puis réuni dans un tableau de bord qui montre où agir en priorité.</p>
          <div class="preview">
            <div class="preview-row"><span class="dot pos"></span><span dir="auto">Livraison rapide, je recommande !</span><b class="pos">Positif</b></div>
            <div class="preview-row"><span class="dot neg"></span><span dir="auto">The strap broke after one week.</span><b class="neg">Négatif</b></div>
            <div class="preview-row"><span class="dot neu"></span><span dir="auto">المنتج عادي، لا بأس به</span><b class="neu">Neutre</b></div>
          </div>
        </div>
        <dl class="facts">
          <div><dt>3 langues</dt><dd>Un seul modèle multilingue (XLM-RoBERTa).</dd></div>
          <div><dt>Temps réel</dt><dd>Chaque nouvel avis met le tableau de bord à jour.</dd></div>
          <div><dt>2 espaces</dt><dd>Clients et administrateurs, chacun ses droits.</dd></div>
        </dl>
      </aside>
      <main class="panel">
        <div class="form-wrap"><ng-content /></div>
      </main>
    </div>
  `,
  styles: [`
    .auth { display: grid; grid-template-columns: minmax(400px, .95fr) minmax(0, 1.05fr); min-height: 100vh; background: var(--surface); }
    .showcase {
      position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 40px; padding: 36px 48px 44px; overflow: hidden;
      color: #b4c2d8; background: var(--navy);
    }
    .showcase::before {
      content: ''; position: absolute; inset: 0; pointer-events: none;
      background-image: linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
      background-size: 48px 48px; mask-image: linear-gradient(to bottom, #000, transparent 80%);
    }
    .brand { position: relative; display: flex; align-items: center; gap: 11px; color: #fff; }
    .brand span:last-child { display: grid; line-height: 1.15; }
    .brand strong { font-size: 16px; font-weight: 650; letter-spacing: -.015em; }
    .brand small { color: #7d90ad; font-size: 11.5px; font-weight: 550; letter-spacing: .06em; text-transform: uppercase; }
    .pitch { position: relative; max-width: 480px; }
    .pitch h2 { color: #fff; font-size: 32px; line-height: 1.18; font-weight: 650; letter-spacing: -.03em; }
    .pitch p { margin-top: 16px; font-size: 15px; line-height: 1.6; }
    .preview { display: grid; gap: 8px; margin-top: 28px; padding: 14px; background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.08); border-radius: var(--r-lg); }
    .preview-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px; padding: 9px 12px; color: #e6edf7; background: rgba(255,255,255,.04); border-radius: var(--r); font-size: 13.5px; unicode-bidi: plaintext; }
    .preview-row b { font-size: 12px; font-weight: 650; } .preview-row b.pos { color: #6fe0b7; } .preview-row b.neg { color: #ff9b9b; } .preview-row b.neu { color: #f5c67a; }
    .facts { position: relative; display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; margin: 0; padding-top: 24px; border-top: 1px solid rgba(255,255,255,.1); }
    .facts dt { color: #fff; font-size: 14px; font-weight: 600; }
    .facts dd { margin: 4px 0 0; font-size: 12.5px; line-height: 1.5; }
    .panel { display: grid; place-items: center; padding: 40px 24px; }
    .form-wrap { width: min(100%, 400px); }
    @media (max-width: 960px) { .auth { grid-template-columns: 1fr; } .showcase { display: none; } .panel { align-items: start; padding-top: 48px; } }
  `],
})
export class AuthShellComponent {}
