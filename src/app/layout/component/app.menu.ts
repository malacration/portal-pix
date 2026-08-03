import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MenuItem } from 'primeng/api';
import { AuthService } from '@/app/core/auth/auth.service';
import { AppMenuitem } from './app.menuitem';

const DEBUG_ROLE = 'debug';
const ADMIN_ROLE = 'ADMIN';

@Component({
    selector: 'app-menu',
    standalone: true,
    imports: [CommonModule, AppMenuitem, RouterModule],
    template: `<ul class="layout-menu">
        @for (item of model(); track item.label) {
            @if (!item.separator) {
                <li app-menuitem [item]="item" [root]="true"></li>
            } @else {
                <li class="menu-separator"></li>
            }
        }
    </ul> `,
})
export class AppMenu {
    private readonly authService = inject(AuthService);

    readonly model = computed<MenuItem[]>(() => {
        const items: MenuItem[] = [
            {
                label: 'Operacao',
                items: [
                    {
                        label: 'Gerar PIX',
                        icon: 'pi pi-fw pi-qrcode',
                        routerLink: ['/pix']
                    },
                    {
                        label: 'Transactions',
                        icon: 'pi pi-fw pi-receipt',
                        routerLink: ['/transactions']
                    }
                ]
            }
        ];

        if (this.authService.hasRole(DEBUG_ROLE) || this.authService.hasRole(ADMIN_ROLE)) {
            items.push({
                label: 'Diagnostico',
                items: [
                    {
                        label: 'Debug',
                        icon: 'pi pi-fw pi-wrench',
                        routerLink: ['/debug']
                    }
                ]
            });
        }

        return items;
    });
}
