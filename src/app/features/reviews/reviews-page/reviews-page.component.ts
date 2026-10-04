import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PercentPipe } from '@angular/common';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ReviewApi } from '../../../core/api/review-api.service';
import { Review, Sentiment } from '../../../models/models';
import { SentimentBadgeComponent } from '../../../shared/sentiment-badge/sentiment-badge.component';

@Component({
  selector: 'app-reviews-page',
  standalone: true,
  imports: [FormsModule, PercentPipe, MatTableModule, MatPaginatorModule, MatSelectModule, MatFormFieldModule, MatInputModule, SentimentBadgeComponent],
  template: `
    <header class="page-heading">
      <div><span class="eyebrow">BIBLIOTHÈQUE CLIENT</span><h1>Avis clients</h1><p>Parcourez et filtrez les retours analysés.</p></div>
      <div class="heading-actions"><span class="review-count"><span class="material-icons">forum</span>{{ total() }} avis</span><a class="secondary-action" [href]="exportUrl()" download="avis.csv"><span class="material-icons">download</span>Exporter CSV</a></div>
    </header>

    <section class="filters panel">
      <div class="filter-title"><span class="material-icons">filter_list</span><strong>Filtres</strong></div>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-product">
        <mat-label>Produit</mat-label><input matInput [(ngModel)]="product" (keyup.enter)="reload()" (blur)="reload()" placeholder="Tous les produits" />
      </mat-form-field>
      <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-sentiment">
        <mat-label>Sentiment</mat-label>
        <mat-select [(ngModel)]="label" (ngModelChange)="reload()">
          <mat-option value="">Tous les sentiments</mat-option><mat-option value="POSITIVE">Positif</mat-option><mat-option value="NEUTRAL">Neutre</mat-option><mat-option value="NEGATIVE">Négatif</mat-option>
        </mat-select>
      </mat-form-field>
      <button class="reset-button" type="button" (click)="clearFilters()">Réinitialiser</button>
    </section>

    <section class="panel table-panel">
      <div class="table-heading"><div><h2>Retours analysés</h2><p>Les commentaires sont classés par sentiment et niveau de confiance.</p></div><span class="table-count">{{ rows().length }} sur {{ total() }}</span></div>
      <div class="table-scroll">
        <table mat-table [dataSource]="rows()" class="reviews-table">
          <ng-container matColumnDef="text"><th mat-header-cell *matHeaderCellDef>COMMENTAIRE</th><td mat-cell *matCellDef="let r" class="review-text" dir="auto">{{ r.text }}</td></ng-container>
          <ng-container matColumnDef="product"><th mat-header-cell *matHeaderCellDef>PRODUIT</th><td mat-cell *matCellDef="let r"><span class="product-name">{{ r.product ?? '—' }}</span></td></ng-container>
          <ng-container matColumnDef="label"><th mat-header-cell *matHeaderCellDef>SENTIMENT</th><td mat-cell *matCellDef="let r"><app-sentiment-badge [label]="r.label" /></td></ng-container>
          <ng-container matColumnDef="score"><th mat-header-cell *matHeaderCellDef>CONFIANCE</th><td mat-cell *matCellDef="let r"><span class="score-value">{{ r.score | percent: '1.0-0' }}</span></td></ng-container>
          <tr mat-header-row *matHeaderRowDef="cols"></tr><tr mat-row *matRowDef="let row; columns: cols"></tr>
          <tr class="mat-row" *matNoDataRow><td class="mat-cell empty-cell" colspan="4">Aucun avis ne correspond à ces filtres.</td></tr>
        </table>
      </div>
      <mat-paginator [length]="total()" [pageSize]="size" [pageSizeOptions]="[10, 20, 50]" (page)="onPage($event)"></mat-paginator>
    </section>
  `,
  styles: [`
    :host { display: block; }
    .heading-actions { display: flex; gap: 10px; align-items: center; }.review-count { display: flex; align-items: center; gap: 7px; padding: 8px 11px; color: #637168; background: #fff; border: 1px solid var(--line); border-radius: 5px; font-size: 11px; font-weight: 600; }.review-count .material-icons { color: var(--green); font-size: 17px; }
    .filters { display: flex; align-items: center; gap: 13px; padding: 15px 17px 2px; margin-bottom: 15px; }.filter-title { display: flex; align-items: center; gap: 7px; margin: 0 4px 13px 0; color: #66736c; font-size: 11px; }.filter-title .material-icons { font-size: 17px; }
    .filter-product { max-width: 250px; }.filter-sentiment { max-width: 210px; }.reset-button { margin: 0 0 13px auto; padding: 8px 4px; color: var(--green); background: transparent; border: 0; font-size: 10px; font-weight: 600; white-space: nowrap; }
    .table-panel { overflow: hidden; }.table-heading { display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 18px 20px; border-bottom: 1px solid var(--line); }.table-heading h2 { font-size: 14px; }.table-heading p { margin: 4px 0 0; color: var(--muted); font-size: 10px; }.table-count { color: #7c8881; font-size: 10px; white-space: nowrap; }
    .table-scroll { width: 100%; overflow-x: auto; }.reviews-table { width: 100%; min-width: 680px; background: #fff; }.reviews-table th { height: 40px; color: #929d96; background: #fafbfa; font-size: 9px; font-weight: 700; letter-spacing: .5px; }.reviews-table td { height: 60px; color: #536158; border-bottom-color: #eff2ef; font-size: 11px; }.review-text { max-width: 400px; line-height: 1.5; }.product-name { color: #67756d; }.score-value { color: #637168; font-variant-numeric: tabular-nums; }.empty-cell { padding: 30px; color: var(--muted); text-align: center; }
    @media (max-width: 650px) { .filters { align-items: stretch; flex-direction: column; gap: 0; padding: 13px 14px 0; }.filter-title { margin-bottom: 6px; }.filter-product, .filter-sentiment { max-width: none; }.reset-button { align-self: flex-end; margin: 0 0 9px; }.table-heading { padding: 15px; }.review-count { align-self: flex-start; } }
  `],
})
export class ReviewsPageComponent implements OnInit {
  private readonly api = inject(ReviewApi);
  readonly cols = ['text', 'product', 'label', 'score'];
  product = '';
  label: Sentiment | '' = '';
  page = 0;
  size = 10;
  readonly rows = signal<Review[]>([]);
  readonly total = signal(0);

  exportUrl() { return this.api.exportUrl(this.product); }

  ngOnInit() { this.reload(); }
  reload() { this.page = 0; this.fetch(); }
  clearFilters() { this.product = ''; this.label = ''; this.reload(); }
  onPage(event: PageEvent) { this.page = event.pageIndex; this.size = event.pageSize; this.fetch(); }
  private fetch() {
    this.api.list(this.product.trim(), this.label, this.page, this.size).subscribe({
      next: (page) => { this.rows.set(page.content); this.total.set(page.totalElements); },
      error: () => { this.rows.set([]); this.total.set(0); },
    });
  }
}
