import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { PixTransactionType } from '@/app/core/models/pix-transaction-type';

export interface TransactionDocument {
    id?: string | null;
    idLancamento?: string | number | null;
    tipoTransacao?: PixTransactionType | null;
    status?: string | null;
    statusTituloRef?: string | null;
    statusTitulo?: string | null;
    txId?: string | null;
    reference?: string | null;
    empresa?: string | null;
    empresaCod?: string | number | null;
    clienteNome?: string | null;
    clienteCodigo?: string | number | null;
    valor?: number | string | null;
    descricao?: string | null;
    numeroParcela?: number | string | null;
    vencimentoTitulo?: string | null;
    pixGeradoEm?: string | null;
    pixExpiraEm?: string | null;
    qrCode?: string | null;
    qrCodeBase64?: string | null;
    cnpjContaRecebimento?: string | null;
    chavePixRecebimento?: string | null;
    nomeTitularContaRecebimento?: string | null;
    createdAt?: string | null;
    [key: string]: unknown;
}

@Injectable({
    providedIn: 'root'
})
export class TransactionsService {
    private readonly http = inject(HttpClient);
    private readonly appConfig = inject(AppConfigService);

    getTransactions(host?: string): Observable<TransactionDocument[]> {
        return this.http.get<TransactionDocument[]>(this.getEndpoint(host));
    }

    getTransaction(id: string, host?: string): Observable<TransactionDocument> {
        return this.http.get<TransactionDocument>(`${this.getEndpoint(host)}/${encodeURIComponent(id)}`);
    }

    getTransactionsByStatus(status: string, host?: string): Observable<TransactionDocument[]> {
        return this.http.get<TransactionDocument[]>(`${this.getEndpoint(host)}/status/${encodeURIComponent(status)}`);
    }

    retrySettlement(id: string, host?: string): Observable<TransactionDocument> {
        return this.http.post<TransactionDocument>(`${this.getEndpoint(host)}/${encodeURIComponent(id)}/retry-settlement`, {});
    }

    private getEndpoint(host?: string): string {
        return host ? this.appConfig.buildUrlFromHost(host, '/api/transactions') : this.appConfig.buildBackendUrl('/api/transactions');
    }
}
