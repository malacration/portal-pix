import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '@/app/core/config/app-config.service';

export interface TransactionDocument {
    id?: string | null;
    idLancamento?: string | number | null;
    txId?: string | null;
    reference?: string | null;
    empresa?: string | null;
    empresaCod?: string | number | null;
    clienteNome?: string | null;
    clienteCodigo?: string | number | null;
    valor?: number | string | null;
    statusTitulo?: string | null;
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

    getTransactions(): Observable<TransactionDocument[]> {
        return this.http.get<TransactionDocument[]>(this.getEndpoint());
    }

    getTransaction(id: string): Observable<TransactionDocument> {
        return this.http.get<TransactionDocument>(`${this.getEndpoint()}/${encodeURIComponent(id)}`);
    }

    getTransactionsByStatus(status: string): Observable<TransactionDocument[]> {
        return this.http.get<TransactionDocument[]>(`${this.getEndpoint()}/status/${encodeURIComponent(status)}`);
    }

    private getEndpoint(): string {
        return this.appConfig.buildBackendUrl('/api/transactions');
    }
}
