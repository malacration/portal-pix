import { inject } from '@angular/core';
import { type CanActivateChildFn, type CanActivateFn, Router, type UrlTree } from '@angular/router';
import { AuthService } from './auth.service';

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

    return authService.ensureAuthenticated(targetUrl);
}

export const authGuard: CanActivateFn = (_route, state) => protectRoute(state.url);
export const authChildGuard: CanActivateChildFn = (_route, state) => protectRoute(state.url);
