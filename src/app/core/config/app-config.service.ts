import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { catchError, firstValueFrom, map, of, tap } from 'rxjs';
import { PixTransactionType, inferPixTransactionTypeFromComponent } from '@/app/core/models/pix-transaction-type';

export interface AppSystemOperationConfig {
    nome: string;
    componente: string;
    tipoTransacao: PixTransactionType;
}

export interface AppSystemConfig {
    nome: string;
    host: string;
    cnpjFavorecido: string | null;
    nomeFavorecido: string | null;
    valoresSistema: Record<string, string>;
    operacoes: AppSystemOperationConfig[];
}

export interface AppKeycloakConfig {
    enabled: boolean;
    url: string;
    realm: string;
    clientId: string;
    onLoad: 'check-sso' | 'login-required';
    silentCheckSsoRedirectUri: string | null;
    checkLoginIframe: boolean;
    bearerExcludedUrls: string[];
}

export interface AppConfig {
    backendHost: string;
    ambiente: string;
    sistemas: AppSystemConfig[];
    keycloak: AppKeycloakConfig;
}

const DEFAULT_BACKEND_HOST = 'http://localhost:8080';
const DEFAULT_KEYCLOAK_CONFIG: AppKeycloakConfig = {
    enabled: false,
    url: '',
    realm: '',
    clientId: '',
    onLoad: 'login-required',
    silentCheckSsoRedirectUri: null,
    checkLoginIframe: false,
    bearerExcludedUrls: ['/config', '/config.json']
};

const DEFAULT_APP_CONFIG: AppConfig = {
    backendHost: DEFAULT_BACKEND_HOST,
    ambiente: 'production',
    keycloak: DEFAULT_KEYCLOAK_CONFIG,
    sistemas: [
        {
            nome: 'dealerworkflow',
            host: DEFAULT_BACKEND_HOST,
            cnpjFavorecido: null,
            nomeFavorecido: null,
            valoresSistema: {},
            operacoes: [
                {
                    nome: 'Pix Contas a Receber',
                    componente: 'pixContasReceber',
                    tipoTransacao: 'CONTAS_RECEBER'
                },
                {
                    nome: 'Adiantamento Cliente',
                    componente: 'adiantamentoCliente',
                    tipoTransacao: 'ADIANTAMENTO'
                }
            ]
        }
    ]
};

@Injectable({
    providedIn: 'root'
})
export class AppConfigService {
    private static readonly CONFIG_URLS = ['/config.json', '/config'] as const;

    private readonly http = inject(HttpClient);
    private readonly config = signal<AppConfig>(DEFAULT_APP_CONFIG);
    private loadPromise: Promise<void> | null = null;

    async load(): Promise<void> {
        if (!this.loadPromise) {
            this.loadPromise = firstValueFrom(
                this.requestConfig().pipe(
                    map((response) => this.normalizeConfig(response)),
                    tap((config) => this.config.set(config)),
                    catchError((error) => {
                        console.error(`Nao foi possivel carregar ${AppConfigService.CONFIG_URLS.join(' ou ')}. Aplicando configuracao padrao.`, error);
                        this.config.set(DEFAULT_APP_CONFIG);
                        return of(DEFAULT_APP_CONFIG);
                    }),
                    map(() => undefined)
                )
            );
        }

        await this.loadPromise;
    }

    get value(): AppConfig {
        return this.config();
    }

    get backendHost(): string {
        return this.config().backendHost;
    }

    get ambiente(): string {
        return this.config().ambiente;
    }

    get systems(): AppSystemConfig[] {
        return this.config().sistemas;
    }

    get keycloak(): AppKeycloakConfig {
        return this.config().keycloak;
    }

    readonly isHomologation = computed(() => this.config().ambiente === 'homologation');

    findSystemByName(systemName: string | null | undefined): AppSystemConfig | null {
        const normalizedSystemName = typeof systemName === 'string' ? systemName.trim() : '';

        if (!normalizedSystemName) {
            return null;
        }

        return this.systems.find((system) => system.nome === normalizedSystemName) ?? null;
    }

    buildBackendUrl(path: string): string {
        return this.buildUrlFromHost(this.backendHost, path);
    }

    buildUrlFromHost(host: string, path: string): string {
        const normalizedHost = host.replace(/\/+$/, '');
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;

        return `${normalizedHost}${normalizedPath}`;
    }

    shouldAttachBearerToken(requestUrl: string): boolean {
        if (!this.keycloak.enabled) {
            return false;
        }

        const normalizedUrl = requestUrl.trim();

        if (!normalizedUrl) {
            return false;
        }

        if (this.keycloak.bearerExcludedUrls.some((pattern) => this.matchesUrlPattern(normalizedUrl, pattern))) {
            return false;
        }

        return this.resolveProtectedHosts().some((host) => normalizedUrl.startsWith(host));
    }

    private requestConfig() {
        return this.http.get<Partial<AppConfig>>(AppConfigService.CONFIG_URLS[0]).pipe(
            catchError(() => this.http.get<Partial<AppConfig>>(AppConfigService.CONFIG_URLS[1]))
        );
    }

    private normalizeConfig(config: Partial<AppConfig> | null | undefined): AppConfig {
        const backendHost = config?.backendHost?.trim() || DEFAULT_APP_CONFIG.backendHost;
        const ambiente = typeof config?.ambiente === 'string' ? config.ambiente.trim() : '';
        const sistemas = this.normalizeSystems(config?.sistemas, backendHost);
        const keycloak = this.normalizeKeycloak(config && typeof config === 'object' ? (config as Record<string, unknown>)['keycloak'] : undefined);

        return {
            backendHost,
            ambiente,
            sistemas,
            keycloak
        };
    }

    private normalizeKeycloak(rawKeycloak: unknown): AppKeycloakConfig {
        if (!rawKeycloak || typeof rawKeycloak !== 'object' || Array.isArray(rawKeycloak)) {
            return { ...DEFAULT_KEYCLOAK_CONFIG };
        }

        const keycloak = rawKeycloak as Record<string, unknown>;
        const onLoad = keycloak['onLoad'] === 'login-required' ? 'login-required' : DEFAULT_KEYCLOAK_CONFIG.onLoad;
        const silentCheckSsoRedirectUri = typeof keycloak['silentCheckSsoRedirectUri'] === 'string'
            ? keycloak['silentCheckSsoRedirectUri'].trim() || null
            : DEFAULT_KEYCLOAK_CONFIG.silentCheckSsoRedirectUri;

        return {
            enabled: Boolean(keycloak['enabled']),
            url: typeof keycloak['url'] === 'string' ? keycloak['url'].trim() : DEFAULT_KEYCLOAK_CONFIG.url,
            realm: typeof keycloak['realm'] === 'string' ? keycloak['realm'].trim() : DEFAULT_KEYCLOAK_CONFIG.realm,
            clientId: typeof keycloak['clientId'] === 'string' ? keycloak['clientId'].trim() : DEFAULT_KEYCLOAK_CONFIG.clientId,
            onLoad,
            silentCheckSsoRedirectUri,
            checkLoginIframe: typeof keycloak['checkLoginIframe'] === 'boolean' ? keycloak['checkLoginIframe'] : DEFAULT_KEYCLOAK_CONFIG.checkLoginIframe,
            bearerExcludedUrls: this.normalizeBearerExcludedUrls(keycloak['bearerExcludedUrls'])
        };
    }

    private normalizeBearerExcludedUrls(rawValue: unknown): string[] {
        if (!Array.isArray(rawValue)) {
            return [...DEFAULT_KEYCLOAK_CONFIG.bearerExcludedUrls];
        }

        const values = rawValue
            .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
            .filter((entry) => entry.length > 0);

        return values.length ? values : [...DEFAULT_KEYCLOAK_CONFIG.bearerExcludedUrls];
    }

    private normalizeSystems(rawSystems: unknown, fallbackHost: string): AppSystemConfig[] {
        if (!Array.isArray(rawSystems)) {
            return this.buildFallbackSystems(fallbackHost);
        }

        const sistemas = rawSystems
            .map((rawSystem, index) => this.normalizeSystem(rawSystem, index, fallbackHost))
            .filter((system): system is AppSystemConfig => system !== null);

        return sistemas.length ? sistemas : this.buildFallbackSystems(fallbackHost);
    }

    private normalizeSystem(rawSystem: unknown, index: number, fallbackHost: string): AppSystemConfig | null {
        if (!rawSystem || typeof rawSystem !== 'object') {
            return null;
        }

        const system = rawSystem as Record<string, unknown>;
        const nome = typeof system['nome'] === 'string' ? system['nome'].trim() || `sistema-${index + 1}` : `sistema-${index + 1}`;
        const host = typeof system['host'] === 'string' ? system['host'].trim() || fallbackHost : fallbackHost;
        const operacoes = this.normalizeOperations(system['operacoes'], nome);

        if (!operacoes.length) {
            return null;
        }

        return {
            nome,
            host,
            cnpjFavorecido: typeof system['cnpjFavorecido'] === 'string' ? system['cnpjFavorecido'].trim() || null : null,
            nomeFavorecido: typeof system['nomeFavorecido'] === 'string' ? system['nomeFavorecido'].trim() || null : null,
            valoresSistema: this.normalizeValoresSistema(system['valoresSistema']),
            operacoes
        };
    }

    private normalizeValoresSistema(raw: unknown): Record<string, string> {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return {};
        }

        const result: Record<string, string> = {};

        for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
            if (value !== null && value !== undefined) {
                result[key] = String(value);
            }
        }

        return result;
    }

    private normalizeOperations(rawOperations: unknown, systemName: string): AppSystemOperationConfig[] {
        if (!Array.isArray(rawOperations)) {
            return [];
        }

        return rawOperations
            .map((rawOperation, index) => this.normalizeOperation(rawOperation, systemName, index))
            .filter((operation): operation is AppSystemOperationConfig => operation !== null);
    }

    private normalizeOperation(rawOperation: unknown, systemName: string, index: number): AppSystemOperationConfig | null {
        if (!rawOperation || typeof rawOperation !== 'object') {
            return null;
        }

        const operation = rawOperation as Partial<AppSystemOperationConfig>;
        const componente = operation.componente?.trim();

        if (!componente) {
            return null;
        }

        return {
            nome: operation.nome?.trim() || `${systemName} - operacao ${index + 1}`,
            componente,
            tipoTransacao: this.normalizeTransactionType(operation.tipoTransacao, componente)
        };
    }

    private normalizeTransactionType(rawValue: unknown, componentName: string): PixTransactionType {
        if (typeof rawValue === 'string') {
            const normalizedValue = rawValue.trim().toUpperCase();

            if (
                normalizedValue === 'CONTAS_RECEBER' ||
                normalizedValue === 'ADIANTAMENTO' ||
                normalizedValue === 'ORCAMENTO' ||
                normalizedValue === 'PEDIDO'
            ) {
                return normalizedValue;
            }
        }

        return inferPixTransactionTypeFromComponent(componentName);
    }

    private buildFallbackSystems(fallbackHost: string): AppSystemConfig[] {
        return DEFAULT_APP_CONFIG.sistemas.map((system) => ({
            ...system,
            host: fallbackHost,
            operacoes: system.operacoes.map((operation) => ({ ...operation }))
        }));
    }

    private resolveProtectedHosts(): string[] {
        const hosts = new Set<string>([
            this.backendHost,
            ...this.systems.map((system) => system.host)
        ]);

        return Array.from(hosts)
            .map((host) => host.trim().replace(/\/+$/, ''))
            .filter((host) => host.length > 0);
    }

    private matchesUrlPattern(requestUrl: string, pattern: string): boolean {
        const normalizedPattern = pattern.trim();

        if (!normalizedPattern) {
            return false;
        }

        if (/^https?:\/\//i.test(normalizedPattern)) {
            return requestUrl.startsWith(normalizedPattern.replace(/\/+$/, ''));
        }

        try {
            const request = new URL(requestUrl, this.resolveBrowserOrigin());
            return request.pathname.startsWith(normalizedPattern.startsWith('/') ? normalizedPattern : `/${normalizedPattern}`);
        } catch {
            return requestUrl.startsWith(normalizedPattern);
        }
    }

    private resolveBrowserOrigin(): string {
        if (typeof window !== 'undefined' && window.location.origin) {
            return window.location.origin;
        }

        return 'http://localhost';
    }
}
