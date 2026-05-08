import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { LOCALE_ID, ApplicationConfig, inject, provideAppInitializer, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation, withInMemoryScrolling } from '@angular/router';
import Aura from '@primeuix/themes/aura';
import { MessageService } from 'primeng/api';
import { providePrimeNG } from 'primeng/config';
import { AuthService } from './app/core/auth/auth.service';
import { AppConfigService } from './app/core/config/app-config.service';
import { authTokenInterceptor } from './app/core/interceptors/auth-token.interceptor';
import { httpErrorInterceptor } from './app/core/interceptors/http-error.interceptor';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
    providers: [
        { provide: LOCALE_ID, useValue: 'pt-BR' },
        provideRouter(appRoutes, withInMemoryScrolling({ anchorScrolling: 'enabled', scrollPositionRestoration: 'enabled' }), withEnabledBlockingInitialNavigation()),
        provideHttpClient(withFetch(), withInterceptors([authTokenInterceptor, httpErrorInterceptor])),
        provideZonelessChangeDetection(),
        providePrimeNG({ theme: { preset: Aura, options: { darkModeSelector: '.app-dark' } } }),
        provideAppInitializer(() => inject(AppConfigService).load()),
        provideAppInitializer(() => inject(AuthService).init()),
        MessageService
    ]
};
