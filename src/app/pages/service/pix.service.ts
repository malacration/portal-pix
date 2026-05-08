import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { PixTransactionType } from '@/app/core/models/pix-transaction-type';
import { TransactionDocument } from '@/app/pages/service/transactions.service';

export interface BranchOption {
    id: string;
    label: string;
}

export interface PixGenerationResponse {
    txId: string;
    tipoTransacao?: PixTransactionType | null;
    status: string;
    valor: number;
    descricao: string;
    nomeRecebedor: string;
    qrCode: string;
    qrCodeBase64: string;
    expiracaoEm: string;
    documento?: TransactionDocument | null;
}

export interface TransactionPaymentConsultationResponse {
    txId: string;
    tipoTransacao?: PixTransactionType | null;
    originalAmount?: number | string | null;
    paid?: boolean | null;
    paymentDate?: string | null;
    paymentType?: string | null;
    receivedAmount?: number | string | null;
    status?: string | null;
    valor?: number | string | null;
    descricao?: string | null;
    nomeRecebedor?: string | null;
    nomeFavorecido?: string | null;
    qrCode?: string | null;
    qrCodeBase64?: string | null;
    expiracaoEm?: string | null;
}

export interface PixClienteAdvanceRequest {
    idCliente: string;
    branchId: string;
    valor: number | null;
}

export interface PixShareVerificationRequest {
    txId: string;
    qrCode?: string | null;
    valor?: number | null;
    vencimento?: string | null;
}

@Injectable({
    providedIn: 'root'
})
export class PixService {
    private readonly http = inject(HttpClient);
    private readonly appConfig = inject(AppConfigService);

    generatePix(id: string, host?: string): Observable<PixGenerationResponse> {
        return this.http.get<PixGenerationResponse>(`${this.getPaymentEndpoint(host)}/${encodeURIComponent(id)}`);
    }

    generateClienteAdvancePix(payload: PixClienteAdvanceRequest, host?: string): Observable<PixGenerationResponse> {
        return this.http.post<PixGenerationResponse>(this.getClienteAdvanceEndpoint(host), payload);
    }

    getBranches(host?: string): Observable<BranchOption[]> {
        return this.http.get<BranchOption[]>(this.getBranchEndpoint(host));
    }

    consultTransactionPayment(id: string, host?: string): Observable<TransactionPaymentConsultationResponse> {
        return this.http.get<TransactionPaymentConsultationResponse>(`${this.getTransactionEndpoint(host)}/${encodeURIComponent(id)}`);
    }

    verifySharedPayment(payload: PixShareVerificationRequest, host?: string): Observable<TransactionPaymentConsultationResponse> {
        return this.http.post<TransactionPaymentConsultationResponse>(this.getShareVerificationEndpoint(host), payload);
    }

    private getPaymentEndpoint(host?: string): string {
        return this.buildUrl('/pix/pagamento', host);
    }

    private getTransactionEndpoint(host?: string): string {
        return this.buildUrl('/pix/transaction', host);
    }

    private getShareVerificationEndpoint(host?: string): string {
        return this.buildUrl('/pix/share/verify', host);
    }

    private getClienteAdvanceEndpoint(host?: string): string {
        return this.buildUrl('/pix/adiantamento', host);
    }

    private getBranchEndpoint(host?: string): string {
        return this.buildUrl('/branch', host);
    }

    private buildUrl(path: string, host?: string): string {
        return host ? this.appConfig.buildUrlFromHost(host, path) : this.appConfig.buildBackendUrl(path);
    }
}
