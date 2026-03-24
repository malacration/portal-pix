import { Routes } from '@angular/router';
import { Documentation } from './documentation/documentation';
import { Crud } from './crud/crud';
import { Empty } from './empty/empty';
import { Pix } from './pix/pix';
import { Transactions } from './transactions/transactions';

export default [
    { path: 'documentation', component: Documentation },
    { path: 'crud', component: Crud },
    { path: 'pix', component: Pix },
    { path: 'transactions', component: Transactions },
    { path: 'empty', component: Empty },
    { path: '**', redirectTo: '/notfound' }
] as Routes;
