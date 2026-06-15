import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export function roleGuard(role: string): CanActivateFn {
    return async () => {
        const authService = inject(AuthService);
        const router = inject(Router);

        await authService.init();

        if (authService.hasRole(role)) {
            return true;
        }

        return router.parseUrl('/notfound');
    };
}
