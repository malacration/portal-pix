import { inject } from '@angular/core';
import { type CanActivateChildFn, type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

// OAuth2 params appended by Keycloak on redirect-back. If included in the redirect_uri sent
// to keycloak.login(), Keycloak will append *new* params on top of the old ones. Keycloak.js
// then reads the first (expired) code, the exchange fails, and the cycle repeats forever.
const OAUTH_CALLBACK_PARAMS = ['code', 'state', 'session_state', 'iss'];

function stripOAuthCallbackParams(url: string): string {
    try {
        const parsed = new URL(url, 'http://placeholder');
        OAUTH_CALLBACK_PARAMS.forEach((p) => parsed.searchParams.delete(p));
        const search = parsed.searchParams.size > 0 ? parsed.search : '';
        return parsed.pathname + search;
    } catch {
        return url;
    }
}

async function protectRoute(targetUrl: string): Promise<boolean | UrlTree> {
    const authService = inject(AuthService);
    const router = inject(Router);

    await authService.init();

    if (!authService.isEnabled()) {
        return true;
    }

    if (!authService.hasValidConfiguration()) {
        return router.parseUrl('/auth/error');
    }

    return authService.ensureAuthenticated(stripOAuthCallbackParams(targetUrl));
}

export const authGuard: CanActivateFn = (_route, state) => protectRoute(state.url);
export const authChildGuard: CanActivateChildFn = (_route, state) => protectRoute(state.url);
