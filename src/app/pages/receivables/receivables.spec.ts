import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { BranchOption, PixService } from '../service/pix.service';
import { ReceivablesService } from '../service/receivables.service';
import { Receivables } from './receivables';

describe('Receivables branch selection', () => {
    let pix: jasmine.SpyObj<PixService>;
    let service: jasmine.SpyObj<ReceivablesService>;
    let component: Receivables;

    beforeEach(() => {
        pix = jasmine.createSpyObj('PixService', ['getBranches']);
        service = jasmine.createSpyObj('ReceivablesService', ['list']);
        service.list.and.returnValue(of({ itens: [], total: 0 }));
        TestBed.configureTestingModule({ providers: [
            { provide: PixService, useValue: pix },
            { provide: ReceivablesService, useValue: service },
            { provide: AppConfigService, useValue: { systems: [
                { nome: 'A', host: 'https://a.example', operacoes: [{ tipoTransacao: 'CONTAS_RECEBER' }] },
                { nome: 'B', host: 'https://b.example', operacoes: [{ tipoTransacao: 'CONTAS_RECEBER' }] }
            ] } }
        ] });
        component = TestBed.runInInjectionContext(() => new Receivables());
    });

    it('explica todos os filtros ausentes e libera a consulta conforme sao preenchidos', () => {
        component.branches.set([{ id: 'FILIAL_A', label: 'A' }]);
        component.filters.vencimentoDe = '';
        component.filters.vencimentoAte = '';
        expect(component.searchBlockReasons.length).toBe(3);
        expect(component.searchBlockReasons.join(' ')).toContain('filial é obrigatória');
        expect(component.searchBlockReasons.join(' ')).toContain('vencimento inicial');
        expect(component.searchBlockReasons.join(' ')).toContain('vencimento final');
        component.filters.empresaId = 'FILIAL_A';
        component.filters.vencimentoDe = '2026-10-01';
        component.filters.vencimentoAte = '2026-10-31';
        expect(component.searchBlockReasons.join(' ')).toContain('30 dias');
        component.filters.vencimentoAte = '2026-10-30';
        expect(component.searchBlockReasons).toEqual([]);
        component.filters.vencimentoAte = '2026-09-30';
        expect(component.searchBlockReasons.join(' ')).toContain('anterior ou igual');
        expect(service.list).not.toHaveBeenCalled();
    });

    it('orientacao respeita ID e CPF e permite periodo livre com cliente informado', () => {
        component.branches.set([{ id: 'FILIAL_A', label: 'A' }]);
        component.customerSearchMode = 'id';
        component.customerIdChanged('4.5');
        expect(component.searchBlockReasons.join(' ')).toContain('ID de cliente inteiro');
        component.customerIdChanged('4');
        expect(component.searchBlockReasons).toEqual([]);
        component.customerSearchMode = 'document';
        component.customerSearchModeChanged();
        component.selectCustomer({ id: '4', nome: 'Cielo', documento: '12345678900' });
        component.filters.vencimentoDe = '2020-01-01';
        component.filters.vencimentoAte = '2026-12-31';
        expect(component.searchBlockReasons).toEqual([]);
        expect(service.list).not.toHaveBeenCalled();
    });

    it('explica bloqueio durante carregamento consulta Pix e falta de acesso a filiais', () => {
        expect(component.searchBlockReasons.join(' ')).toContain('permissões');
        component.branchesLoading.set(true);
        expect(component.searchBlockReasons.join(' ')).toContain('carregamento das filiais');
        component.branchesLoading.set(false);
        component.branchesError.set('Falha de comunicação');
        expect(component.searchBlockReasons.join(' ')).toContain('Atualizar');
        component.loading.set(true);
        expect(component.searchBlockReasons.join(' ')).toContain('consulta de títulos terminar');
        component.generatingKey.set('titulo');
        expect(component.searchBlockReasons.join(' ')).toContain('geração do Pix');
    });

    it('envia lancamento documento e parcela juntos e remove ao limpar filtros', () => {
        component.branches.set([{ id: 'FILIAL_A', label: 'A' }]);
        component.filters.empresaId = 'FILIAL_A';
        component.filters.lancamento = '1107684';
        component.filters.documento = '349412';
        component.filters.parcela = '4';
        expect(component.searchBlockReasons).toEqual([]);
        component.search();
        expect(service.list).toHaveBeenCalledWith('https://a.example', jasmine.objectContaining({
            lancamento: '1107684', documento: '349412', parcela: '4'
        }));
        component.clear();
        expect(component.filters.lancamento).toBe('');
        expect(component.filters.documento).toBe('');
        expect(component.filters.parcela).toBe('');
        expect(service.list).toHaveBeenCalledTimes(1);
    });

    it('orienta e impede consulta com identificadores invalidos', () => {
        component.branches.set([{ id: 'FILIAL_A', label: 'A' }]);
        component.filters.empresaId = 'FILIAL_A';
        component.filters.lancamento = '1.5';
        component.filters.documento = '-4';
        component.filters.parcela = '0';
        expect(component.searchBlockReasons.length).toBe(3);
        expect(component.searchBlockReasons.join(' ')).toContain('lançamento');
        expect(component.searchBlockReasons.join(' ')).toContain('documento');
        expect(component.searchBlockReasons.join(' ')).toContain('parcela');
        component.search();
        expect(service.list).not.toHaveBeenCalled();
    });

    it('exibe o codigo do cliente sem decimais e preserva identificadores alfanumericos', () => {
        expect(component.formatClienteId('4.00')).toBe('4');
        expect(component.formatClienteId(4)).toBe('4');
        expect(component.formatClienteId('4,00')).toBe('4');
        expect(component.formatClienteId('4.90')).toBe('4');
        expect(component.formatClienteId('cliente-4')).toBe('cliente-4');
        expect(component.formatClienteId('9007199254740993')).toBe('9007199254740993');
    });

    it('selecionar cliente limpa datas automaticas e remover restaura o periodo sem consultar', () => {
        const start = component.filters.vencimentoDe;
        const end = component.filters.vencimentoAte;
        component.selectCustomer({ id: '4', nome: 'Cielo', documento: null });
        expect(component.filters.vencimentoDe).toBe('');
        expect(component.filters.vencimentoAte).toBe('');
        component.selectCustomer(null);
        expect(component.filters.vencimentoDe).toBe(start);
        expect(component.filters.vencimentoAte).toBe(end);
        expect(service.list).not.toHaveBeenCalled();
    });

    it('mantem datas editadas ao selecionar e remover cliente', () => {
        component.filters.vencimentoDe = '2026-10-10';
        component.filters.vencimentoAte = '2026-10-15';
        component.datesChanged();
        component.selectCustomer({ id: '4', nome: 'Cielo', documento: null });
        expect(component.filters.vencimentoDe).toBe('2026-10-10');
        expect(component.filters.vencimentoAte).toBe('2026-10-15');
        component.selectCustomer(null);
        expect(component.filters.vencimentoDe).toBe('2026-10-10');
        expect(component.filters.vencimentoAte).toBe('2026-10-15');
    });

    it('cliente selecionado permite consultar sem datas', () => {
        pix.getBranches.and.returnValue(of([{ id: 'FILIAL_A', label: 'A' }]));
        component.ngOnInit();
        component.selectCustomer({ id: '4', nome: 'Cielo', documento: null });
        component.search();
        expect(component.error()).toBe('');
        expect(service.list.calls.mostRecent().args[1].clienteId).toBe('4');
        expect(service.list.calls.mostRecent().args[1].vencimentoDe).toBe('');
        expect(service.list.calls.mostRecent().args[1].vencimentoAte).toBe('');
    });

    it('aplica ID conhecido sem selecionar pessoa e consulta todas as filiais sem datas', () => {
        pix.getBranches.and.returnValue(of([{ id: 'FILIAL_A', label: 'A' }, { id: 'FILIAL_B', label: 'B' }]));
        component.ngOnInit();
        component.customerSearchMode = 'id';
        component.customerIdQuery = ' 00123625 ';
        component.customerIdChanged(component.customerIdQuery);
        expect(service.list).not.toHaveBeenCalled();
        expect(component.selectedCustomer).toBeNull();
        expect(component.hasCustomer).toBeTrue();
        expect(component.filters.clienteId).toBe('123625');
        expect(component.customerIdQuery).toBe(' 00123625 ');
        component.search();
        expect(component.error()).toBe('');
        expect(service.list).toHaveBeenCalledWith('https://a.example', jasmine.objectContaining({
            clienteId: '123625', empresaId: '', vencimentoDe: '', vencimentoAte: ''
        }));
    });

    it('consultar usa o ID digitado e preserva datas alteradas pelo operador', () => {
        component.branches.set([{ id: 'FILIAL_A', label: 'A' }]);
        component.customerSearchMode = 'id';
        component.customerIdQuery = '4';
        component.filters.vencimentoDe = '2020-01-01';
        component.filters.vencimentoAte = '2026-12-31';
        component.datesChanged();
        component.search();
        expect(service.list).toHaveBeenCalledWith('https://a.example', jasmine.objectContaining({
            clienteId: '4', vencimentoDe: '2020-01-01', vencimentoAte: '2026-12-31'
        }));
    });

    it('rejeita ID fracionado negativo zero texto ou maior que o limite do backend', () => {
        component.branches.set([{ id: 'FILIAL_A', label: 'A' }]);
        component.customerSearchMode = 'id';
        for (const id of ['0', '-4', '4.00', '4.5', 'abc', '2147483648']) {
            component.customerIdQuery = id;
            component.search();
            expect(component.hasCustomer).toBeFalse();
            expect(component.error()).toContain('ID de cliente inteiro');
        }
        expect(service.list).not.toHaveBeenCalled();
    });

    it('permite alterar e apagar o ID diretamente sem confirmacao ou consulta automatica', () => {
        const start = component.filters.vencimentoDe;
        component.customerIdChanged('4');
        expect(component.filters.clienteId).toBe('4');
        component.customerIdChanged('123625');
        expect(component.filters.clienteId).toBe('123625');
        component.customerIdChanged('');
        expect(component.filters.clienteId).toBe('');
        expect(component.filters.vencimentoDe).toBe(start);
        expect(service.list).not.toHaveBeenCalled();
    });

    it('limpar ID restaura datas e trocar modo remove ID sem consultar', () => {
        const start = component.filters.vencimentoDe;
        const end = component.filters.vencimentoAte;
        component.customerSearchMode = 'id';
        component.customerIdQuery = '4';
        component.customerIdChanged(component.customerIdQuery);
        component.resetCustomer();
        expect(component.customerIdQuery).toBe('');
        expect(component.filters.vencimentoDe).toBe(start);
        expect(component.filters.vencimentoAte).toBe(end);
        component.customerIdQuery = '123625';
        component.customerIdChanged(component.customerIdQuery);
        component.customerSearchMode = 'document';
        component.customerSearchModeChanged();
        expect(component.filters.clienteId).toBe('');
        expect(component.customerIdQuery).toBe('');
        expect(component.hasCustomer).toBeFalse();
        expect(service.list).not.toHaveBeenCalled();
    });

    it('pagina os titulos carregados sem consultar novamente o backend', () => {
        pix.getBranches.and.returnValue(of([{ id: 'FILIAL_A', label: 'A' }]));
        component.ngOnInit();
        component.paginate({ first: 20, rows: 20 });
        component.paginate({ first: 40, rows: 20 });
        expect(service.list).toHaveBeenCalledTimes(1);
        expect(component.first).toBe(40);
        component.refresh();
        expect(service.list).toHaveBeenCalledTimes(2);
        expect(component.first).toBe(0);
    });

    it('envia o codigo exato do cliente selecionado e limpa a selecao ao trocar o contexto', () => {
        pix.getBranches.and.returnValue(of([{ id: 'FILIAL_A', label: 'A' }]));
        component.ngOnInit();
        component.selectCustomer({ id: '4', nome: 'Cielo', documento: null });
        component.search();
        expect(service.list.calls.mostRecent().args[1].clienteId).toBe('4');
        component.resetCustomer();
        expect(component.filters.clienteId).toBe('');
        expect(component.selectedCustomer).toBeNull();
    });

    it('preenche 30 dias e nao consulta sem filial ou com periodo maior que 30 dias', () => {
        const days = (Date.parse(component.filters.vencimentoAte) - Date.parse(component.filters.vencimentoDe)) / 86_400_000;
        expect(days).toBe(29);
        pix.getBranches.and.returnValue(of([{ id: 'FILIAL_A', label: 'A' }, { id: 'FILIAL_B', label: 'B' }]));
        component.ngOnInit();
        expect(service.list).not.toHaveBeenCalled();
        component.search();
        expect(component.error()).toContain('filial');
        component.filters.empresaId = 'FILIAL_A';
        component.filters.vencimentoDe = '2026-10-01';
        component.filters.vencimentoAte = '2026-10-31';
        component.search();
        expect(service.list).not.toHaveBeenCalled();
        expect(component.error()).toContain('30 dias');
        component.filters.vencimentoAte = '2026-10-30';
        component.search();
        expect(service.list).toHaveBeenCalled();
        component.clear();
        expect(component.filters.empresaId).toBe('');
        expect((Date.parse(component.filters.vencimentoAte) - Date.parse(component.filters.vencimentoDe)) / 86_400_000).toBe(29);
    });

    it('limpa cliente e resultados sem consultar novamente e descarta resposta pendente', () => {
        const pending = new Subject<{ itens: []; total: number }>();
        service.list.and.returnValue(pending);
        pix.getBranches.and.returnValue(of([{ id: 'FILIAL_A', label: 'A' }]));
        component.ngOnInit();
        component.selectCustomer({ id: '4', nome: 'Cielo', documento: null });
        const reset = component.customerResetKey;
        component.clear();
        expect(component.selectedCustomer).toBeNull();
        expect(component.filters.clienteId).toBe('');
        expect(component.customerResetKey).toBeGreaterThan(reset);
        expect(service.list).toHaveBeenCalledTimes(1);
        pending.next({ itens: [], total: 100 });
        expect(component.total()).toBe(0);
        expect(component.loading()).toBeFalse();
    });

    it('cliente selecionado permite qualquer periodo e todas as filiais sem perder a selecao', () => {
        pix.getBranches.and.returnValue(of([{ id: 'FILIAL_A', label: 'A' }, { id: 'FILIAL_B', label: 'B' }]));
        component.ngOnInit();
        component.selectCustomer({ id: '4', nome: 'Cielo', documento: null });
        component.filters.empresaId = '';
        component.filters.vencimentoDe = '2020-01-01';
        component.filters.vencimentoAte = '2026-12-31';
        component.search();
        expect(component.error()).toBe('');
        expect(service.list.calls.mostRecent().args[1].clienteId).toBe('4');
        expect(service.list.calls.mostRecent().args[1].empresaId).toBe('');
        expect(component.selectedCustomer?.id).toBe('4');
    });

    it('usa as filiais do adiantamento e envia o ID cadastrado sem converter no frontend', () => {
        pix.getBranches.and.returnValue(of([{ id: 'FILIAL_A', label: 'Filial A' }]));
        component.ngOnInit();
        expect(pix.getBranches).toHaveBeenCalledWith('https://a.example');
        expect(component.filters.empresaId).toBe('FILIAL_A');
        expect(service.list.calls.mostRecent().args[1].empresaId).toBe('FILIAL_A');
        component.clear();
        expect(component.filters.empresaId).toBe('FILIAL_A');
    });

    it('descarta resposta atrasada das filiais ao trocar o sistema', () => {
        const first = new Subject<BranchOption[]>();
        const second = new Subject<BranchOption[]>();
        pix.getBranches.and.returnValues(first, second);
        component.ngOnInit();
        component.systemName = 'B';
        component.systemChanged();
        second.next([{ id: 'FILIAL_B', label: 'Filial B' }]);
        first.next([{ id: 'FILIAL_A', label: 'Filial A' }]);
        expect(component.branches()[0].id).toBe('FILIAL_B');
        expect(service.list.calls.mostRecent().args[0]).toBe('https://b.example');
        expect(service.list.calls.mostRecent().args[1].empresaId).toBe('FILIAL_B');
    });

    it('nao consulta titulos se filiais falharem e permite tentar novamente', () => {
        pix.getBranches.and.returnValues(throwError(() => new Error('indisponivel')), of([{ id: 'FILIAL_A', label: 'Filial A' }]));
        component.ngOnInit();
        expect(service.list).not.toHaveBeenCalled();
        expect(component.branchesError()).toBeTruthy();
        component.refresh();
        expect(component.branchesError()).toBe('');
        expect(service.list).toHaveBeenCalled();
    });
});
