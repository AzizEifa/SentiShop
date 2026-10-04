// src/app/app.routes.ts

import { Routes } from '@angular/router';

/** Données affichées dans la barre du haut (fil d'Ariane) pour chaque page. */
export interface PageData {
  section: string;
  title: string;
}

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'dashboard',
    title: "Vue d'ensemble · SentiShop",
    data: { section: 'Pilotage', title: "Vue d'ensemble" } satisfies PageData,
    loadComponent: () =>
      import('./features/dashboard/dashboard-page/dashboard-page.component').then((m) => m.DashboardPageComponent),
  },
  {
    path: 'reviews',
    title: 'Avis clients · SentiShop',
    data: { section: 'Pilotage', title: 'Avis clients' } satisfies PageData,
    loadComponent: () =>
      import('./features/reviews/reviews-page/reviews-page.component').then((m) => m.ReviewsPageComponent),
  },
  {
    path: 'analyze',
    title: 'Analyser un avis · SentiShop',
    data: { section: 'Analyse', title: 'Analyser un avis' } satisfies PageData,
    loadComponent: () =>
      import('./features/analyze/analyze-page/analyze-page.component').then((m) => m.AnalyzePageComponent),
  },
  {
    path: 'import',
    title: 'Importer des avis · SentiShop',
    data: { section: 'Analyse', title: 'Importer des avis' } satisfies PageData,
    loadComponent: () =>
      import('./features/import/import-page/import-page.component').then((m) => m.ImportPageComponent),
  },
  {
    path: 'compare',
    title: 'Comparer les modèles · SentiShop',
    data: { section: 'Laboratoire', title: 'Comparer les modèles' } satisfies PageData,
    loadComponent: () =>
      import('./features/compare/compare-page/compare-page.component').then((m) => m.ComparePageComponent),
  },
  { path: '**', redirectTo: 'dashboard' },
];
