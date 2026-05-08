import { Component, computed, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { RippleModule } from 'primeng/ripple';
import { AuthService } from '@/app/core/auth/auth.service';
import { AppFloatingConfigurator } from '../../layout/component/app.floatingconfigurator';

@Component({
    selector: 'app-error',
    imports: [ButtonModule, RippleModule, RouterModule, AppFloatingConfigurator],
    standalone: true,
    template: ` <app-floating-configurator />
        <div class="bg-surface-50 dark:bg-surface-950 flex items-center justify-center min-h-screen min-w-screen overflow-hidden">
            <div class="flex flex-col items-center justify-center">
                <div style="border-radius: 56px; padding: 0.3rem; background: linear-gradient(180deg, rgba(233, 30, 99, 0.4) 10%, rgba(33, 150, 243, 0) 30%)">
                    <div class="w-full bg-surface-0 dark:bg-surface-900 py-20 px-8 sm:px-20 flex flex-col items-center" style="border-radius: 53px">
                        <div class="gap-4 flex flex-col items-center text-center">
                            <div class="flex justify-center items-center border-2 border-pink-500 rounded-full" style="height: 3.2rem; width: 3.2rem">
                                <i class="pi pi-fw pi-exclamation-circle text-2xl! text-pink-500"></i>
                            </div>
                            <h1 class="text-surface-900 dark:text-surface-0 font-bold text-5xl mb-2">Falha na autenticação</h1>
                            <span class="text-muted-color mb-2">Não foi possível concluir a inicialização do Keycloak.</span>
                            <p class="text-sm text-surface-600 dark:text-surface-300 max-w-xl m-0">{{ detailMessage() }}</p>
                            <img src="https://primefaces.org/cdn/templates/sakai/auth/asset-error.svg" alt="Erro" class="mb-8 mt-4" width="80%" />
                            <div class="col-span-12 mt-8 text-center flex flex-col sm:flex-row gap-3">
                                <p-button label="Tentar login" routerLink="/auth/login" severity="danger" />
                                <p-button label="Voltar" routerLink="/" severity="secondary" [outlined]="true" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>`
})
export class Error {
    private readonly authService = inject(AuthService);

    protected readonly detailMessage = computed(() => this.authService.initError() ?? 'Revise a seção keycloak em public/config.json e confirme url, realm e clientId.');
}
