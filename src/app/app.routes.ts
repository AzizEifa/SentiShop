// src/app/app.routes.ts

import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import(
        './features/dashboard/dashboard-page/dashboard-page.component'
      ).then((m) => m.DashboardPageComponent),
  },
  {
    path: 'analyze',
    loadComponent: () =>
      import('./features/analyze/analyze-page/analyze-page.component').then(
        (m) => m.AnalyzePageComponent
      ),
  },
  {
    path: 'import',
    loadComponent: () =>
      import('./features/import/import-page/import-page.component').then(
        (m) => m.ImportPageComponent
      ),
  },
  {
    path: 'reviews',
    loadComponent: () =>
      import('./features/reviews/reviews-page/reviews-page.component').then(
        (m) => m.ReviewsPageComponent
      ),
  },
  {
    path: 'compare',
    loadComponent: () =>
      import('./features/compare/compare-page/compare-page.component').then(
        (m) => m.ComparePageComponent
      ),
  },
  { path: '**', redirectTo: 'dashboard' },
];