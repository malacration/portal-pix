import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { Receivable, ReceivablesService } from './receivables.service';

describe('ReceivablesService', () => {
    let service: ReceivablesService;
    let http: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting(), {
                provide: AppConfigService,
                useValue: { buildUrlFromHost: (host: string, path: string) => host + path }
            }]
        });
        service = TestBed.inject(ReceivablesService);
        http = TestBed.inject(HttpTestingController);
    });

    afterEach(() => http.verify());

    it('pede a selecao completa para paginar localmente e omite filtros vazios', () => {
        service.list('https://erp.example', {
            busca: ' Cliente ', empresaId: '', situacao: '', vencimentoDe: '2026-10-01', vencimentoAte: ''
        }).subscribe(page => expect(page.total).toBe(0));
        const request = http.expectOne(req => req.url === 'https://erp.example/api/contas-receber');
        expect(request.request.params.get('todos')).toBe('true');
        expect(request.request.params.has('pagina')).toBeFalse();
        expect(request.request.params.has('tamanho')).toBeFalse();
        expect(request.request.params.get('busca')).toBe('Cliente');
        expect(request.request.params.get('vencimentoDe')).toBe('2026-10-01');
        expect(request.request.params.has('empresaId')).toBeFalse();
        expect(request.request.params.has('situacao')).toBeFalse();
        expect(request.request.params.has('vencimentoAte')).toBeFalse();
        request.flush({ itens: [], total: 0 });
    });

    it('envia filtros exatos de lancamento documento e parcela', () => {
        service.list('https://erp.example', {
            busca: '', empresaId: 'FILIAL_A', situacao: '', vencimentoDe: '', vencimentoAte: '',
            lancamento: '1107684', documento: '349412', parcela: '4'
        }).subscribe();
        const request = http.expectOne(req => req.url === 'https://erp.example/api/contas-receber');
        expect(request.request.params.get('lancamento')).toBe('1107684');
        expect(request.request.params.get('documento')).toBe('349412');
        expect(request.request.params.get('parcela')).toBe('4');
        request.flush({ itens: [], total: 0 });
    });

    it('identifica a filial na cobrança e deixa o valor sob controle do backend', () => {
        service.generatePix('https://erp.example', { tituloId: 'NF/123', empresaId: 'filial-2', saldoAberto: 50 } as Receivable).subscribe();
        const request = http.expectOne('https://erp.example/api/contas-receber/NF%2F123/pix');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toEqual({ empresaId: 'filial-2' });
        request.flush({});
    });
});
