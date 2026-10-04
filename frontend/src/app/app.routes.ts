// src/app/app.routes.ts

import { Routes } from '@angular/router';
import { guestGuard, roleGuard } from './core/auth/auth.guards';

/** Données affichées dans la barre du haut (fil d'Ariane) pour chaque page du back-office. */
export interface PageData {
  section: string;
  title: string;
}

export const routes: Routes = [
  // ---------- Public ----------
  {
    path: 'login',
    title: 'Connexion · SentiShop',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page.component').then((m) => m.LoginPageComponent),
  },
  {
    path: 'register',
    title: 'Créer un compte · SentiShop',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register-page.component').then((m) => m.RegisterPageComponent),
  },

  // ---------- Espace client ----------
  {
    path: 'espace',
    canActivate: [roleGuard('CLIENT')],
    loadComponent: () => import('./layouts/client-layout/client-layout.component').then((m) => m.ClientLayoutComponent),
    children: [
      {
        path: '',
        title: 'Mes avis · SentiShop',
        loadComponent: () => import('./features/client/client-space.component').then((m) => m.ClientSpaceComponent),
      },
      {
        path: 'profil',
        title: 'Mon profil · SentiShop',
        loadComponent: () => import('./features/profile/profile-page.component').then((m) => m.ProfilePageComponent),
      },
    ],
  },

  // ---------- Back-office administrateur ----------
  {
    path: '',
    canActivate: [roleGuard('ADMIN')],
    loadComponent: () => import('./layouts/admin-layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
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
      {
        path: 'products',
        title: 'Produits · SentiShop',
        data: { section: 'Gestion', title: 'Produits' } satisfies PageData,
        loadComponent: () => import('./features/products/products-page.component').then((m) => m.ProductsPageComponent),
      },
      {
        path: 'profile',
        title: 'Mon profil · SentiShop',
        data: { section: 'Compte', title: 'Mon profil' } satisfies PageData,
        loadComponent: () => import('./features/profile/profile-page.component').then((m) => m.ProfilePageComponent),
      },
      {
        path: 'users',
        title: 'Utilisateurs · SentiShop',
        data: { section: 'Gestion', title: 'Utilisateurs' } satisfies PageData,
        loadComponent: () => import('./features/users/users-page.component').then((m) => m.UsersPageComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
