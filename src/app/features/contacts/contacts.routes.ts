import { Routes } from '@angular/router';

/** P15 — Danh bạ (chỉ xem). */
export const contactsRoutes: Routes = [
    { path: '', loadComponent: () => import('./components/contacts/contacts').then(m => m.Contacts) },
];
