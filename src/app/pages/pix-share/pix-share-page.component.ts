import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, computed, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { firstValueFrom, interval, startWith } from 'rxjs';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { PixService, TransactionPaymentConsultationResponse } from '../service/pix.service';

interface PixSharePayloadInput {
    txId?: unknown;
    qrCode?: unknown;
    valor?: unknown;
    vencimento?: unknown;
    nome?: unknown;
    system?: unknown;
}

interface PixSharePayload {
    txId: string;
    qrCode: string;
    valor: number | null;
    vencimento: string | null;
    vencimentoDate: Date | null;
    nome: string | null;
    nomeFavorecido: string | null;
    system: string | null;
    paid: boolean;
    paymentDate: Date | null;
    paymentStatus: string | null;
}

interface PixShareState {
    payload: PixSharePayload | null;
    error: string | null;
    loading: boolean;
}

@Component({
    selector: 'app-pix-share-page',
    standalone: true,
    host: {
        class: 'pix-share-page-host'
    },
    imports: [CommonModule, CurrencyPipe, DatePipe, QRCodeComponent],
    templateUrl: './pix-share-page.component.html'
})
export class PixSharePageComponent {
    private readonly route = inject(ActivatedRoute);
    private readonly title = inject(Title);
    private readonly appConfig = inject(AppConfigService);
    private readonly pixService = inject(PixService);
    private readonly textDecoder = new TextDecoder();

    protected readonly isHomologation = this.appConfig.isHomologation;

    protected readonly state = signal<PixShareState>({
        payload: null,
        error: null,
        loading: true
    });
    protected readonly now = signal(Date.now());
    protected readonly copyFeedback = signal<'idle' | 'success' | 'error'>('idle');

    protected readonly loading = computed(() => this.state().loading);
    protected readonly payload = computed(() => this.state().payload);
    protected readonly errorMessage = computed(() => this.state().error);
    protected readonly favorecidoNome = computed(() => {
        const payload = this.payload();

        if (!payload) {
            return null;
        }

        return payload.nomeFavorecido
            ?? this.appConfig.findSystemByName(payload.system)?.nomeFavorecido
            ?? null;
    });
    protected readonly isPaid = computed(() => this.payload()?.paid ?? false);
    protected readonly vencimento = computed(() => this.payload()?.vencimentoDate ?? null);
    protected readonly isExpired = computed(() => {
        if (this.isPaid()) {
            return false;
        }

        const dueDate = this.vencimento();
        return dueDate ? dueDate.getTime() <= this.now() : false;
    });
    protected readonly statusLabel = computed(() => {
        if (this.isPaid()) {
            return 'Pagamento ja realizado';
        }

        const dueDate = this.vencimento();

        if (!dueDate) {
            return 'Sem vencimento informado';
        }

        return this.isExpired() ? 'Pagamento expirado' : 'Aguardando pagamento';
    });
    protected readonly countdownLabel = computed(() => {
        if (this.isPaid()) {
            return 'Pagamento confirmado';
        }

        const dueDate = this.vencimento();

        if (!dueDate) {
            return 'Sem prazo definido';
        }

        const diff = dueDate.getTime() - this.now();

        if (diff <= 0) {
            return `Expirado ha ${this.formatDuration(Math.abs(diff))}`;
        }

        return this.formatDuration(diff);
    });

    constructor() {
        this.title.setTitle('Pagamento Pix');

        this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
            this.copyFeedback.set('idle');
            void this.loadPayment(params);
        });

        interval(1000)
            .pipe(startWith(0), takeUntilDestroyed())
            .subscribe(() => {
                this.now.set(Date.now());
            });
    }

    protected async copyQrCode(): Promise<void> {
        const qrCode = this.payload()?.qrCode?.trim();

        if (!qrCode) {
            this.copyFeedback.set('error');
            return;
        }

        try {
            await navigator.clipboard.writeText(qrCode);
            this.copyFeedback.set('success');
        } catch {
            this.copyFeedback.set('error');
        }

        setTimeout(() => {
            this.copyFeedback.set('idle');
        }, 2500);
    }
    private async loadPayment(params: ParamMap): Promise<void> {
        const resolvedState = this.resolveState(params);

        if (!resolvedState.payload) {
            this.state.set({
                payload: null,
                error: resolvedState.error,
                loading: false
            });
            return;
        }

        const host = this.resolveHost(resolvedState.payload.system);
        this.state.set({
            payload: null,
            error: null,
            loading: true
        });

        try {
            const verifiedPayment = await firstValueFrom(
                this.pixService.verifySharedPayment(
                    {
                        txId: resolvedState.payload.txId,
                        qrCode: resolvedState.payload.qrCode,
                        valor: resolvedState.payload.valor,
                        vencimento: resolvedState.payload.vencimento
                    },
                    host
                )
            );
            const verifiedPayload = this.normalizeVerifiedPayload(verifiedPayment, resolvedState.payload.system);
            this.title.setTitle(verifiedPayload?.nomeFavorecido ? `Pagamento Pix - ${verifiedPayload.nomeFavorecido}` : 'Pagamento Pix');

            this.state.set({
                payload: verifiedPayload,
                error: verifiedPayload ? null : 'Nao foi possivel confirmar os dados do pagamento.',
                loading: false
            });
        } catch (error) {
            this.state.set({
                payload: null,
                error: `Falha ao validar o PIX. ${this.getVerificationError(error)}`,
                loading: false
            });
        }
    }

    private resolveState(params: ParamMap): PixShareState {
        const rawPayload = this.getPayloadParam(params);

        if (rawPayload) {
            return this.parseJsonState(rawPayload);
        }

        const directPayload = this.parseDirectQueryParams(params);

        if (directPayload) {
            return {
                payload: directPayload,
                error: null,
                loading: false
            };
        }

        return {
            payload: null,
            error: 'Nenhum pagamento foi informado na URL.',
            loading: false
        };
    }

    private getPayloadParam(params: ParamMap): string | null {
        for (const key of ['data', 'payload', 'pix']) {
            const value = params.get(key);

            if (value?.trim()) {
                return value.trim();
            }
        }

        return null;
    }

    private parseJsonState(rawPayload: string): PixShareState {
        for (const candidate of this.getJsonCandidates(rawPayload)) {
            try {
                const parsed = JSON.parse(candidate) as PixSharePayloadInput;
                const payload = this.normalizePayload(parsed);

                if (payload) {
                    return {
                        payload,
                        error: null,
                        loading: false
                    };
                }
            } catch {
                // Tenta o proximo formato possivel.
            }
        }

        return {
            payload: null,
            error: 'O payload do pagamento esta invalido. Envie um JSON valido em ?data=...',
            loading: false
        };
    }

    private getJsonCandidates(rawPayload: string): string[] {
        const candidates: string[] = [];

        // Preferencial: base64 (formato padrao de geracao de links)
        const base64Decoded = this.tryDecodeBase64(rawPayload);
        if (base64Decoded) {
            candidates.push(base64Decoded);
        }

        // URL-decodificado e depois base64
        try {
            const urlDecoded = decodeURIComponent(rawPayload);

            if (urlDecoded !== rawPayload) {
                const base64FromUrl = this.tryDecodeBase64(urlDecoded);

                if (base64FromUrl && base64FromUrl !== base64Decoded) {
                    candidates.push(base64FromUrl);
                }
            }
        } catch { /* ignore */ }

        // Fallback: JSON puro
        candidates.push(rawPayload);

        // Fallback: JSON URL-decodificado
        try {
            const urlDecoded = decodeURIComponent(rawPayload);

            if (urlDecoded !== rawPayload) {
                candidates.push(urlDecoded);
            }
        } catch { /* ignore */ }

        return candidates;
    }

    private tryDecodeBase64(value: string): string | null {
        try {
            // Suporta base64 URL-safe (- → +, _ → /)
            const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
            const paddingNeeded = (4 - (normalized.length % 4)) % 4;
            const padded = normalized + '='.repeat(paddingNeeded);
            const binary = atob(padded);
            const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

            try {
                return this.textDecoder.decode(bytes);
            } catch {
                return binary;
            }
        } catch {
            return null;
        }
    }

    private parseDirectQueryParams(params: ParamMap): PixSharePayload | null {
        if (!params.has('txId') || !params.has('qrCode')) {
            return null;
        }

        return this.normalizePayload({
            txId: params.get('txId'),
            qrCode: params.get('qrCode'),
            valor: params.get('valor'),
            vencimento: params.get('vencimento'),
            nome: params.get('nome'),
            system: params.get('system')
        });
    }

    private normalizePayload(input: PixSharePayloadInput): PixSharePayload | null {
        const txId = this.normalizeString(input.txId);
        const qrCode = this.normalizeString(input.qrCode);

        if (!txId || !qrCode) {
            return null;
        }

        const vencimento = this.normalizeString(input.vencimento);
        const vencimentoDate = vencimento ? this.normalizeDate(vencimento) : null;

        return {
            txId,
            qrCode,
            valor: this.normalizeNumber(input.valor),
            vencimento,
            vencimentoDate,
            nome: this.normalizeString(input.nome),
            nomeFavorecido: null,
            system: this.normalizeString(input.system),
            paid: false,
            paymentDate: null,
            paymentStatus: null
        };
    }

    private normalizeVerifiedPayload(payment: TransactionPaymentConsultationResponse, systemName: string | null): PixSharePayload | null {
        const txId = this.normalizeString(payment.txId);
        const qrCode = this.normalizeString(payment.qrCode);

        if (!txId || !qrCode) {
            return null;
        }

        const vencimento = this.normalizeString(payment.expiracaoEm);
        const paymentDateValue = this.normalizeString(payment.paymentDate);

        return {
            txId,
            qrCode,
            valor: this.normalizeAmount(payment.originalAmount) ?? this.normalizeAmount(payment.valor),
            vencimento,
            vencimentoDate: vencimento ? this.normalizeDate(vencimento) : null,
            nome: this.normalizeString(payment.nomeRecebedor),
            nomeFavorecido: this.normalizeString(payment.nomeFavorecido),
            system: systemName,
            paid: Boolean(payment.paid),
            paymentDate: paymentDateValue ? this.normalizeDate(paymentDateValue) : null,
            paymentStatus: this.normalizeString(payment.status)
        };
    }

    private resolveHost(systemName: string | null): string | undefined {
        return this.appConfig.findSystemByName(systemName)?.host;
    }

    private getVerificationError(error: unknown): string {
        if (error instanceof HttpErrorResponse) {
            const message = error.error?.message;

            if (typeof message === 'string' && message.trim()) {
                return message;
            }
        }

        if (error instanceof Error && error.message.trim()) {
            return error.message;
        }

        return 'Nao foi possivel confirmar o pagamento informado.';
    }

    private normalizeString(value: unknown): string | null {
        if (typeof value !== 'string') {
            return null;
        }

        const trimmedValue = value.trim();
        return trimmedValue ? trimmedValue : null;
    }

    private normalizeAmount(value: unknown): number | null {
        const parsed = this.normalizeNumber(value);
        return parsed && parsed !== 0 ? parsed : null;
    }

    private normalizeNumber(value: unknown): number | null {
        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }

        if (typeof value !== 'string') {
            return null;
        }

        const trimmedValue = value.trim();

        if (!trimmedValue) {
            return null;
        }

        const normalizedValue = trimmedValue.includes(',') && trimmedValue.includes('.')
            ? trimmedValue.replace(/\./g, '').replace(',', '.')
            : trimmedValue.replace(',', '.');
        const parsedValue = Number(normalizedValue);

        return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    private normalizeDate(value: string): Date | null {
        const normalizedValue = value.trim();

        if (!normalizedValue) {
            return null;
        }

        const timezoneAwareValue = this.ensureTimezone(normalizedValue);
        const parsedDate = new Date(timezoneAwareValue);
        return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    }

    private ensureTimezone(value: string): string {
        const hasExplicitTimezone = /(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value);
        const isIsoDateTime = /^\d{4}-\d{2}-\d{2}T/.test(value);

        if (hasExplicitTimezone || !isIsoDateTime) {
            return value;
        }

        return `${value}Z`;
    }

    private formatDuration(milliseconds: number): string {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const days = Math.floor(totalSeconds / 86400);
        const hours = Math.floor((totalSeconds % 86400) / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;

        const parts: string[] = [];

        if (days > 0) {
            parts.push(`${days}d`);
        }

        parts.push(`${hours.toString().padStart(2, '0')}h`);
        parts.push(`${minutes.toString().padStart(2, '0')}m`);
        parts.push(`${seconds.toString().padStart(2, '0')}s`);

        return parts.join(' ');
    }
}
