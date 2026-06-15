import { Routes } from '@angular/router';
import { authChildGuard } from './app/core/auth/auth.guard';
import { roleGuard } from './app/core/auth/role.guard';
import { AppLayout } from './app/layout/component/app.layout';
import { Documentation } from './app/pages/documentation/documentation';
import { Landing } from './app/pages/landing/landing';
import { Notfound } from './app/pages/notfound/notfound';
import { Debug } from './app/pages/debug/debug';
import { Pix } from './app/pages/pix/pix';
import { PixSharePageComponent } from './app/pages/pix-share/pix-share-page.component';
import { Transactions } from './app/pages/transactions/transactions';

export const appRoutes: Routes = [
    { path: 'pix/share', component: PixSharePageComponent },
    {
        path: '',
        component: AppLayout,
        canActivateChild: [authChildGuard],
        children: [
            { path: '', component: Pix },
            { path: 'pix', component: Pix },
            { path: 'transactions', component: Transactions },
            { path: 'debug', component: Debug, canActivate: [roleGuard('debug')] },
            { path: 'uikit', loadChildren: () => import('./app/pages/uikit/uikit.routes') },
            { path: 'documentation', component: Documentation },
            { path: 'pages', loadChildren: () => import('./app/pages/pages.routes') }
        ]
    },
    { path: 'landing', component: Landing },
    { path: 'notfound', component: Notfound },
    { path: 'auth', loadChildren: () => import('./app/pages/auth/auth.routes') },
    { path: '**', redirectTo: '/notfound' }
];
