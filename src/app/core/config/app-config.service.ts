import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, map, of, tap } from 'rxjs';

export interface AppConfig {
    backendHost: string;
}

const DEFAULT_APP_CONFIG: AppConfig = {
    backendHost: 'http://localhost:8080'
};

@Injectable({
    providedIn: 'root'
})
export class AppConfigService {
    private readonly http = inject(HttpClient);
    private readonly config = signal<AppConfig>(DEFAULT_APP_CONFIG);

    async load(): Promise<void> {
        await firstValueFrom(
            this.http.get<Partial<AppConfig>>('/config').pipe(
                map((response) => this.normalizeConfig(response)),
                tap((config) => this.config.set(config)),
                catchError((error) => {
                    console.error('Nao foi possivel carregar /config. Aplicando configuracao padrao.', error);
                    this.config.set(DEFAULT_APP_CONFIG);
                    return of(DEFAULT_APP_CONFIG);
                })
            )
        );
    }

    get value(): AppConfig {
        return this.config();
    }

    get backendHost(): string {
        return this.config().backendHost;
    }

    buildBackendUrl(path: string): string {
        const normalizedHost = this.backendHost.replace(/\/+$/, '');
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;

        return `${normalizedHost}${normalizedPath}`;
    }

    private normalizeConfig(config: Partial<AppConfig> | null | undefined): AppConfig {
        const backendHost = config?.backendHost?.trim() || DEFAULT_APP_CONFIG.backendHost;

        return {
            backendHost
        };
    }
}
