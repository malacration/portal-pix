import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AppTopbar } from './app.topbar';
import { AppFooter } from './app.footer';
import { AppConfigService } from '@/app/core/config/app-config.service';

@Component({
    selector: 'app-layout',
    standalone: true,
    imports: [CommonModule, AppTopbar, RouterModule, AppFooter],
    template: `
        <div class="layout-wrapper">
            <app-topbar></app-topbar>
            <div class="layout-main-container">
                <div class="layout-main">
                    <router-outlet></router-outlet>
                </div>
                <app-footer></app-footer>
            </div>
        </div>
        @if (isHomologation()) {
            <div class="homolog-ribbon" aria-hidden="true">Homologação</div>
        }
    `,
    styles: [`
        .homolog-ribbon {
            position: fixed;
            top: 26px;
            right: -38px;
            width: 170px;
            padding: 6px 0;
            background: #d97706;
            color: #fff;
            font-size: 0.68rem;
            font-weight: 800;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.12em;
            transform: rotate(45deg);
            z-index: 9999;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.28);
            pointer-events: none;
            user-select: none;
        }
    `]
})
export class AppLayout {
    private readonly appConfig = inject(AppConfigService);
    readonly isHomologation = this.appConfig.isHomologation;
}
