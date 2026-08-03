import { Injectable, computed, inject, signal } from '@angular/core';
import { Router, type UrlTree } from '@angular/router';
import Keycloak, { type KeycloakInitOptions } from 'keycloak-js';
import { AppConfigService, type AppKeycloakConfig } from '@/app/core/config/app-config.service';

interface KeycloakTokenClaims {
    preferred_username?: string;
    name?: string;
    given_name?: string;
    email?: string;
    realm_access?: { roles?: string[] };
    resource_access?: Record<string, { roles?: string[] }>;
}

@Injectable({
    providedIn: 'root'
})
export class AuthService {
    private static readonly LOGIN_ATTEMPT_KEY = 'kc-login-attempt';

    private readonly appConfig = inject(AppConfigService);
    private readonly router = inject(Router);

    private readonly initialized = signal(false);
    private readonly authenticated = signal(false);
    private readonly initializationError = signal<string | null>(null);
    private readonly roles = signal<string[]>([]);

    private keycloak: Keycloak | null = null;
    private initPromise: Promise<void> | null = null;

    readonly isReady = this.initialized.asReadonly();
    readonly isAuthenticated = this.authenticated.asReadonly();
    readonly initError = this.initializationError.asReadonly();
    readonly userRoles = this.roles.asReadonly();
    readonly isEnabled = computed(() => this.appConfig.keycloak.enabled);
    readonly hasValidConfiguration = computed(() => this.isKeycloakConfigured(this.appConfig.keycloak));
    readonly requiresAuthentication = computed(() => this.isEnabled() && this.hasValidConfiguration());
    readonly userDisplayName = computed(() => {
        const tokenParsed = this.keycloak?.tokenParsed as KeycloakTokenClaims | undefined;

        return tokenParsed?.preferred_username
            ?? tokenParsed?.name
            ?? tokenParsed?.given_name
            ?? tokenParsed?.email
            ?? null;
    });

    hasRole(role: string): boolean {
        const normalizedRole = role.trim().toLowerCase();

        if (!normalizedRole) {
            return false;
        }

        return this.roles().some((current) => current.toLowerCase() === normalizedRole);
    }

    async init(): Promise<void> {
        if (!this.initPromise) {
            this.initPromise = this.initialize();
        }

        await this.initPromise;
    }

    async ensureAuthenticated(redirectUrl?: string): Promise<boolean | UrlTree> {
        await this.init();

        if (!this.requiresAuthentication()) {
            return true;
        }

        if (this.isAuthenticated()) {
            this.clearLoginAttempt();
            return true;
        }

        // Voltamos de uma tentativa de login e ainda nao estamos autenticados:
        // redirecionar novamente causaria um loop infinito. Interrompe e mostra o erro.
        if (this.hasPendingLoginAttempt()) {
            this.clearLoginAttempt();
            this.initializationError.set(
                'Nao foi possivel concluir o login. Verifique a configuracao do Keycloak (redirect URIs e web origins do client) e se o navegador nao esta bloqueando cookies.'
            );
            return this.router.parseUrl('/auth/error');
        }

        await this.login(redirectUrl);
        return false;
    }

    async login(redirectUrl?: string): Promise<void> {
        await this.init();

        if (!this.keycloak) {
            return;
        }

        this.markLoginAttempt();

        await this.keycloak.login({
            redirectUri: this.resolveRedirectUri(redirectUrl)
        });
    }

    async logout(): Promise<void> {
        await this.init();

        if (!this.keycloak) {
            await this.router.navigateByUrl('/auth/login');
            return;
        }

        await this.keycloak.logout({
            redirectUri: this.resolveRedirectUri('/auth/login')
        });
    }

    async getValidToken(minValiditySeconds: number = 30): Promise<string | null> {
        await this.init();

        if (!this.keycloak || !this.isAuthenticated()) {
            return null;
        }

        try {
            await this.keycloak.updateToken(minValiditySeconds);
            this.authenticated.set(this.keycloak.authenticated ?? false);
            this.roles.set(this.extractRoles());
            return this.keycloak.token ?? null;
        } catch (error) {
            console.error('Nao foi possivel renovar o token do Keycloak.', error);
            this.authenticated.set(false);
            return null;
        }
    }

    private async initialize(): Promise<void> {
        await this.appConfig.load();

        const keycloakConfig = this.appConfig.keycloak;

        if (!keycloakConfig.enabled) {
            this.initialized.set(true);
            return;
        }

        if (!this.isKeycloakConfigured(keycloakConfig)) {
            this.initializationError.set('A configuracao do Keycloak esta incompleta. Revise public/config.json.');
            this.initialized.set(true);
            return;
        }

        this.keycloak = new Keycloak({
            url: keycloakConfig.url,
            realm: keycloakConfig.realm,
            clientId: keycloakConfig.clientId
        });

        try {
            const authenticated = await this.keycloak.init(this.buildInitOptions(keycloakConfig));
            this.authenticated.set(authenticated);
            this.roles.set(this.extractRoles());

            if (authenticated) {
                this.clearLoginAttempt();
            }
        } catch (error) {
            console.error('Falha ao inicializar o Keycloak.', error);
            this.initializationError.set('Nao foi possivel inicializar a autenticacao Keycloak.');
            this.authenticated.set(false);
            this.roles.set([]);
        } finally {
            this.initialized.set(true);
        }
    }

    private markLoginAttempt(): void {
        try {
            sessionStorage.setItem(AuthService.LOGIN_ATTEMPT_KEY, String(Date.now()));
        } catch {
            // sessionStorage indisponivel (modo privado/SSR): a protecao de loop e apenas best-effort.
        }
    }

    private clearLoginAttempt(): void {
        try {
            sessionStorage.removeItem(AuthService.LOGIN_ATTEMPT_KEY);
        } catch {
            // Ignora indisponibilidade do sessionStorage.
        }
    }

    private hasPendingLoginAttempt(): boolean {
        try {
            return sessionStorage.getItem(AuthService.LOGIN_ATTEMPT_KEY) !== null;
        } catch {
            return false;
        }
    }

    private extractRoles(): string[] {
        const tokenParsed = this.keycloak?.tokenParsed as KeycloakTokenClaims | undefined;

        if (!tokenParsed) {
            return [];
        }

        const realmRoles = tokenParsed.realm_access?.roles ?? [];
        const clientRoles = Object.values(tokenParsed.resource_access ?? {}).flatMap((resource) => resource.roles ?? []);

        return Array.from(new Set([...realmRoles, ...clientRoles].filter((role): role is string => typeof role === 'string' && role.trim().length > 0)));
    }

    private buildInitOptions(config: AppKeycloakConfig): KeycloakInitOptions {
        const options: KeycloakInitOptions = {
            onLoad: config.onLoad,
            checkLoginIframe: config.checkLoginIframe,
            pkceMethod: 'S256'
        };

        if (config.silentCheckSsoRedirectUri) {
            options.silentCheckSsoRedirectUri = this.resolveRedirectUri(config.silentCheckSsoRedirectUri);
        }

        return options;
    }

    private isKeycloakConfigured(config: AppKeycloakConfig): boolean {
        return config.url.length > 0 && config.realm.length > 0 && config.clientId.length > 0;
    }

    private resolveRedirectUri(pathOrUrl?: string): string {
        if (typeof window === 'undefined') {
            return pathOrUrl ?? 'http://localhost';
        }

        if (!pathOrUrl) {
            return window.location.href;
        }

        if (/^https?:\/\//i.test(pathOrUrl)) {
            return pathOrUrl;
        }

        return new URL(pathOrUrl, window.location.origin).toString();
    }
}
