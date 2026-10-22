import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { CustomerSearchService } from './customer-search.service';

describe('CustomerSearchService', () => {
    it('busca clientes sem enviar os filtros de filial e data dos titulos', () => {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), {
            provide: AppConfigService, useValue: { buildUrlFromHost: (host: string, path: string) => host + path }
        }] });
        const service = TestBed.inject(CustomerSearchService);
        const http = TestBed.inject(HttpTestingController);
        service.search('https://dealer.example', ' Cielo ').subscribe();
        const req = http.expectOne(request => request.url === 'https://dealer.example/api/contas-receber/clientes');
        expect(req.request.params.get('busca')).toBe('Cielo');
        expect(req.request.params.has('empresaId')).toBeFalse();
        expect(req.request.params.has('vencimentoDe')).toBeFalse();
        expect(req.request.params.has('vencimentoAte')).toBeFalse();
        req.flush({ itens: [], total: 0 });
        service.search('https://dealer.example', 'Cielo', 'FILIAL_A').subscribe();
        const selected = http.expectOne(request => request.url === 'https://dealer.example/api/contas-receber/clientes');
        expect(selected.request.params.get('empresaId')).toBe('FILIAL_A');
        expect(selected.request.params.has('vencimentoDe')).toBeFalse();
        selected.flush({ itens: [], total: 0 });
        http.verify();
    });
});
