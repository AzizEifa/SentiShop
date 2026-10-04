import { Component } from '@angular/core';

/** Cadre des pages connexion / inscription : panneau de marque à gauche, formulaire à droite. */
@Component({
  selector: 'app-auth-shell',
  standalone: true,
  template: `
    <div class="auth">
      <aside class="showcase" aria-hidden="true">
        <div class="brand"><span class="brand-mark"><span class="icon fill">insights</span></span>SentiShop</div>
        <div class="pitch">
          <h2>Comprenez ce que vos clients ressentent.</h2>
          <p>Chaque avis est analysé par l’IA en français, en anglais et en arabe, puis réuni dans un tableau de bord clair.</p>
          <ul>
            <li><span class="icon">translate</span>Analyse multilingue FR · EN · AR</li>
            <li><span class="icon">notifications_active</span>Alertes en temps réel à chaque nouvel avis</li>
            <li><span class="icon">verified_user</span>Espaces séparés clients et administrateurs</li>
          </ul>
        </div>
        <div class="preview">
          <div class="preview-head"><span class="avatar">SB</span><div><strong>Sara B.</strong><small>Casque Bluetooth</small></div><span class="stars">★★★★★</span></div>
          <p>« Son excellent, livraison rapide : je recommande ! »</p>
          <div class="preview-foot"><span class="pill"><span class="icon fill">sentiment_satisfied</span>Positif</span><span>97 % de confiance</span></div>
        </div>
      </aside>
      <main class="panel">
        <div class="form-wrap"><ng-content /></div>
      </main>
    </div>
  `,
  styles: [`
    .auth { display: grid; grid-template-columns: minmax(380px, 1fr) minmax(0, 1.1fr); min-height: 100vh; background: var(--surface); }
    .showcase {
      position: relative; display: flex; flex-direction: column; justify-content: space-between; gap: 32px; padding: 40px 48px; overflow: hidden; color: #e8f5ef;
      background: radial-gradient(1200px 500px at -10% 110%, #1aa37a55, transparent 60%), radial-gradient(800px 400px at 120% -10%, #34d39933, transparent 60%), linear-gradient(160deg, #0b3a2c, #0f5c46 55%, #12785c);
    }
    .showcase::after { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,.07) 1px, transparent 1px); background-size: 22px 22px; pointer-events: none; }
    .brand { position: relative; z-index: 1; display: flex; align-items: center; gap: 10px; color: #fff; font-size: 18px; font-weight: 700; letter-spacing: -.02em; }
    .brand-mark { display: grid; place-items: center; width: 36px; height: 36px; background: rgba(255,255,255,.14); border: 1px solid rgba(255,255,255,.2); border-radius: 10px; }
    .pitch { position: relative; z-index: 1; max-width: 440px; }
    .pitch h2 { color: #fff; font-size: 32px; line-height: 1.2; font-weight: 700; letter-spacing: -.03em; }
    .pitch p { margin-top: 14px; color: #bfe3d3; font-size: 15px; line-height: 1.6; }
    .pitch ul { display: grid; gap: 12px; margin: 28px 0 0; padding: 0; list-style: none; }
    .pitch li { display: flex; align-items: center; gap: 12px; color: #e3f4ec; font-size: 14.5px; }
    .pitch li .icon { display: grid; place-items: center; width: 32px; height: 32px; color: #fff; background: rgba(255,255,255,.1); border-radius: 9px; font-size: 18px; }
    .preview { position: relative; z-index: 1; max-width: 400px; padding: 18px; color: var(--text); background: rgba(255,255,255,.96); border-radius: 16px; box-shadow: 0 24px 48px -12px rgba(0,0,0,.35); transform: rotate(-1.5deg); }
    .preview-head { display: flex; align-items: center; gap: 10px; }
    .preview-head div { display: grid; line-height: 1.25; } .preview-head strong { font-size: 13.5px; } .preview-head small { color: var(--text-3); font-size: 12px; }
    .avatar { display: grid; place-items: center; width: 34px; height: 34px; color: #fff; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; font-size: 12px; font-weight: 650; }
    .stars { margin-left: auto; color: #f5a524; letter-spacing: 1px; }
    .preview p { margin: 12px 0; color: var(--text-2); font-size: 14px; }
    .preview-foot { display: flex; align-items: center; justify-content: space-between; color: var(--text-3); font-size: 12.5px; }
    .pill { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px 3px 6px; color: var(--pos-text); background: var(--pos-soft); border-radius: 99px; font-weight: 600; }
    .pill .icon { font-size: 16px; }
    .panel { display: grid; place-items: center; padding: 40px 24px; }
    .form-wrap { width: min(100%, 420px); }
    @media (max-width: 960px) { .auth { grid-template-columns: 1fr; } .showcase { display: none; } .panel { align-items: start; padding-top: 56px; } }
  `],
})
export class AuthShellComponent {}
