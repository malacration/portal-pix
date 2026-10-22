import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { PixGenerationResponse } from './pix.service';

export type ReceivableStatus = 'ABERTO' | 'PARCIAL' | 'PAGO' | 'CANCELADO';

export interface Receivable {
    tituloId: string;
    empresaId: string;
    empresaNome: string;
    documento: string;
    parcela: string | null;
    clienteId: string;
    clienteNome: string;
    clienteDocumento: string | null;
    emissao: string | null;
    vencimento: string;
    valorOriginal: number;
    saldoAberto: number;
    situacao: ReceivableStatus;
    podeGerarPix: boolean;
}

export interface ReceivableFilters {
    clienteId?: string;
    lancamento?: string;
    documento?: string;
    parcela?: string;
    busca: string;
    empresaId: string;
    situacao: ReceivableStatus | '';
    vencimentoDe: string;
    vencimentoAte: string;
}

export interface ReceivablesPage {
    itens: Receivable[];
    total: number;
}

@Injectable({ providedIn: 'root' })
export class ReceivablesService {
    private readonly http = inject(HttpClient);
    private readonly config = inject(AppConfigService);

    list(host: string, filters: ReceivableFilters) {
        let params = new HttpParams().set('todos', true);
        for (const [key, value] of Object.entries(filters)) {
            if (value?.trim()) params = params.set(key, value.trim());
        }
        return this.http.get<ReceivablesPage>(this.config.buildUrlFromHost(host, '/api/contas-receber'), { params });
    }

    generatePix(host: string, title: Receivable) {
        return this.http.post<PixGenerationResponse>(
            this.config.buildUrlFromHost(host, `/api/contas-receber/${encodeURIComponent(title.tituloId)}/pix`),
            { empresaId: title.empresaId }
        );
    }
}
