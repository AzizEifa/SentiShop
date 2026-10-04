import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { ReviewApi } from '../../../core/api/review-api.service';
import { CsvRow, ParsedCsv, chunk, parseReviewsCsv, toBackendCsv } from '../../../core/csv/csv-normalizer';
import { ImportReport } from '../../../models/models';

/** Taille max acceptée par le backend (spring.servlet.multipart.max-file-size). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;
/** Lignes envoyées par requête : permet une vraie barre de progression. */
export const CHUNK_SIZE = 50;

@Component({
  selector: 'app-import-page',
  standalone: true,
  imports: [RouterLink, MatProgressBarModule],
  template: `
    <header class="page-heading">
      <div><span class="eyebrow">AJOUTER DES DONNÉES</span><h1>Importez vos avis.</h1><p>Analysez plusieurs commentaires en une seule opération.</p></div>
    </header>

    <div class="import-layout">
      <section class="panel import-panel">
        <div class="panel-title"><div><h2>Importer un fichier CSV</h2><p>Glissez un fichier ou choisissez-le depuis votre appareil.</p></div><span class="panel-title-icon material-icons">drive_folder_upload</span></div>
        <form (submit)="upload($event)" class="import-form">
          <label class="dropzone" for="file" [class.has-file]="file()" [class.dragging]="dragging()"
                 (dragover)="onDragOver($event)" (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
            <span class="upload-icon material-icons">{{ file() ? 'task' : 'upload_file' }}</span>
            @if (file(); as selected) {
              <strong>{{ selected.name }}</strong>
              <span>{{ formatSize(selected.size) }} · {{ parsed()?.rows?.length ?? 0 }} avis détectés</span>
            } @else {
              <strong>Déposez votre fichier CSV ici</strong><span>UTF-8 · 5 Mo et 2000 avis maximum</span>
            }
            <span class="browse-button">Parcourir les fichiers</span>
            <input id="file" type="file" accept=".csv,text/csv" (change)="onFileInput($event)" />
          </label>

          @if (parseError()) { <p class="parse-error">{{ parseError() }}</p> }
          @if (parsed(); as p) {
            @if (p.warnings.length) { <ul class="warnings">@for (w of p.warnings; track $index) { <li>{{ w }}</li> }</ul> }
          }

          @if (loading()) { <mat-progress-bar class="progress" mode="determinate" [value]="progress()" /><p class="progress-label">{{ progress() }} % · analyse en cours…</p> }
          <button class="primary-action submit-button" type="submit" [disabled]="!parsed()?.rows?.length || loading()"><span class="material-icons">{{ loading() ? 'hourglass_top' : 'upload' }}</span>{{ loading() ? 'Import en cours…' : 'Importer et analyser' }}</button>
        </form>

        @if (report(); as r) {
          <div class="report" aria-live="polite">
            <span class="report-icon material-icons">{{ loading() ? 'sync' : 'check_circle' }}</span>
            <div>
              <strong>{{ loading() ? 'Import en cours' : 'Import terminé' }}</strong>
              <p>{{ r.total }} lignes · {{ r.analyzed }} avis analysés · {{ r.cacheHits }} depuis le cache · {{ r.analyzed - r.cacheHits }} appels à l'API · {{ r.errors.length }} erreur(s)</p>
              @if (r.errors.length) { <ul>@for (error of r.errors; track $index) { <li>{{ error }}</li> }</ul> }
              @if (!loading()) { <p class="report-links"><a routerLink="/dashboard">Voir le tableau de bord</a> · <a routerLink="/reviews">Voir les avis</a></p> }
            </div>
          </div>
        }
      </section>

      <aside class="panel format-panel">
        <span class="format-icon material-icons">description</span><span class="eyebrow">FORMAT ATTENDU</span><h2>Un CSV simple.</h2>
        <p>Une colonne pour le texte de l'avis et, si disponible, une colonne pour le produit.</p>
        <div class="csv-example"><div><span>text</span><span>product</span></div><div><span>Très bon service !</span><span>Produit A</span></div><div><span dir="auto">المنتج رائع</span><span>Produit B</span></div></div>
        <div class="format-footnote"><span class="material-icons">info</span>En-têtes acceptés : text/texte/avis et product/produit. Séparateur virgule ou point-virgule (Excel). Sans en-tête : 1re colonne = texte, 2e = produit.</div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .import-layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(260px, .8fr); align-items: start; gap: 16px; }
    .panel-title-icon { display: grid; width: 34px; height: 34px; place-items: center; color: var(--green); background: var(--green-soft); border-radius: 8px; font-size: 18px; }
    .import-form { padding: 20px; }.dropzone { display: flex; min-height: 230px; align-items: center; flex-direction: column; justify-content: center; gap: 8px; padding: 22px; background: #fbfcfb; border: 1px dashed #bfcfc4; border-radius: 6px; text-align: center; cursor: pointer; transition: background .15s, border-color .15s; }.dropzone:hover, .dropzone.has-file, .dropzone.dragging { background: #f2f8f4; border-color: #6ca98c; }
    .upload-icon { display: grid; width: 48px; height: 48px; place-items: center; margin-bottom: 3px; color: var(--green); background: var(--green-soft); border-radius: 13px; font-size: 23px; }.dropzone strong { max-width: 100%; overflow-wrap: anywhere; font-size: 12px; }.dropzone > span:not(.upload-icon):not(.browse-button) { color: #89958e; font-size: 10px; }
    .browse-button { margin-top: 6px; padding: 8px 12px; color: var(--green-dark); background: #fff; border: 1px solid #d9e4dc; border-radius: 4px; font-size: 10px; font-weight: 600; }.dropzone input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; clip-path: inset(50%); }
    .parse-error { margin: 12px 0 0; color: var(--red); font-size: 11px; }.warnings { margin: 12px 0 0; padding-left: 16px; color: var(--amber); font-size: 10px; }
    .progress { margin-top: 15px; }.progress-label { margin: 6px 0 0; color: var(--muted); font-size: 10px; }
    .submit-button { width: 100%; min-height: 42px; margin-top: 14px; }.report { display: flex; gap: 11px; margin: 0 20px 20px; padding: 14px; color: #376d53; background: #edf6f0; border-radius: 5px; }.report-icon { font-size: 19px; }.report strong { font-size: 11px; }.report p, .report ul { margin: 4px 0 0; color: #657c6e; font-size: 10px; }.report ul { max-height: 180px; overflow: auto; padding-left: 16px; }.report-links a { color: var(--green-dark); font-weight: 600; }
    .format-panel { padding: 21px; }.format-icon { display: grid; width: 38px; height: 38px; place-items: center; margin-bottom: 17px; color: #a47734; background: #f8f1e4; border-radius: 9px; font-size: 20px; }.format-panel .eyebrow { margin-bottom: 7px; font-size: 9px; }.format-panel h2 { font-size: 17px; }.format-panel > p { margin: 8px 0 16px; color: var(--muted); font-size: 11px; }
    .csv-example { overflow: hidden; border: 1px solid var(--line); border-radius: 5px; }.csv-example > div { display: grid; grid-template-columns: 1.2fr .8fr; gap: 8px; padding: 10px; border-bottom: 1px solid #edf0ed; color: #657168; font-size: 9px; }.csv-example > div:first-child { color: #69756e; background: #f7f9f7; font-weight: 700; }.csv-example > div:last-child { border: 0; }.csv-example span { min-width: 0; overflow-wrap: anywhere; }
    .format-footnote { display: flex; gap: 7px; margin-top: 15px; color: #87928c; font-size: 9px; line-height: 1.5; }.format-footnote .material-icons { color: #9c793f; font-size: 15px; }
    @media (max-width: 850px) { .import-layout { grid-template-columns: 1fr; } }
  `],
})
export class ImportPageComponent {
  private readonly api = inject(ReviewApi);
  readonly file = signal<File | null>(null);
  readonly parsed = signal<ParsedCsv | null>(null);
  readonly parseError = signal('');
  readonly report = signal<ImportReport | null>(null);
  readonly loading = signal(false);
  readonly progress = signal(0);
  readonly dragging = signal(false);

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
