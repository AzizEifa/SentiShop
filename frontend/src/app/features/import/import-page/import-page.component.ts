import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ReviewApi } from '../../../core/api/review-api.service';
import { NotificationService } from '../../../core/notifications/notification.service';
import { ColumnChoice, CsvRow, MAX_ROWS, ParsedCsv, chunk, parseReviewsCsv, toBackendCsv } from '../../../core/csv/csv-normalizer';
import { downloadText, toCsv } from '../../../core/csv/csv-export';
import { ImportReport } from '../../../core/models/models';
import { formatNumber } from '../../../core/format';

/** Taille max acceptée par le backend (spring.servlet.multipart.max-file-size). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Lignes envoyées par requête : la progression affichée correspond aux lots réellement traités. */
export const CHUNK_SIZE = 50;
const PREVIEW_ROWS = 5;

const SEPARATORS: Record<string, string> = { ',': 'virgule', ';': 'point-virgule', '\t': 'tabulation' };

export const IMPORT_STEPS = [
  { n: 1, label: 'Fichier' },
  { n: 2, label: 'Vérification' },
  { n: 3, label: 'Colonnes' },
  { n: 4, label: 'Analyse' },
  { n: 5, label: 'Bilan' },
];

@Component({
  selector: 'app-import-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="page-header">
      <div>
        <h1>Importer des avis</h1>
        <p class="subtitle">Analysez d’un coup les avis d’un fichier CSV (jusqu’à {{ fmt(maxRows) }} avis, 5 Mo maximum).</p>
      </div>
      <div class="page-actions">
        <a class="btn btn-secondary" href="modele-avis.csv" download="modele-avis.csv"><span class="icon">description</span>Télécharger le modèle</a>
      </div>
    </header>

    <ol class="stepper" aria-label="Étapes de l'import">
      @for (s of steps; track s.n) {
        <li [class.active]="step() === s.n" [class.done]="step() > s.n" [attr.aria-current]="step() === s.n ? 'step' : null">
          <span class="step-dot">@if (step() > s.n) { <span class="icon">check</span> } @else { {{ s.n }} }</span>
          <span class="step-label">{{ s.label }}</span>
        </li>
      }
    </ol>

    @switch (step()) {
      <!-- 1. Fichier -->
      @case (1) {
        <section class="card fade-in">
          <div class="card-body">
            <label class="dropzone" for="file" [class.dragging]="dragging()"
                   (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
              <span class="drop-icon"><span class="icon">upload_file</span></span>
              <strong>Glissez votre fichier CSV ici</strong>
              <span class="muted">ou <span class="browse">parcourez vos fichiers</span></span>
              <span class="hint">Format .csv · 5 Mo maximum · {{ fmt(maxRows) }} avis maximum</span>
              <input id="file" type="file" accept=".csv,text/csv" (change)="onFileInput($event)" />
            </label>
            @if (parseError()) { <div class="alert alert-danger fade-in" role="alert"><span class="icon">error</span><div><strong>{{ file()?.name }}</strong> — {{ parseError() }}</div></div> }
            <div class="format-help">
              <div>
                <h3>Format attendu</h3>
                <p class="muted">Une colonne pour le texte de l’avis (obligatoire), une colonne pour le produit (facultative).</p>
              </div>
              <ul>
                <li><span class="icon">check_circle</span>En-têtes reconnus : <code>text</code>, <code>texte</code>, <code>avis</code> · <code>product</code>, <code>produit</code></li>
                <li><span class="icon">check_circle</span>Séparateur virgule, point-virgule (export Excel) ou tabulation</li>
                <li><span class="icon">check_circle</span>Français, anglais et arabe, encodage UTF-8</li>
              </ul>
            </div>
          </div>
        </section>
      }

      <!-- 2. Vérification -->
      @case (2) {
        @if (parsed(); as p) {
          <section class="card fade-in">
            <div class="card-header">
              <div class="file-info">
                <span class="file-icon"><span class="icon">draft</span></span>
                <div><h2>{{ file()?.name }}</h2><p class="card-subtitle">{{ formatSize(file()?.size ?? 0) }} · séparateur {{ separator(p.delimiter) }} · {{ p.hasHeader ? 'en-têtes reconnus' : 'sans en-tête reconnu' }}</p></div>
              </div>
              <button class="btn btn-ghost btn-sm" type="button" (click)="selectFile(null)"><span class="icon">swap_horiz</span>Changer de fichier</button>
            </div>
            <div class="card-body stack">
              <ul class="checks">
                <li class="ok"><span class="icon">check_circle</span>Fichier lisible ({{ fmt(p.rows.length) }} avis trouvés)</li>
                <li [class.ok]="p.hasHeader" [class.warn]="!p.hasHeader"><span class="icon">{{ p.hasHeader ? 'check_circle' : 'warning' }}</span>{{ p.hasHeader ? 'Colonne de texte identifiée : « ' + header(p, p.textCol) + ' »' : 'Aucun en-tête reconnu : vérifiez les colonnes à l’étape suivante' }}</li>
                <li [class.ok]="p.productCol >= 0" [class.info]="p.productCol < 0"><span class="icon">{{ p.productCol >= 0 ? 'check_circle' : 'info' }}</span>{{ p.productCol >= 0 ? 'Colonne produit : « ' + header(p, p.productCol) + ' »' : 'Pas de colonne produit (facultative)' }}</li>
              </ul>
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
              <button class="btn btn-primary" type="button" (click)="columnsStage.set(true)">Continuer<span class="icon">arrow_forward</span></button>
            </div>
          </section>
        }
      }

      <!-- 3. Colonnes -->
      @case (3) {
        @if (parsed(); as p) {
          <section class="card fade-in">
            <div class="card-header"><div><h2>Confirmer les colonnes</h2><p class="card-subtitle">Détection automatique, modifiable si besoin.</p></div></div>
            <div class="card-body stack">
              <div class="columns">
                <div class="field">
                  <label class="label" for="col-text">Colonne du texte de l’avis</label>
                  <select id="col-text" class="select" [value]="p.textCol" (change)="setColumns(+$any($event.target).value, p.productCol)">
                    @for (h of p.headers; track $index) { <option [value]="$index">{{ columnName(p, $index) }}</option> }
                  </select>
                </div>
                <div class="field">
                  <label class="label" for="col-product">Colonne du produit <span class="optional">facultative</span></label>
                  <select id="col-product" class="select" [value]="p.productCol" (change)="setColumns(p.textCol, +$any($event.target).value)">
                    <option value="-1">Aucune</option>
                    @for (h of p.headers; track $index) { <option [value]="$index">{{ columnName(p, $index) }}</option> }
                  </select>
                </div>
              </div>
              @if (p.textCol === p.productCol) { <div class="alert alert-danger" role="alert"><span class="icon">error</span><div>Le texte et le produit doivent être deux colonnes différentes.</div></div> }
              @else if (!p.rows.length) { <div class="alert alert-danger" role="alert"><span class="icon">error</span><div>Aucun avis dans cette colonne.</div></div> }
              @else {
                <div class="alert alert-info"><span class="icon">fact_check</span><div><strong>{{ fmt(p.rows.length) }} avis prêts à être analysés</strong>, envoyés par lots de {{ chunkSize }}. Les avis déjà connus sont servis par le cache, sans consommer de crédit Hugging Face.</div></div>
                <div class="sample"><span class="muted small">Exemple, ligne {{ p.rows[0].line }} :</span><p dir="auto">« {{ p.rows[0].text }} »@if (p.rows[0].product) { <span class="tag">{{ p.rows[0].product }}</span> }</p></div>
              }
            </div>
            <div class="card-footer footer-actions">
              <button class="btn btn-secondary" type="button" (click)="columnsStage.set(false)"><span class="icon">arrow_back</span>Retour</button>
              <button class="btn btn-primary" type="button" (click)="upload()" [disabled]="!p.rows.length || p.textCol === p.productCol"><span class="icon">auto_awesome</span>Analyser {{ fmt(p.rows.length) }} avis</button>
            </div>
          </section>
        }
      }

      <!-- 4. Analyse · 5. Bilan -->
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
                  <p class="muted" aria-live="polite">{{ loading() ? 'Lot ' + batchesDone() + ' sur ' + batchesTotal() + ' traité · ne fermez pas la page.' : fmt(r.analyzed) + ' avis analysés sur ' + fmt(rowsTotal()) + ' lignes envoyées.' }}</p>
                </div>
                <strong class="run-pct tabular">{{ progress() }}&#8239;%</strong>
              </div>
              <div class="progress" role="progressbar" aria-label="Progression de l'import" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="progress()"></span></div>
              <div class="tiles">
                <div class="tile"><span class="muted">Lignes du fichier</span><strong class="tabular">{{ fmt(rowsTotal()) }}</strong></div>
                <div class="tile"><span class="muted">Lignes traitées</span><strong class="tabular">{{ fmt(r.total) }}</strong></div>
                <div class="tile ok"><span class="muted">Avis valides analysés</span><strong class="tabular">{{ fmt(r.analyzed) }}</strong><small class="muted">dont {{ fmt(r.cacheHits) }} depuis le cache</small></div>
                <div class="tile" [class.has-errors]="r.errors.length"><span class="muted">Erreurs</span><strong class="tabular">{{ fmt(r.errors.length) }}</strong></div>
              </div>
              @if (r.errors.length && !loading()) {
                <details class="errors" open>
                  <summary>Détail des {{ r.errors.length }} erreur(s)</summary>
                  <ul>@for (e of r.errors; track $index) { <li>{{ e }}</li> }</ul>
                </details>
              }
            </div>
            @if (!loading()) {
              <div class="card-footer footer-actions">
                @if (r.errors.length) { <button class="btn btn-ghost" type="button" (click)="downloadErrors()"><span class="icon">download</span>Rapport d’erreurs (CSV)</button> }
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
    .stepper { display: flex; gap: 8px; margin: 0 0 20px; padding: 0; list-style: none; }
    .stepper li { display: flex; flex: 1; align-items: center; gap: 10px; color: var(--text-3); font-size: 13.5px; font-weight: 550; }
    .stepper li:last-child { flex: 0 0 auto; }
    .stepper li:not(:last-child)::after { content: ''; flex: 1; height: 2px; margin: 0 4px; background: var(--border); border-radius: 2px; }
    .stepper li.done:not(:last-child)::after { background: var(--primary); }
    .step-dot { display: grid; place-items: center; width: 26px; height: 26px; flex: 0 0 auto; color: var(--text-3); background: var(--surface); border: 1px solid var(--border-strong); border-radius: 50%; font-size: 12px; font-weight: 650; }
    .step-dot .icon { font-size: 16px; }
    li.active { color: var(--text); } li.active .step-dot { color: #fff; background: var(--primary); border-color: var(--primary); box-shadow: 0 0 0 4px var(--primary-50); }
    li.done .step-dot { color: var(--primary); background: var(--primary-50); border-color: var(--primary-100); }
    .dropzone { position: relative; display: grid; justify-items: center; gap: 6px; padding: 48px 24px; text-align: center; cursor: pointer; background: var(--surface-2); border: 1.5px dashed var(--border-strong); border-radius: var(--r-lg); transition: border-color .15s, background .15s; }
    .dropzone:hover, .dropzone.dragging { background: var(--primary-50); border-color: var(--primary); }
    .dropzone:focus-within { box-shadow: var(--focus); }
    .dropzone strong { font-size: 16px; }
    .browse { color: var(--primary-text); font-weight: 600; text-decoration: underline; text-underline-offset: 3px; }
    .drop-icon { display: grid; place-items: center; width: 48px; height: 48px; margin-bottom: 6px; color: var(--primary); background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-lg); box-shadow: var(--shadow-xs); }
    .drop-icon .icon { font-size: 28px; }
    .dropzone input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
    .dropzone + .alert { margin-top: 16px; }
    .format-help { display: grid; grid-template-columns: 1fr 1.3fr; gap: 24px; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border); }
    .format-help p { margin-top: 4px; font-size: 13.5px; }
    .format-help ul, .checks { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; color: var(--text-2); font-size: 13.5px; }
    .format-help li, .checks li { display: flex; align-items: center; gap: 8px; } .format-help li .icon { color: var(--pos); font-size: 18px; }
    .checks li .icon { font-size: 18px; } .checks li.ok .icon { color: var(--pos); } .checks li.warn .icon { color: var(--neu); } .checks li.info .icon { color: var(--primary); }
    code { padding: 1px 5px; background: var(--surface-3); border-radius: 4px; font-size: 12.5px; }
    .file-info { display: flex; align-items: center; gap: 12px; min-width: 0; }
    .file-info h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .file-icon { display: grid; place-items: center; width: 38px; height: 38px; flex: 0 0 auto; color: var(--primary); background: var(--primary-50); border-radius: var(--r); }
    .stack { display: grid; gap: 14px; }
    .preview-title { margin: 6px 0 10px; }
    .preview { border: 1px solid var(--border); border-radius: var(--r); }
    .line-col { width: 70px; }
    .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .sample { display: grid; gap: 4px; padding: 12px 14px; background: var(--surface-2); border-radius: var(--r); }
    .sample p { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; unicode-bidi: plaintext; }
    .footer-actions { display: flex; justify-content: flex-end; gap: 10px; flex-wrap: wrap; }
    .run-head { display: flex; align-items: center; gap: 14px; }
    .run-icon { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 auto; color: var(--primary); background: var(--primary-50); border-radius: var(--r); }
    .run-icon .icon { font-size: 26px; } .run-icon:not(.done) .icon { animation: spin 1s linear infinite; }
    .run-icon.done { color: var(--pos); background: var(--pos-soft); } .run-icon.warn { color: var(--neu-text); background: var(--neu-soft); }
    .run-text { flex: 1; } .run-pct { font-size: 22px; font-weight: 700; }
    .progress { height: 10px; overflow: hidden; background: var(--primary-50); border-radius: 99px; }
    .progress span { display: block; height: 100%; background: var(--primary); border-radius: inherit; transition: width .3s ease; }
    .tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
    .tile { display: grid; gap: 4px; align-content: start; padding: 14px 16px; background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r); font-size: 13px; }
    .tile strong { font-size: 22px; font-weight: 650; letter-spacing: -.02em; } .tile small { font-size: 12px; }
    .tile.ok strong { color: var(--pos-text); } .tile.has-errors strong { color: var(--neg-text); }
    .errors { padding: 12px 14px; color: var(--neg-text); background: var(--neg-soft); border-radius: var(--r); font-size: 13.5px; }
    .errors summary { cursor: pointer; font-weight: 600; }
    .errors ul { max-height: 240px; margin: 10px 0 0; padding-left: 18px; overflow: auto; }
    @media (max-width: 760px) { .step-label { display: none; } .stepper li.active .step-label { display: inline; } .format-help, .columns { grid-template-columns: 1fr; } .tiles { grid-template-columns: repeat(2, 1fr); } }
  `],
})
export class ImportPageComponent {
  private readonly api = inject(ReviewApi);
  private readonly notifications = inject(NotificationService);
  readonly maxRows = MAX_ROWS;
  readonly chunkSize = CHUNK_SIZE;
  readonly steps = IMPORT_STEPS;
  readonly file = signal<File | null>(null);
  readonly parsed = signal<ParsedCsv | null>(null);
  readonly parseError = signal('');
  readonly columnsStage = signal(false);
  readonly report = signal<ImportReport | null>(null);
  readonly loading = signal(false);
  readonly progress = signal(0);
  readonly batchesDone = signal(0);
  readonly batchesTotal = signal(0);
  readonly rowsTotal = signal(0);
  readonly dragging = signal(false);
  private raw = '';

  readonly step = computed(() =>
    this.report() ? (this.loading() ? 4 : 5)
      : this.parsed() && !this.parseError() ? (this.columnsStage() ? 3 : 2)
      : 1);
  readonly previewRows = computed(() => this.parsed()?.rows.slice(0, PREVIEW_ROWS) ?? []);
  readonly fmt = formatNumber;
  readonly separator = (d: string) => SEPARATORS[d] ?? d;
  readonly header = (p: ParsedCsv, i: number) => (p.hasHeader ? p.headers[i] : `Colonne ${i + 1}`);
  readonly columnName = (p: ParsedCsv, i: number) => {
    const sample = (p.headers[i] ?? '').trim();
    const short = sample.length > 32 ? sample.slice(0, 32) + '…' : sample;
    return p.hasHeader ? `${short} (colonne ${i + 1})` : `Colonne ${i + 1} — ex. « ${short} »`;
  };

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
    this.columnsStage.set(false);
    this.progress.set(0);
    this.raw = '';
    if (!file) return;
    if (!/\.csv$/i.test(file.name) && file.type && !file.type.includes('csv') && file.type !== 'text/plain') {
      this.parseError.set('Format non pris en charge : choisissez un fichier .csv.');
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      this.parseError.set('Fichier trop volumineux (5 Mo max).');
      return;
    }
    this.raw = await file.text();
    const parsed = parseReviewsCsv(this.raw);
    if (!parsed.rows.length && !parsed.headers.length) this.parseError.set('Aucun avis trouvé dans ce fichier.');
    else if (!parsed.rows.length && parsed.hasHeader) this.parseError.set('Aucun avis trouvé dans ce fichier.');
    this.parsed.set(parsed);
  }

  /** Étape « Colonnes » : relit le fichier avec les colonnes choisies. */
  setColumns(textCol: number, productCol: number) {
    const choice: ColumnChoice = { textCol, productCol };
    this.parsed.set(parseReviewsCsv(this.raw, choice));
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
    this.rowsTotal.set(rows.length);
    this.batchesTotal.set(parts.length);
    this.batchesDone.set(0);
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
        this.batchesDone.set(i + 1);
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
      this.notifications.notify(acc.errors.length
        ? { kind: 'import.errors', title: 'Import avec erreurs', message: `${this.file()?.name ?? 'Fichier'} : ${acc.analyzed} avis analysés, ${acc.errors.length} erreur(s).`, link: '/import' }
        : { kind: 'import.done', title: 'Import terminé', message: `${this.file()?.name ?? 'Fichier'} : ${acc.analyzed} avis analysés.`, link: '/dashboard' });
    }
  }

  /** Rapport d'erreurs : une ligne par erreur, numéro de ligne du fichier d'origine si connu. */
  downloadErrors() {
    const rows = (this.report()?.errors ?? []).map((e) => {
      const m = /^Ligne (\d+)\s*:?\s*(.*)$/.exec(e);
      return m ? [m[1], m[2]] : ['', e];
    });
    const base = (this.file()?.name ?? 'import').replace(/\.csv$/i, '');
    downloadText(toCsv(['ligne', 'erreur'], rows), `${base}-erreurs.csv`);
  }
}

/** Le backend numérote les lignes du lot envoyé : on les ramène au fichier d'origine. */
export function remapLine(error: string, part: CsvRow[]): string {
  return error.replace(/^Ligne (\d+)/, (m, n) => {
    const row = part[Number(n) - 1];
    return row ? `Ligne ${row.line}` : m;
  });
}
