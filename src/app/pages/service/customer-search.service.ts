import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { AppConfigService } from '@/app/core/config/app-config.service';

export interface CustomerOption { id: string; nome: string; documento: string | null; }
export interface CustomerPage { itens: CustomerOption[]; total: number; }

@Injectable({ providedIn: 'root' })
export class CustomerSearchService {
    private readonly http = inject(HttpClient);
    private readonly config = inject(AppConfigService);

    search(host: string, busca: string, empresaId?: string) {
        let params = new HttpParams().set('busca', busca.trim()).set('todos', true);
        if (empresaId?.trim()) params = params.set('empresaId', empresaId.trim());
        return this.http.get<CustomerPage>(this.config.buildUrlFromHost(host, '/api/contas-receber/clientes'), { params });
    }
}
