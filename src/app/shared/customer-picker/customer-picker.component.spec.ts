import { TestBed } from '@angular/core/testing';
import { SimpleChange } from '@angular/core';
import { Subject, of } from 'rxjs';
import { CustomerPage, CustomerSearchService } from '@/app/pages/service/customer-search.service';
import { CustomerPickerComponent } from './customer-picker.component';

describe('CustomerPickerComponent', () => {
    let service: jasmine.SpyObj<CustomerSearchService>;
    let component: CustomerPickerComponent;
    beforeEach(() => {
        service = jasmine.createSpyObj('CustomerSearchService', ['search']);
        service.search.and.returnValue(of({ itens: [], total: 0 }));
        TestBed.configureTestingModule({ providers: [{ provide: CustomerSearchService, useValue: service }] });
        component = TestBed.runInInjectionContext(() => new CustomerPickerComponent());
        component.host = 'https://dealer.example';
    });

    it('consulta a API nova independentemente da filial e emite o cliente escolhido', () => {
        component.changeQuery('Cielo');
        expect(service.search).not.toHaveBeenCalled();
        expect(component.visible).toBeFalse();
        component.open();
        expect(component.visible).toBeTrue();
        expect(service.search).toHaveBeenCalledWith('https://dealer.example', 'Cielo');
        const selected = { id: '4', nome: 'Cielo', documento: null };
        const emit = spyOn(component.selectionChange, 'emit');
        component.select(selected);
        expect(emit).toHaveBeenCalledWith(selected);
        expect(component.visible).toBeFalse();
    });

    it('muda a pagina dos clientes sem repetir a chamada a API', () => {
        component.open();
        component.paginate({ first: 20 });
        component.paginate({ first: 40 });
        expect(service.search).toHaveBeenCalledTimes(1);
        expect(component.first).toBe(40);
    });

    it('bloqueia edicao e nova busca ate limpar a selecao', () => {
        const previous = { id: '4', nome: 'Cielo', documento: null };
        component.selected = previous;
        component.query = previous.nome;
        const emit = spyOn(component.selectionChange, 'emit');
        component.changeQuery('40');
        expect(emit).not.toHaveBeenCalled();
        expect(component.query).toBe('Cielo');
        component.open();
        expect(service.search).not.toHaveBeenCalled();
        component.select(null);
        expect(emit).toHaveBeenCalledWith(null);
        component.selected = null;
        component.ngOnChanges({ selected: new SimpleChange(previous, null, false) });
        expect(component.query).toBe('');
        component.changeQuery('40');
        component.open();
        expect(service.search.calls.mostRecent().args[1]).toBe('40');
    });

    it('primeiro Enter busca e segundo confirma o cliente sem repetir a consulta', () => {
        const cielo = { id: '4', nome: 'Cielo', documento: null };
        service.search.and.returnValue(of({ itens: [cielo], total: 1 }));
        component.query = 'Cielo';
        const emit = spyOn(component.selectionChange, 'emit');
        component.fieldEnter(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(service.search).toHaveBeenCalledTimes(1);
        expect(component.visible).toBeTrue();
        component.confirmEnter(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(emit).toHaveBeenCalledWith(cielo);
        expect(component.visible).toBeFalse();
        expect(service.search).toHaveBeenCalledTimes(1);
    });

    it('setas mudam o cliente que sera confirmado por Enter', () => {
        const clientes = [{ id: '4', nome: 'Cielo', documento: null }, { id: '40', nome: 'Outro', documento: null }];
        service.search.and.returnValue(of({ itens: clientes, total: 2 }));
        component.open();
        component.navigate(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
        const emit = spyOn(component.selectionChange, 'emit');
        component.confirmEnter(new KeyboardEvent('keydown', { key: 'Enter' }));
        expect(emit).toHaveBeenCalledWith(clientes[1]);
    });

    it('permite abrir a busca apenas com o sistema, sem filial ou datas', () => {
        expect(component.canSearch()).toBeTrue();
        component.open();
        expect(service.search).toHaveBeenCalledWith('https://dealer.example', '');
    });

    it('envia a filial selecionada no formulario quando ela existe', () => {
        component.empresaId = 'FILIAL_A';
        component.query = 'Cielo';
        component.open();
        expect(service.search).toHaveBeenCalledWith('https://dealer.example', 'Cielo', 'FILIAL_A');
    });

    it('fechar o modal cancela a busca pendente sem selecionar cliente', () => {
        const pending = new Subject<CustomerPage>();
        service.search.and.returnValue(pending);
        const emit = spyOn(component.selectionChange, 'emit');
        component.open();
        component.close();
        pending.next({ itens: [{ id: '4', nome: 'Cielo', documento: null }], total: 1 });
        expect(component.visible).toBeFalse();
        expect(component.loading()).toBeFalse();
        expect(component.customers()).toEqual([]);
        expect(emit).not.toHaveBeenCalled();
    });

    it('descarta resultados pendentes quando muda o sistema', () => {
        const pending = new Subject<CustomerPage>();
        service.search.and.returnValue(pending);
        component.open();
        component.host = 'https://outro.example';
        component.ngOnChanges({ host: new SimpleChange('https://dealer.example', component.host, false) });
        pending.next({ itens: [{ id: '4', nome: 'Cliente da filial A', documento: null }], total: 1 });
        expect(component.customers()).toEqual([]);
        expect(component.visible).toBeFalse();
    });

    it('limpar filtros remove o texto mesmo se nao havia cliente selecionado sem buscar novamente', () => {
        component.query = 'Cielo';
        component.ngOnChanges({ resetKey: new SimpleChange(0, 1, false) });
        expect(component.query).toBe('');
        expect(component.visible).toBeFalse();
        expect(service.search).not.toHaveBeenCalled();
    });

    it('preserva a identificacao do cliente selecionado ao mudar o periodo', () => {
        component.selected = { id: '4', nome: 'Cielo', documento: null };
        component.ngOnChanges({ selected: new SimpleChange(null, component.selected, true) });
        component.ngOnChanges({ vencimentoAte: new SimpleChange('2026-10-30', '2026-12-31', false) });
        expect(component.query).toBe('Cielo');
        expect(component.selected.id).toBe('4');
    });
});

describe('CustomerPickerComponent rendered selection', () => {
    it('bloqueia o nome imediatamente ao selecionar e libera CPF somente ao limpar', async () => {
        const service = jasmine.createSpyObj('CustomerSearchService', ['search']);
        service.search.and.returnValue(of({ itens: [], total: 0 }));
        await TestBed.configureTestingModule({
            imports: [CustomerPickerComponent],
            providers: [{ provide: CustomerSearchService, useValue: service }]
        }).compileComponents();
        const fixture = TestBed.createComponent(CustomerPickerComponent);
        fixture.componentRef.setInput('host', 'https://dealer.example');
        fixture.detectChanges();
        await fixture.whenStable();
        const component = fixture.componentInstance;
        const customer = { id: '4', nome: 'Cielo', documento: '12345678900' };
        const emit = spyOn(component.selectionChange, 'emit');
        // No parent input update: selecting must lock the DOM immediately.
        component.select(customer);
        fixture.detectChanges();
        const locked = fixture.nativeElement.querySelector('input[aria-label="Cliente selecionado"]') as HTMLInputElement;
        expect(locked.value).toBe('Cielo');
        expect(locked.disabled).toBeTrue();
        expect(locked.readOnly).toBeTrue();
        component.changeQuery('Outro nome');
        expect(component.query).toBe('Cielo');
        const buttons = Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[];
        expect(buttons.some(button => button.textContent?.includes('Buscar cliente'))).toBeFalse();
        const clear = buttons.find(button => button.textContent?.includes('Limpar seleção'))!;
        expect(clear.disabled).toBeFalse();
        clear.click();
        fixture.detectChanges();
        await fixture.whenStable();
        const editable = fixture.nativeElement.querySelector('input[aria-label="CPF/CNPJ do cliente"]') as HTMLInputElement;
        expect(editable.disabled).toBeFalse();
        expect(editable.readOnly).toBeFalse();
        expect(editable.value).toBe('');
        expect(emit).toHaveBeenCalledWith(null);
        expect(service.search).not.toHaveBeenCalled();
    });
});
