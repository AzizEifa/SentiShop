import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ReviewApi } from '../../../core/api/review-api.service';
import { CompareResponse, Sentiment } from '../../../core/models/models';
import { SENTIMENT_LABEL } from '../../../core/format';
import { SentimentBadgeComponent } from '../../../shared/sentiment-badge/sentiment-badge.component';

export interface CompareCase {
  text: string;
  expected: Sentiment;
  result?: CompareResponse;
  error?: boolean;
}

/** Identification du jeu de test affiché à l'écran (pour ne pas confondre avec une mesure publiée). */
export const DATASET = {
  name: 'Jeu de test SentiShop — arabe v1',
  description: '12 avis courts rédigés pour la démonstration et annotés manuellement (4 positifs, 4 neutres, 4 négatifs). Échantillon trop petit pour conclure scientifiquement : il illustre le comportement des modèles.',
};

/** Jeu de test arabe avec le sentiment attendu (annotation humaine). */
export const ARABIC_CASES: CompareCase[] = [
  { text: 'المنتج رائع جدا وأنصح به', expected: 'POSITIVE' },
  { text: 'التوصيل كان سريعا والجودة ممتازة', expected: 'POSITIVE' },
  { text: 'أحببت هذا الهاتف، البطارية تدوم طويلا', expected: 'POSITIVE' },
  { text: 'خدمة العملاء محترمة وسريعة الرد', expected: 'POSITIVE' },
  { text: 'المنتج عادي، لا بأس به', expected: 'NEUTRAL' },
  { text: 'استلمت الطلب اليوم', expected: 'NEUTRAL' },
  { text: 'اللون مطابق للصورة والحجم متوسط', expected: 'NEUTRAL' },
  { text: 'وصل الطرد بعد أسبوع', expected: 'NEUTRAL' },
  { text: 'الجودة سيئة جدا ولن أشتري مرة أخرى', expected: 'NEGATIVE' },
  { text: 'وصل المنتج مكسورا وخدمة العملاء لا ترد', expected: 'NEGATIVE' },
  { text: 'السعر مرتفع والمنتج لا يستحق', expected: 'NEGATIVE' },
  { text: 'توقف الجهاز عن العمل بعد يومين', expected: 'NEGATIVE' },
];

const ORDER: Sentiment[] = ['POSITIVE', 'NEUTRAL', 'NEGATIVE'];
type ModelKey = 'multilingual' | 'english';

@Component({
  selector: 'app-compare-page',
  standalone: true,
  imports: [FormsModule, SentimentBadgeComponent],
  template: `
    <header class="page-header">
      <div>
        <h1>Comparer les modèles</h1>
        <p class="subtitle">Un modèle multilingue face à un modèle entraîné uniquement sur l’anglais, sur des avis en arabe annotés.</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-primary" type="button" (click)="runAll()" [disabled]="running() || !cases().length">
          @if (running()) { <span class="spinner"></span>Comparaison… {{ progress() }}&#8239;% } @else { <span class="icon">play_arrow</span>{{ accuracy().done ? 'Relancer le benchmark' : 'Lancer le benchmark' }} }
        </button>
      </div>
    </header>

    <section class="card dataset">
      <span class="ds-icon"><span class="icon">dataset</span></span>
      <div>
        <h2>{{ dataset.name }} · {{ cases().length }} avis</h2>
        <p>{{ dataset.description }}</p>
      </div>
      <span class="run-state" [class.done]="accuracy().done" role="status">
        @if (running()) { En cours } @else if (accuracy().done) { Mesuré sur {{ accuracy().done }} avis } @else { Benchmark non exécuté }
      </span>
    </section>
    @if (running()) { <div class="progress" role="progressbar" aria-label="Progression du benchmark" [attr.aria-valuenow]="progress()" aria-valuemin="0" aria-valuemax="100"><span [style.width.%]="progress()"></span></div> }

    <h2 class="block-title">Exactitude <small>— prédictions conformes à l’annotation humaine</small></h2>
    <section class="score-grid">
      @for (m of models; track m.key) {
        <article class="card score-card">
          <div class="score-head"><span class="model-tag" [class]="'model-tag ' + m.key">{{ m.label }}</span><span class="muted small">{{ modelName(m.key) }}</span></div>
          <div class="score-value tabular">{{ accuracy().done ? correct(m.key) + ' / ' + accuracy().done : '—' }}</div>
          <div class="meter"><span [style.width.%]="pct(correct(m.key))"></span></div>
          <div class="kpi-meta">{{ accuracy().done ? 'Exactitude : ' + pct(correct(m.key)) + ' % des avis correctement classés' : 'Lancez le benchmark pour mesurer' }}</div>
        </article>
      }
      <article class="card score-card agree">
        <div class="score-head"><span class="model-tag">Accord entre modèles</span></div>
        <div class="score-value tabular">{{ accuracy().done ? accuracy().agree + ' / ' + accuracy().done : '—' }}</div>
        <div class="meter"><span [style.width.%]="pct(accuracy().agree)"></span></div>
        <div class="kpi-meta">Même étiquette pour les deux modèles, <strong>qu’elle soit juste ou non</strong> : l’accord ne mesure pas l’exactitude.</div>
      </article>
    </section>

    @if (accuracy().done) {
      <h2 class="block-title">Matrices de confusion <small>— lignes : sentiment attendu · colonnes : prédiction</small></h2>
      <section class="matrix-grid">
        @for (m of models; track m.key) {
          <article class="card matrix-card">
            <h3>{{ m.label }}</h3>
            <table class="matrix">
              <caption class="sr-only">Matrice de confusion du modèle {{ m.label }}</caption>
              <thead><tr><th scope="col"><span class="sr-only">Attendu</span></th>@for (p of order; track p) { <th scope="col">{{ short(p) }}</th> }</tr></thead>
              <tbody>
                @for (e of order; track e) {
                  <tr>
                    <th scope="row">{{ short(e) }}</th>
                    @for (p of order; track p) {
                      <td [class.diag]="e === p" [style.--alpha]="cellAlpha(m.key, e, p)" [attr.aria-label]="label(e) + ' attendu, ' + label(p) + ' prédit : ' + matrix(m.key)[e][p]">{{ matrix(m.key)[e][p] }}</td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </article>
        }
      </section>
    }

    <section class="card">
      <div class="card-header"><div><h2>Exemples analysés</h2><p class="card-subtitle">{{ cases().length }} avis · vous pouvez en ajouter (ils sortent alors du jeu de test identifié)</p></div></div>
      <div class="table-wrap">
        <table class="table stack compare-table">
          <thead><tr><th>Avis</th><th>Attendu</th><th>Multilingue</th><th>Anglais seul</th><th>Concordance</th><th class="actions-col"><span class="sr-only">Actions</span></th></tr></thead>
          <tbody>
            @for (c of cases(); track $index) {
              <tr>
                <td class="text" data-label="Avis"><p class="review-text" dir="auto" lang="ar">{{ c.text }}</p></td>
                <td data-label="Attendu"><app-sentiment-badge [label]="c.expected" /></td>
                @for (m of models; track m.key) {
                  <td [attr.data-label]="m.label">
                    @if (c.result; as r) {
                      <div class="cell-result"><span class="icon verdict" [class.ok]="r[m.key].label === c.expected" [attr.aria-label]="r[m.key].label === c.expected ? 'Correct' : 'Incorrect'">{{ r[m.key].label === c.expected ? 'check_circle' : 'cancel' }}</span><app-sentiment-badge [label]="r[m.key].label" /><span class="muted tabular">{{ round(r[m.key].score * 100) }}&#8239;%</span></div>
                    } @else if (c.error) { <span class="err">Erreur</span> } @else { <span class="muted">—</span> }
                  </td>
                }
                <td data-label="Concordance">
                  @if (c.result; as r) { <span class="tag" [class.info]="r.agree" [class.warn]="!r.agree"><span class="icon">{{ r.agree ? 'link' : 'call_split' }}</span>{{ r.agree ? 'Concordent' : 'Divergent' }}</span> } @else { <span class="muted">—</span> }
                </td>
                <td class="actions-col"><button class="icon-btn danger" type="button" title="Retirer" aria-label="Retirer cet avis" (click)="remove($index)" [disabled]="running()"><span class="icon">delete</span></button></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <form class="card-footer add-row" (submit)="add($event)">
        <input class="input" dir="auto" name="text" [(ngModel)]="newText" maxlength="2000" placeholder="Ajouter un avis annoté (arabe, français ou anglais)…" aria-label="Texte de l'avis" />
        <select class="select" name="expected" [(ngModel)]="newExpected" aria-label="Sentiment attendu">
          <option value="POSITIVE">Positif</option><option value="NEUTRAL">Neutre</option><option value="NEGATIVE">Négatif</option>
        </select>
        <button class="btn btn-secondary" type="submit" [disabled]="!newText.trim() || running()"><span class="icon">add</span>Ajouter</button>
      </form>
    </section>
  `,
  styles: [`
    .dataset { display: flex; align-items: center; gap: 16px; margin-bottom: 12px; padding: 18px 20px; }
    .dataset p { margin-top: 2px; color: var(--text-2); font-size: 13.5px; }
    .ds-icon { display: grid; place-items: center; width: 40px; height: 40px; flex: 0 0 auto; color: var(--primary); background: var(--primary-50); border-radius: var(--r); }
    .run-state { flex: 0 0 auto; padding: 4px 10px; color: var(--neu-text); background: var(--neu-soft); border-radius: 99px; font-size: 12px; font-weight: 600; }
    .run-state.done { color: var(--pos-text); background: var(--pos-soft); }
    .progress { height: 6px; margin-bottom: 12px; overflow: hidden; background: var(--primary-50); border-radius: 99px; }
    .progress span { display: block; height: 100%; background: var(--primary); transition: width .3s; }
    .block-title { margin: 22px 0 12px; font-size: 15px; } .block-title small { color: var(--text-3); font-size: 13px; font-weight: 400; }
    .score-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
    .score-card { display: grid; gap: 8px; align-content: start; padding: 18px 20px; }
    .score-card.agree { background: var(--surface-2); border-style: dashed; }
    .score-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .model-tag { padding: 2px 9px; color: var(--text-2); background: var(--surface-3); border-radius: 99px; font-size: 12px; font-weight: 650; }
    .model-tag.multilingual { color: var(--primary-text); background: var(--primary-50); } .model-tag.english { color: var(--navy); background: #e3e9f2; }
    .score-value { font-size: 28px; font-weight: 700; letter-spacing: -.03em; }
    .matrix-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 22px; }
    .matrix-card { padding: 18px 20px; } .matrix-card h3 { margin-bottom: 12px; }
    .matrix { width: 100%; border-collapse: separate; border-spacing: 4px; font-size: 13px; text-align: center; }
    .matrix th { color: var(--text-3); font-size: 12px; font-weight: 600; }
    .matrix th[scope='row'] { text-align: end; padding-right: 8px; }
    .matrix td { height: 44px; border-radius: var(--r-sm); background: rgba(230, 83, 83, calc(var(--alpha, 0) * .5)); font-weight: 650; font-variant-numeric: tabular-nums; }
    .matrix td.diag { background: rgba(22, 165, 121, calc(.08 + var(--alpha, 0) * .55)); }
    .compare-table .text { min-width: 220px; font-size: 15px; }
    .cell-result { display: flex; align-items: center; gap: 8px; white-space: nowrap; font-size: 13px; }
    .verdict { color: var(--neg); font-size: 20px; font-variation-settings: 'FILL' 1; } .verdict.ok { color: var(--pos); }
    .tag .icon { font-size: 14px; }
    .err { color: var(--neg-text); font-size: 13px; font-weight: 600; }
    .actions-col { width: 52px; }
    .add-row { display: flex; gap: 10px; }
    .add-row .select { width: 150px; flex: 0 0 auto; }
    @media (max-width: 900px) { .score-grid, .matrix-grid { grid-template-columns: 1fr; } .dataset { flex-wrap: wrap; } }
    @media (max-width: 640px) { .add-row { flex-direction: column; } .add-row .select { width: 100%; } }
  `],
})
export class ComparePageComponent {
  private readonly api = inject(ReviewApi);
  readonly dataset = DATASET;
  readonly order = ORDER;
  readonly models: { key: ModelKey; label: string }[] = [
    { key: 'multilingual', label: 'Multilingue' },
    { key: 'english', label: 'Anglais seul' },
  ];
  readonly cases = signal<CompareCase[]>(ARABIC_CASES.map((c) => ({ ...c })));
  readonly running = signal(false);
  readonly progress = signal(0);
  newText = '';
  newExpected: Sentiment = 'POSITIVE';

  readonly round = Math.round;
  readonly label = (s: Sentiment) => SENTIMENT_LABEL[s];
  readonly short = (s: Sentiment) => SENTIMENT_LABEL[s];
  readonly pct = (n: number) => { const d = this.accuracy().done; return d ? Math.round((n / d) * 100) : 0; };
  readonly correct = (m: ModelKey) => (m === 'multilingual' ? this.accuracy().multi : this.accuracy().english);

  readonly accuracy = computed(() => {
    const done = this.cases().filter((c) => c.result);
    return {
      done: done.length,
      multi: done.filter((c) => c.result!.multilingual.label === c.expected).length,
      english: done.filter((c) => c.result!.english.label === c.expected).length,
      agree: done.filter((c) => c.result!.agree).length,
    };
  });

  /** Matrices de confusion [attendu][prédit] pour chaque modèle. */
  readonly matrices = computed(() => {
    const build = (m: ModelKey) => {
      const mx = Object.fromEntries(ORDER.map((e) => [e, Object.fromEntries(ORDER.map((p) => [p, 0]))])) as Record<Sentiment, Record<Sentiment, number>>;
      this.cases().forEach((c) => { if (c.result) mx[c.expected][c.result[m].label]++; });
      return mx;
    };
    return { multilingual: build('multilingual'), english: build('english') };
  });

  readonly modelName = (m: ModelKey) => this.cases().find((c) => c.result)?.result?.[m].model ?? (m === 'multilingual' ? 'XLM-RoBERTa' : 'RoBERTa (anglais)');
  readonly matrix = (m: ModelKey) => this.matrices()[m];

  /** Intensité d'une case : part des avis de la ligne. */
  cellAlpha(m: ModelKey, expected: Sentiment, predicted: Sentiment): number {
    const row = this.matrix(m)[expected];
    const total = ORDER.reduce((a, p) => a + row[p], 0);
    return total ? row[predicted] / total : 0;
  }

  add(event: Event) {
    event.preventDefault();
    const text = this.newText.trim();
    if (!text) return;
    this.cases.update((list) => [...list, { text, expected: this.newExpected }]);
    this.newText = '';
  }

  remove(index: number) {
    this.cases.update((list) => list.filter((_, i) => i !== index));
  }

  /** Avis envoyés un par un : respecte le quota HF, et un échec n'arrête pas les autres. */
  async runAll() {
    const total = this.cases().length;
    this.running.set(true);
    this.progress.set(0);
    for (let i = 0; i < total; i++) {
      const c = this.cases()[i];
      try {
        const result = await firstValueFrom(this.api.compare(c.text));
        this.patch(i, { result, error: false });
      } catch (e: unknown) {
        this.patch(i, { result: undefined, error: true });
        if ((e as { status?: number }).status === 429) break; // quota épuisé : inutile d'insister
      }
      this.progress.set(Math.round(((i + 1) / total) * 100));
    }
    this.running.set(false);
  }

  private patch(index: number, change: Partial<CompareCase>) {
    this.cases.update((list) => list.map((c, i) => (i === index ? { ...c, ...change } : c)));
  }
}
