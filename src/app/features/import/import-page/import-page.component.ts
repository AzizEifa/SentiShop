import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { ImportReport } from '../../../models/models';

@Component({
  selector: 'app-import-page',
  standalone: true,
  template: `
    <header class="page-heading">
      <div><span class="eyebrow">AJOUTER DES DONNÉES</span><h1>Importez vos avis.</h1><p>Analysez plusieurs commentaires en une seule opération.</p></div>
    </header>

    <div class="import-layout">
      <section class="panel import-panel">
        <div class="panel-title"><div><h2>Importer un fichier CSV</h2><p>Choisissez un fichier depuis votre appareil.</p></div><span class="panel-title-icon material-icons">drive_folder_upload</span></div>
        <form (submit)="upload($event)" class="import-form">
          <label class="dropzone" for="file" [class.has-file]="file()">
            <span class="upload-icon material-icons">{{ file() ? 'task' : 'upload_file' }}</span>
            @if (file(); as selected) { <strong>{{ selected.name }}</strong><span>{{ formatSize(selected.size) }} · Prêt à importer</span> }
            @else { <strong>Choisissez un fichier à importer</strong><span>Format CSV · taille maximale selon votre serveur</span> }
            <span class="browse-button">Parcourir les fichiers</span>
            <input id="file" type="file" accept=".csv,text/csv" (change)="selectFile($event)" />
          </label>
          <button class="primary-action submit-button" type="submit" [disabled]="!file() || loading()"><span class="material-icons">{{ loading() ? 'hourglass_top' : 'upload' }}</span>{{ loading() ? 'Import en cours…' : 'Importer et analyser' }}</button>
        </form>
        @if (report(); as r) {
          <div class="report" aria-live="polite"><span class="report-icon material-icons">check_circle</span><div><strong>Import terminé</strong><p>{{ r.total }} lignes · {{ r.analyzed }} avis analysés · {{ r.cacheHits }} résultats du cache</p>@if (r.errors.length) { <ul>@for (error of r.errors; track $index) { <li>{{ error }}</li> }</ul> }</div></div>
        }
      </section>

      <aside class="panel format-panel">
        <span class="format-icon material-icons">description</span><span class="eyebrow">FORMAT ATTENDU</span><h2>Un CSV simple.</h2>
        <p>Préparez un fichier CSV contenant le texte des avis et, si disponible, le nom du produit.</p>
        <div class="csv-example"><div><span>texte</span><span>produit</span></div><div><span>Très bon service !</span><span>Produit A</span></div><div><span>Livraison en retard</span><span>Produit B</span></div></div>
        <div class="format-footnote"><span class="material-icons">info</span>La première ligne peut contenir les noms des colonnes.</div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .import-layout { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(260px, .8fr); align-items: start; gap: 16px; }
    .panel-title-icon { display: grid; width: 34px; height: 34px; place-items: center; color: var(--green); background: var(--green-soft); border-radius: 8px; font-size: 18px; }
    .import-form { padding: 20px; }.dropzone { display: flex; min-height: 230px; align-items: center; flex-direction: column; justify-content: center; gap: 8px; padding: 22px; background: #fbfcfb; border: 1px dashed #bfcfc4; border-radius: 6px; text-align: center; cursor: pointer; transition: background .15s, border-color .15s; }.dropzone:hover, .dropzone.has-file { background: #f2f8f4; border-color: #6ca98c; }
    .upload-icon { display: grid; width: 48px; height: 48px; place-items: center; margin-bottom: 3px; color: var(--green); background: var(--green-soft); border-radius: 13px; font-size: 23px; }.dropzone strong { max-width: 100%; overflow-wrap: anywhere; font-size: 12px; }.dropzone > span:not(.upload-icon):not(.browse-button) { color: #89958e; font-size: 10px; }
    .browse-button { margin-top: 6px; padding: 8px 12px; color: var(--green-dark); background: #fff; border: 1px solid #d9e4dc; border-radius: 4px; font-size: 10px; font-weight: 600; }.dropzone input { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; clip-path: inset(50%); }
    .submit-button { width: 100%; min-height: 42px; margin-top: 14px; }.report { display: flex; gap: 11px; margin: 0 20px 20px; padding: 14px; color: #376d53; background: #edf6f0; border-radius: 5px; }.report-icon { font-size: 19px; }.report strong { font-size: 11px; }.report p, .report ul { margin: 4px 0 0; color: #657c6e; font-size: 10px; }.report ul { padding-left: 16px; }
    .format-panel { padding: 21px; }.format-icon { display: grid; width: 38px; height: 38px; place-items: center; margin-bottom: 17px; color: #a47734; background: #f8f1e4; border-radius: 9px; font-size: 20px; }.format-panel .eyebrow { margin-bottom: 7px; font-size: 9px; }.format-panel h2 { font-size: 17px; }.format-panel > p { margin: 8px 0 16px; color: var(--muted); font-size: 11px; }
    .csv-example { overflow: hidden; border: 1px solid var(--line); border-radius: 5px; }.csv-example > div { display: grid; grid-template-columns: 1.2fr .8fr; gap: 8px; padding: 10px; border-bottom: 1px solid #edf0ed; color: #657168; font-size: 9px; }.csv-example > div:first-child { color: #69756e; background: #f7f9f7; font-weight: 700; }.csv-example > div:last-child { border: 0; }.csv-example span { min-width: 0; overflow-wrap: anywhere; }
    .format-footnote { display: flex; gap: 7px; margin-top: 15px; color: #87928c; font-size: 9px; line-height: 1.5; }.format-footnote .material-icons { color: #9c793f; font-size: 15px; }
    @media (max-width: 850px) { .import-layout { grid-template-columns: 1fr; } }
  `],
})
export class ImportPageComponent {
  private readonly http = inject(HttpClient);
  readonly file = signal<File | null>(null);
  readonly report = signal<ImportReport | null>(null);
  readonly loading = signal(false);

  selectFile(event: Event) {
    this.file.set((event.target as HTMLInputElement).files?.[0] ?? null);
    this.report.set(null);
  }

  formatSize(bytes: number) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} Ko` : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }

  upload(event: Event) {
    event.preventDefault();
    const file = this.file();
    if (!file || this.loading()) return;
    const body = new FormData();
    body.append('file', file);
    this.loading.set(true);
    this.http.post<ImportReport>('/api/reviews/import', body).subscribe({
      next: (result) => { this.report.set(result); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
