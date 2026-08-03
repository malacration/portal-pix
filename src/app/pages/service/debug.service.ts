import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { AppConfigService } from '@/app/core/config/app-config.service';

export interface Cliente {
    codigo: number;
    nome: string | null;
    nomeFantasia: string | null;
    cpfCnpj: string | null;
    municipio: string | null;
    uf: string | null;
    ativo: boolean;
}

export interface DebugArtifact {
    name: string;
    extension: string;
    sizeBytes: number;
    sizeLabel: string;
    lastModified: string;
    viewUrl: string;
    downloadUrl: string;
}

export interface DebugArtifactsResponse {
    directory: string;
    endpoint: string;
    totalFiles: number;
    files: DebugArtifact[];
}

@Injectable({
    providedIn: 'root'
})
export class DebugService {
    private readonly http = inject(HttpClient);
    private readonly appConfig = inject(AppConfigService);

    consultarPessoa(id: number, host?: string): Observable<Cliente> {
        return this.http.get<Cliente>(`${this.buildUrl('/api/debug/pessoa', host)}/${encodeURIComponent(id)}`);
    }

    getArtifacts(host?: string): Observable<DebugArtifactsResponse> {
        return this.http.get<DebugArtifactsResponse>(this.buildUrl('/api/debug/artifacts', host));
    }

    getArtifactBlob(fileName: string, host?: string): Observable<Blob> {
        const path = `${this.buildUrl('/api/debug/artifacts/files', host)}/${encodeURIComponent(fileName)}`;

        return this.http.get(path, { responseType: 'blob' });
    }

    private buildUrl(path: string, host?: string): string {
        return host ? this.appConfig.buildUrlFromHost(host, path) : this.appConfig.buildBackendUrl(path);
    }
}
