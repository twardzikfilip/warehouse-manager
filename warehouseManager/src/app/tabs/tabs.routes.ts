import { Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

export const routes: Routes = [
  {
    path: 'tabs',
    component: TabsPage,
    children: [
      {
        path: 'scan',
        loadComponent: () =>
          import('../pages/scan/scan.page').then((m) => m.ScanPage),
      },
      {
        path: 'list',
        loadComponent: () =>
          import('../pages/list/list.page').then((m) => m.ListPage),
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('../pages/dashboard/dashboard.page').then((m) => m.DashboardPage),
      },
      {
        path: '',
        redirectTo: '/tabs/scan',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: '',
    redirectTo: '/tabs/scan',
    pathMatch: 'full',
  },
];
