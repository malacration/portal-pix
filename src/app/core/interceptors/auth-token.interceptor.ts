import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { AuthService } from '@/app/core/auth/auth.service';
import { AppConfigService } from '@/app/core/config/app-config.service';

export const authTokenInterceptor: HttpInterceptorFn = (request, next) => {
    const authService = inject(AuthService);
    const appConfig = inject(AppConfigService);

    if (request.headers.has('Authorization') || !appConfig.shouldAttachBearerToken(request.url)) {
        return next(request);
    }

    return from(authService.getValidToken()).pipe(
        switchMap((token) => {
            if (!token) {
                return next(request);
            }

            return next(
                request.clone({
                    setHeaders: {
                        Authorization: `Bearer ${token}`
                    }
                })
            );
        })
    );
};
