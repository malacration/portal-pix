import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { LOCALE_ID, ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import Aura from '@primeuix/themes/aura';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { AppConfigService } from './app/core/config/app-config.service';
import { httpErrorInterceptor } from './app/core/interceptors/http-error.interceptor';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
    providers: [
        { provide: LOCALE_ID, useValue: 'pt-BR' },
        provideRouter(appRoutes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }), withEnabledBlockingInitialNavigation()),
        provideHttpClient(withFetch(), withInterceptors([httpErrorInterceptor])),
        provideZonelessChangeDetection(),
        providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } }),
        provideAppInitializer(() => inject(AppConfigService).load()),
        MessageService
    ]
};
