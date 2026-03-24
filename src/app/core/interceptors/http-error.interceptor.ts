import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { MessageService } from 'primeng/api';
import { catchError, throwError } from 'rxjs';
import { getApiErrorMessage } from '@/app/pages/service/api-error-response';

const DEFAULT_HTTP_ERROR_MESSAGE = 'Nao foi possivel concluir a requisicao.';

export const httpErrorInterceptor: HttpInterceptorFn = (request, next) => {
    const messageService = inject(MessageService);

    return next(request).pipe(
        catchError((error: unknown) => {
            if (error instanceof HttpErrorResponse) {
                messageService.add({
                    severity: 'error',
                    summary: `Erro ${error.status || ''}`.trim(),
                    detail: getApiErrorMessage(error, DEFAULT_HTTP_ERROR_MESSAGE),
                    life: 6000
                });
            } else {
                messageService.add({
                    severity: 'error',
                    summary: 'Erro',
                    detail: DEFAULT_HTTP_ERROR_MESSAGE,
                    life: 6000
                });
            }

            return throwError(() => error);
        })
    );
};
