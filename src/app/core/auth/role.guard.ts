import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export function roleGuard(role: string | string[]): CanActivateFn {
    const roles = Array.isArray(role) ? role : [role];

    return async () => {
        const authService = inject(AuthService);
        const router = inject(Router);

        await authService.init();

        if (roles.some((currentRole) => authService.hasRole(currentRole))) {
            return true;
        }

        return router.parseUrl('/notfound');
    };
}
