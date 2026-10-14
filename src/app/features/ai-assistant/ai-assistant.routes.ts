import { Routes } from '@angular/router';

/** P14 — Trợ lý AI theo cuộc họp. */
export const aiAssistantRoutes: Routes = [
    { path: '', loadComponent: () => import('./components/ai-assistant/ai-assistant').then(m => m.AiAssistant) },
];
