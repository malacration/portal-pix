import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '@/app/core/config/app-config.service';

export interface PixGenerationResponse {
    txId: string;
    status: string;
    valor: number;
    descricao: string;
    nomeRecebedor: string;
    qrCode: string;
    qrCodeBase64: string;
    expiracaoEm: string;
}

export interface TransactionPaymentConsultationResponse {
    txId: string;
    originalAmount?: number | string | null;
    paid?: boolean | null;
    paymentDate?: string | null;
    paymentType?: string | null;
    receivedAmount?: number | string | null;
    status?: string | null;
    valor?: number | string | null;
    descricao?: string | null;
    nomeRecebedor?: string | null;
    qrCode?: string | null;
    qrCodeBase64?: string | null;
    expiracaoEm?: string | null;
}

@Injectable({
    providedIn: 'root'
})
export class PixService {
    private readonly http = inject(HttpClient);
    private readonly appConfig = inject(AppConfigService);

    generatePix(id: string): Observable<PixGenerationResponse> {
        return this.http.get<PixGenerationResponse>(`${this.getPaymentEndpoint()}/${encodeURIComponent(id)}`);
    }

    consultTransactionPayment(id: string): Observable<TransactionPaymentConsultationResponse> {
        return this.http.get<TransactionPaymentConsultationResponse>(`${this.getTransactionEndpoint()}/${encodeURIComponent(id)}`);
    }

    private getPaymentEndpoint(): string {
        return this.appConfig.buildBackendUrl('/api/pix/pagamento');
    }

    private getTransactionEndpoint(): string {
        return this.appConfig.buildBackendUrl('/api/pix/transaction');
    }
}
