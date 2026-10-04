import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { ReviewApi } from '../../../core/api/review-api.service';
import { CsvRow, MAX_ROWS, ParsedCsv, chunk, parseReviewsCsv, toBackendCsv } from '../../../core/csv/csv-normalizer';
import { ImportReport } from '../../../core/models/models';
import { formatNumber } from '../../../core/format';

/** Taille max acceptée par le backend (spring.servlet.multipart.max-file-size). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Lignes envoyées par requête : permet une vraie barre de progression. */
export const CHUNK_SIZE = 50;
const PREVIEW_ROWS = 5;

const SEPARATORS: Record<string, string> = { ',': 'virgule', ';': 'point-virgule', '\t': 'tabulation' };

@Component({
  selector: 'app-import-page',
  standalone: true,
  imports: [RouterLink, MatProgressBarModule],
  template: `
    <header class="page-header">
      <div>
        <h1>Importer des avis</h1>
        <p class="subtitle">Analysez d’un coup tous les avis d’un fichier CSV (jusqu’à {{ fmt(maxRows) }} avis).</p>
      </div>
      <div class="page-actions">
        <a class="btn btn-secondary" href="modele-avis.csv" download="modele-avis.csv"><span class="icon">description</span>Télécharger le modèle</a>
      </div>
    </header>

    <ol class="stepper" aria-label="Étapes de l'import">
      @for (s of steps; track s.n) {
        <li [class.active]="step() === s.n" [class.done]="step() > s.n">
          <span class="step-dot">@if (step() > s.n) { <span class="icon">check</span> } @else { {{ s.n }} }</span>
          <span class="step-label">{{ s.label }}</span>
        </li>
      }
    </ol>

    @switch (step()) {
      <!-- Étape 1 : choisir le fichier -->
      @case (1) {
        <section class="card fade-in">
          <div class="card-body">
            <label class="dropzone" for="file" [class.dragging]="dragging()"
                   (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
              <span class="drop-icon"><span class="icon">upload_file</span></span>
              <strong>Glissez votre fichier CSV ici</strong>
              <span class="muted">ou <span class="link-btn">parcourez vos fichiers</span> · 5 Mo maximum</span>
              <input id="file" type="file" accept=".csv,text/csv" (change)="onFileInput($event)" />
            </label>
            @if (parseError()) { <div class="alert alert-danger fade-in"><span class="icon">error</span><div><strong>{{ file()?.name }}</strong> — {{ parseError() }}</div></div> }
            <div class="format-help">
              <div>
                <h3>Format attendu</h3>
                <p class="muted">Une colonne pour le texte de l’avis, une colonne (facultative) pour le produit.</p>
              </div>
              <ul>
                <li><span class="icon">check_circle</span>En-têtes <code>text</code>/<code>texte</code>/<code>avis</code> et <code>product</code>/<code>produit</code></li>
                <li><span class="icon">check_circle</span>Séparateur virgule ou point-virgule (export Excel)</li>
                <li><span class="icon">check_circle</span>Français, anglais et arabe (UTF-8)</li>
              </ul>
            </div>
          </div>
        </section>
      }

      <!-- Étape 2 : vérifier avant d'envoyer -->
      @case (2) {
        @if (parsed(); as p) {
          <section class="card fade-in">
            <div class="card-header">
              <div class="file-info">
                <span class="file-icon"><span class="icon">draft</span></span>
                <div><h2>{{ file()?.name }}</h2><p class="card-subtitle">{{ formatSize(file()?.size ?? 0) }} · séparateur {{ separator(p.delimiter) }} · {{ p.hasHeader ? 'en-têtes reconnus' : 'sans en-tête (1re colonne = texte)' }}</p></div>
              </div>
              <button class="btn btn-ghost btn-sm" type="button" (click)="selectFile(null)"><span class="icon">swap_horiz</span>Changer de fichier</button>
            </div>
            <div class="card-body stack">
              <div class="alert alert-success"><span class="icon">fact_check</span><div><strong>{{ fmt(p.rows.length) }} avis prêts à être analysés.</strong> Les avis déjà connus seront servis par le cache, sans consommer de crédit.</div></div>
              @for (w of p.warnings; track $index) { <div class="alert alert-warning"><span class="icon">warning</span><div>{{ w }}</div></div> }
              <div>
                <h3 class="preview-title">Aperçu des {{ previewRows().length }} premières lignes</h3>
                <div class="table-wrap preview">
                  <table class="table">
                    <thead><tr><th class="line-col">Ligne</th><th>Avis</th><th>Produit</th></tr></thead>
                    <tbody>
                      @for (r of previewRows(); track r.line) {
                        <tr><td class="muted tabular line-col">{{ r.line }}</td><td><p class="review-text" dir="auto">{{ r.text }}</p></td><td>@if (r.product) { <span class="tag">{{ r.product }}</span> } @else { <span class="muted">—</span> }</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <div class="card-footer footer-actions">
              <button class="btn btn-secondary" type="button" (click)="selectFile(null)">Annuler</button>
              <button class="btn btn-primary" type="button" (click)="upload()"><span class="icon">auto_awesome</span>Analyser {{ fmt(p.rows.length) }} avis</button>
            </div>
          </section>
        }
      }

      <!-- Étape 3 : analyse en cours, puis bilan -->
      @default {
        @if (report(); as r) {
          <section class="card fade-in">
            <div class="card-body stack">
              <div class="run-head">
                <span class="run-icon" [class.done]="!loading()" [class.warn]="!loading() && r.errors.length > 0">
                  <span class="icon fill">{{ loading() ? 'progress_activity' : r.errors.length ? 'error' : 'check_circle' }}</span>
                </span>
                <div class="run-text">
                  <h2>{{ loading() ? 'Analyse en cours…' : r.errors.length ? 'Import terminé avec des erreurs' : 'Import terminé' }}</h2>
                  <p class="muted">{{ loading() ? 'Vous pouvez suivre la progression ci-dessous.' : fmt(r.analyzed) + ' avis analysés sur ' + fmt(r.total) + ' lignes.' }}</p>
                </div>
                <strong class="run-pct tabular">{{ progress() }}%</strong>
              </div>
              <mat-progress-bar mode="determinate" [value]="progress()" />
              <div class="tiles">
                <div class="tile"><span class="muted">Avis analysés</span><strong class="tabular">{{ fmt(r.analyzed) }}</strong></div>
                <div class="tile"><span class="muted">Depuis le cache</span><strong class="tabular">{{ fmt(r.cacheHits) }}</strong></div>
                <div class="tile"><span class="muted">Appels à l’IA</span><strong class="tabular">{{ fmt(r.analyzed - r.cacheHits) }}</strong></div>
                <div class="tile" [class.has-errors]="r.errors.length"><span class="muted">Erreurs</span><strong class="tabular">{{ fmt(r.errors.length) }}</strong></div>
              </div>
              @if (r.errors.length) {
                <details class="errors">
                  <summary>Voir le détail des {{ r.errors.length }} erreur(s)</summary>
                  <ul>@for (e of r.errors; track $index) { <li>{{ e }}</li> }</ul>
                </details>
              }
            </div>
            @if (!loading()) {
              <div class="card-footer footer-actions">
                <button class="btn btn-secondary" type="button" (click)="selectFile(null)"><span class="icon">upload_file</span>Importer un autre fichier</button>
                <a class="btn btn-primary" routerLink="/dashboard"><span class="icon">space_dashboard</span>Voir le tableau de bord</a>
              </div>
            }
          </section>
        }
      }
    }
  `,
  styles: [`
    .stepper { display: flex; gap: 8px; margin: 0 0 20px; padding: 0; list-style: none; counter-reset: step; }
    .stepper li { display: flex; flex: 1; align-items: center; gap: 10px; color: var(--text-3); font-size: 14px; font-weight: 550; }
    .stepper li:not(:last-child)::after { content: ''; flex: 1; height: 2px; margin: 0 4px; background: var(--border); border-radius: 2px; }
    .stepper li.done:not(:last-child)::after { background: var(--brand); }
    .step-dot { display: grid; place-items: center; width: 28px; height: 28px; flex: 0 0 auto; color: var(--text-3); background: var(--surface); border: 1.5px solid var(--border-strong); border-radius: 50%; font-size: 13px; font-weight: 650; }
    .step-dot .icon { font-size: 16px; }
    li.active { color: var(--text); } li.active .step-dot { color: #fff; background: var(--brand); border-color: var(--brand); box-shadow: var(--focus); }
    li.done .step-dot { color: var(--brand); background: var(--brand-50); border-color: var(--brand); }
    .dropzone {
      position: relative; display: grid; justify-items: center; gap: 6px; padding: 48px 24px; text-align: center; cursor: pointer;
      background: var(--surface-2); border: 1.5px dashed var(--border-strong); border-radius: var(--r-lg); transition: border-color .15s, background .15s;
    }
    .dropzone:hover, .dropzone.dragging { background: var(--brand-50); border-color: var(--brand); }
    .dropzone strong { font-size: 16px; }
    .drop-icon { display: grid; place-items: center; width: 52px; height: 52px; margin-bottom: 6px; color: var(--brand); background: var(--surface); border: 1px solid var(--border); border-radius: 14px; box-shadow: var(--shadow-xs); }
    .drop-icon .icon { font-size: 28px; }
    .dropzone input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .dropzone + .alert { margin-top: 16px; }
    .format-help { display: grid; grid-template-columns: 1fr 1.3fr; gap: 24px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border); }
    .format-help p { margin-top: 4px; font-size: 13.5px; }
    .format-help ul { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; color: var(--text-2); font-size: 13.5px; }
    .format-help li { display: flex; align-items: center; gap: 8px; } .format-help li .icon { color: var(--pos); font-size: 18px; }
    code { padding: 1px 5px; background: var(--neu-soft); border-radius: 4px; font-size: 12.5px; }
    .file-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .file-info h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-icon { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 auto; color: var(--brand); background: var(--brand-50); border-radius: 10px; }
    .stack { display: grid; gap: 14px; }
    .preview-title { margin: 6px 0 10px; }
    .preview { border: 1px solid var(--border); border-radius: var(--r); }
    .line-col { width: 70px; }
    .footer-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
    .run-head { display: flex; align-items: center; gap: 14px; }
    .run-icon { display: grid; place-items: center; width: 44px; height: 44px; flex: 0 0 auto; color: var(--brand); background: var(--brand-50); border-radius: 12px; }
    .run-icon .icon { font-size: 26px; } .run-icon:not(.done) .icon { animation: spin 1s linear infinite; }
    .run-icon.done { color: var(--pos); background: var(--pos-soft); } .run-icon.warn { color: var(--warn); background: var(--warn-soft); }
    .run-text { flex: 1; } .run-pct { font-size: 22px; font-weight: 700; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .tile { display: grid; gap: 4px; padding: 14px 16px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r); font-size: 13px; }
    .tile strong { font-size: 22px; font-weight: 650; } .tile.has-errors strong { color: var(--neg-text); }
    .errors { padding: 12px 14px; background: var(--neg-soft); border-radius: var(--r); color: var(--neg-text); font-size: 13.5px; }
    .errors summary { cursor: pointer; font-weight: 600; }
    .errors ul { max-height: 220px; margin: 10px 0 0; padding-left: 18px; overflow: auto; }
    @media (max-width: 760px) { .step-label { display: none; } .format-help { grid-template-columns: 1fr; } .tiles { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class ImportPageComponent {
  private readonly api = inject(ReviewApi);
  readonly maxRows = MAX_ROWS;
  readonly steps = [{ n: 1, label: 'Choisir le fichier' }, { n: 2, label: 'Vérifier' }, { n: 3, label: 'Analyser' }];
  readonly file = signal<File | null>(null);
  readonly parsed = signal<ParsedCsv | null>(null);
  readonly parseError = signal('');
  readonly report = signal<ImportReport | null>(null);
  readonly loading = signal(false);
  readonly progress = signal(0);
  readonly dragging = signal(false);

  readonly step = computed(() => (this.report() ? 3 : this.parsed() && !this.parseError() ? 2 : 1));
  readonly previewRows = computed(() => this.parsed()?.rows.slice(0, PREVIEW_ROWS) ?? []);
  readonly fmt = formatNumber;
  readonly separator = (d: string) => SEPARATORS[d] ?? d;

  onFileInput(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectFile(input.files?.[0] ?? null);
    input.value = ''; // permet de re-sélectionner le même fichier
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(true);
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    this.dragging.set(false);
    this.selectFile(event.dataTransfer?.files?.[0] ?? null);
  }

  async selectFile(file: File | null) {
    this.file.set(file);
    this.parsed.set(null);
    this.report.set(null);
    this.parseError.set('');
    this.progress.set(0);
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      this.parseError.set('Fichier trop volumineux (5 Mo max).');
      return;
    }
    const parsed = parseReviewsCsv(await file.text());
    if (!parsed.rows.length) this.parseError.set('Aucun avis trouvé dans ce fichier.');
    this.parsed.set(parsed);
  }

  formatSize(bytes: number) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  async upload(event?: Event) {
    event?.preventDefault();
    const rows = this.parsed()?.rows ?? [];
    if (!rows.length || this.loading()) return;

    const parts = chunk(rows, CHUNK_SIZE);
    const acc: ImportReport = { total: 0, analyzed: 0, cacheHits: 0, errors: [] };
    this.loading.set(true);
    this.progress.set(0);
    this.report.set({ ...acc });
    try {
      for (const [i, part] of parts.entries()) {
        const csv = new Blob([toBackendCsv(part)], { type: 'text/csv;charset=utf-8' });
        const r = await firstValueFrom(this.api.importCsv(csv, this.file()?.name));
        acc.total += r.total;
        acc.analyzed += r.analyzed;
        acc.cacheHits += r.cacheHits;
        acc.errors.push(...r.errors.map((e) => remapLine(e, part)));
        this.progress.set(Math.round(((i + 1) / parts.length) * 100));
        this.report.set({ ...acc, errors: [...acc.errors] });
        if (r.errors.some((e) => /quota/i.test(e))) {
          acc.errors.push('Import interrompu : quota Hugging Face dépassé.');
          break;
        }
      }
    } catch {
      acc.errors.push('Import interrompu : le serveur ne répond pas.');
    } finally {
      this.report.set({ ...acc, errors: [...acc.errors] });
      this.loading.set(false);
    }
  }
}

/** Le backend numérote les lignes du lot envoyé : on les ramène au fichier d'origine. */
export function remapLine(error: string, part: CsvRow[]): string {
  return error.replace(/^Ligne (\d+)/, (m, n) => {
    const row = part[Number(n) - 1];
    return row ? `Ligne ${row.line}` : m;
  });
}
