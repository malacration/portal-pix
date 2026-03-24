import { HttpErrorResponse } from '@angular/common/http';

export interface ApiErrorResponse {
    status: number;
    error: string;
    message: string;
    path: string;
    timestamp: string;
}

function isApiErrorResponse(value: unknown): value is ApiErrorResponse {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const candidate = value as Record<string, unknown>;

    return (
        typeof candidate['status'] === 'number' &&
        typeof candidate['error'] === 'string' &&
        typeof candidate['message'] === 'string' &&
        typeof candidate['path'] === 'string' &&
        typeof candidate['timestamp'] === 'string'
    );
}

export function parseApiErrorResponse(error: HttpErrorResponse): ApiErrorResponse | null {
    if (isApiErrorResponse(error.error)) {
        return error.error;
    }

    if (typeof error.error === 'string') {
        try {
            const parsed = JSON.parse(error.error) as unknown;
            return isApiErrorResponse(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }

    return null;
}

export function getApiErrorMessage(error: HttpErrorResponse, fallbackMessage: string): string {
    const apiError = parseApiErrorResponse(error);

    if (apiError?.message?.trim()) {
        return apiError.message;
    }

    if (typeof error.error === 'string' && error.error.trim()) {
        return error.error;
    }

    if (error.message?.trim()) {
        return error.message;
    }

    return fallbackMessage;
}
