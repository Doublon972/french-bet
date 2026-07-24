import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'LaFrench - Draft & Paris Live',
    loadComponent: () => import('./features/draft/draft-page.component').then((m) => m.DraftPageComponent),
  },
  {
    path: 'compta',
    title: 'LaFrench - Comptabilité',
    loadComponent: () => import('./features/compta/compta-page.component').then((m) => m.ComptaPageComponent),
  },
  {
    path: 'classement',
    title: 'LaFrench - Détails du Classement',
    loadComponent: () =>
      import('./features/classement/classement-page.component').then((m) => m.ClassementPageComponent),
  },
  {
    path: 'groupes',
    title: 'LaFrench - Détails des Groupes',
    loadComponent: () => import('./features/groupes/groupes-page.component').then((m) => m.GroupesPageComponent),
  },
  {
    path: 'overlay',
    title: 'LaFrench - Overlay Stream',
    loadComponent: () => import('./features/overlay/overlay-page.component').then((m) => m.OverlayPageComponent),
  },
  { path: '**', redirectTo: '' },
];
