import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { PixGeneratedResult } from '../pix/pix.models';
import { PixResultComponent } from '../pix/components/pix-result/pix-result.component';
import { getApiErrorMessage } from '../service/api-error-response';
import { BranchOption, PixService } from '../service/pix.service';
import { CustomerOption } from '../service/customer-search.service';
import { CustomerPickerComponent } from '@/app/shared/customer-picker/customer-picker.component';
import { Receivable, ReceivableFilters, ReceivablesService } from '../service/receivables.service';

@Component({
    selector: 'app-receivables',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, SelectModule, TableModule, TagModule, PixResultComponent, CustomerPickerComponent],
    templateUrl: './receivables.html'
})
export class Receivables implements OnInit {
    private readonly config = inject(AppConfigService);
    private readonly service = inject(ReceivablesService);
    private readonly pixService = inject(PixService);
    private readonly destroyRef = inject(DestroyRef);
    private listRequest?: Subscription;
    private pixRequest?: Subscription;
    private branchesRequest?: Subscription;
    private automaticDates = { start: '', end: '' };
    private datesEdited = false;
    private datesBeforeCustomer: { start: string; end: string } | null = null;
    private appliedFilters = this.emptyFilters();

    readonly systems = this.config.systems.filter(system => system.operacoes.some(operation => operation.tipoTransacao === 'CONTAS_RECEBER'));
    systemName = this.systems[0]?.nome ?? '';
    filters = this.emptyFilters();
    readonly titles = signal<Receivable[]>([]);
    readonly total = signal(0);
    readonly loading = signal(false);
    readonly error = signal('');
    readonly branches = signal<BranchOption[]>([]);
    readonly branchesLoading = signal(false);
    readonly branchesError = signal('');
    readonly generatingKey = signal<string | null>(null);
    readonly result = signal<PixGeneratedResult | null>(null);
    readonly statusOptions = [
        { label: 'Todas', value: '' },
        { label: 'Saldo em aberto', value: 'ABERTO' },
        { label: 'Pago', value: 'PAGO' },
        { label: 'Cancelado', value: 'CANCELADO' }
    ];
    readonly statusLabels: Record<string, string> = {
        ...Object.fromEntries(this.statusOptions.map(item => [item.value, item.label])),
        PARCIAL: 'Recebido parcialmente'
    };
    first = 0;
    pageSize = 20;
    pixVisible = false;
    selectedCustomer: CustomerOption | null = null;
    customerResetKey = 0;
    customerSearchMode: 'document' | 'id' = 'document';
    customerIdQuery = '';
    readonly customerSearchModes = [
        { label: 'CPF/CNPJ', value: 'document' },
        { label: 'ID do cliente', value: 'id' }
    ];
    get hasCustomer(): boolean { return !!this.filters.clienteId; }
    get systemHost(): string { return this.systems.find(system => system.nome === this.systemName)?.host ?? ''; }

    resetCustomer(): void {
        this.customerResetKey++;
        this.customerIdQuery = '';
        this.selectCustomer(null);
    }

    customerSearchModeChanged(): void {
        this.resetCustomer();
    }

    customerIdChanged(value: string): void {
        this.customerIdQuery = value;
        const raw = value.trim();
        this.setCustomerFilter(this.validPositiveInt(raw) ? String(Number(raw)) : '', null);
    }

    private validPositiveInt(id: string): boolean {
        return /^[0-9]+$/.test(id) && Number(id) > 0 && Number(id) <= 2147483647;
    }

    selectCustomer(customer: CustomerOption | null): void {
        this.setCustomerFilter(customer?.id ?? '', customer);
    }

    private setCustomerFilter(id: string, customer: CustomerOption | null): void {
        if (id && !this.hasCustomer) {
            this.datesBeforeCustomer = { start: this.filters.vencimentoDe, end: this.filters.vencimentoAte };
            if (!this.datesEdited && this.filters.vencimentoDe === this.automaticDates.start && this.filters.vencimentoAte === this.automaticDates.end) {
                this.filters.vencimentoDe = '';
                this.filters.vencimentoAte = '';
            }
        } else if (!id && this.hasCustomer) {
            if (!this.filters.vencimentoDe || !this.filters.vencimentoAte) {
                const dates = this.datesBeforeCustomer ?? this.automaticDates;
                this.filters.vencimentoDe = dates.start;
                this.filters.vencimentoAte = dates.end;
            }
            this.datesBeforeCustomer = null;
        }
        this.selectedCustomer = customer;
        this.filters.clienteId = id;
    }

    datesChanged(): void { this.datesEdited = true; }

    ngOnInit(): void { this.loadBranches(); }

    private emptyFilters(): ReceivableFilters {
        const now = new Date();
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 29);
        const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        this.automaticDates = { start: iso(now), end: iso(end) };
        this.datesEdited = false;
        this.datesBeforeCustomer = null;
        return { busca: '', lancamento: '', documento: '', parcela: '', empresaId: '', clienteId: '', situacao: 'ABERTO', vencimentoDe: iso(now), vencimentoAte: iso(end) };
    }

    systemChanged(): void {
        this.resetCustomer();
        this.listRequest?.unsubscribe();
        this.loading.set(false);
        this.titles.set([]);
        this.total.set(0);
        this.error.set('');
        this.pixRequest?.unsubscribe();
        this.generatingKey.set(null);
        this.result.set(null);
        this.pixVisible = false;
        this.filters = this.emptyFilters();
        this.loadBranches();
    }

    clear(): void {
        this.listRequest?.unsubscribe();
        this.loading.set(false);
        this.resetCustomer();
        this.filters = this.emptyFilters();
        if (this.branches().length === 1) this.filters.empresaId = this.branches()[0].id;
        this.appliedFilters = { ...this.filters };
        this.titles.set([]);
        this.total.set(0);
        this.first = 0;
        this.error.set('');
    }

    refresh(): void {
        if (this.branchesError() || !this.branches().length) this.loadBranches();
        else this.load();
    }

    private loadBranches(): void {
        this.branchesRequest?.unsubscribe();
        this.branches.set([]);
        this.branchesError.set('');
        const system = this.systems.find(item => item.nome === this.systemName);
        if (!system) return;
        this.branchesLoading.set(true);
        this.branchesRequest = this.pixService.getBranches(system.host).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: branches => {
                this.branches.set(branches);
                this.branchesLoading.set(false);
                if (branches.length === 1) this.filters.empresaId = branches[0].id;
                if (branches.length && this.filters.empresaId) this.search();
                else if (!branches.length) this.branchesError.set('Nenhuma filial disponível para este usuário.');
            },
            error: (error: HttpErrorResponse) => {
                this.branchesLoading.set(false);
                this.branchesError.set(getApiErrorMessage(error, 'Não foi possível carregar as filiais.'));
            }
        });
    }

    get searchBlockReasons(): string[] {
        if (this.generatingKey()) return ['Aguarde a geração do Pix terminar para consultar os títulos.'];
        if (this.branchesLoading()) return ['Aguarde o carregamento das filiais.'];
        if (this.loading()) return ['Aguarde a consulta de títulos terminar.'];
        if (!this.branches().length) return [this.branchesError() && this.branchesError() !== 'Nenhuma filial disponível para este usuário.'
            ? 'Não foi possível disponibilizar as filiais. Clique em Atualizar para tentar novamente.'
            : 'Nenhuma filial disponível para este usuário. Verifique suas permissões de acesso.'];
        const filters = { ...this.filters };
        if (this.customerSearchMode === 'id') {
            const id = this.customerIdQuery.trim();
            if (id && !this.validPositiveInt(id)) return ['Informe um ID de cliente inteiro entre 1 e 2147483647.'];
            filters.clienteId = id ? String(Number(id)) : '';
        }
        return this.filterIssues(filters);
    }

    private filterIssues(filters: ReceivableFilters): string[] {
        const issues: string[] = [];
        if (filters.clienteId && !this.validPositiveInt(filters.clienteId)) return ['Informe um ID de cliente inteiro entre 1 e 2147483647.'];
        if (!filters.clienteId) {
            if (!filters.empresaId) issues.push('Selecione uma filial. Sem cliente informado, a filial é obrigatória.');
            if (!filters.vencimentoDe) issues.push('Preencha o vencimento inicial. Sem cliente informado, as duas datas são obrigatórias.');
            if (!filters.vencimentoAte) issues.push('Preencha o vencimento final. Sem cliente informado, as duas datas são obrigatórias.');
        }
        for (const [field, label] of [['lancamento', 'lançamento'], ['documento', 'documento'], ['parcela', 'parcela']] as const) {
            const value = filters[field]?.trim();
            if (value && !this.validPositiveInt(value)) issues.push(`Informe um número de ${label} inteiro entre 1 e 2147483647.`);
        }
        const start = Date.parse(filters.vencimentoDe);
        const end = Date.parse(filters.vencimentoAte);
        if ((filters.vencimentoDe && !Number.isFinite(start)) || (filters.vencimentoAte && !Number.isFinite(end))) {
            issues.push('Informe datas de vencimento válidas.');
        } else if (filters.vencimentoDe && filters.vencimentoAte) {
            if (start > end) issues.push('O vencimento inicial deve ser anterior ou igual ao final.');
            else if (!filters.clienteId && (end - start) / 86_400_000 >= 30) {
                issues.push('O período deve ter no máximo 30 dias, incluindo as datas inicial e final. Reduza o período ou informe um cliente.');
            }
        }
        return issues;
    }

    private validateFilters(filters: ReceivableFilters): string {
        return this.filterIssues(filters)[0] ?? '';
    }

    search(): void {
        if (this.customerSearchMode === 'id') {
            this.customerIdChanged(this.customerIdQuery);
            if (this.customerIdQuery.trim() && !this.validPositiveInt(this.customerIdQuery.trim())) {
                this.error.set('Informe um ID de cliente inteiro entre 1 e 2147483647.');
                return;
            }
        }
        const error = this.validateFilters(this.filters);
        if (error) {
            this.error.set(error);
            return;
        }
        this.appliedFilters = { ...this.filters };
        this.first = 0;
        this.load();
    }

    paginate(event: { first?: number; rows?: number }): void {
        this.first = event.first ?? 0;
        this.pageSize = event.rows ?? 20;
    }

    load(): void {
        if (this.branchesLoading() || !this.branches().length) return;
        const error = this.validateFilters(this.appliedFilters);
        if (error) { this.error.set(error); return; }
        this.listRequest?.unsubscribe();
        this.titles.set([]);
        this.total.set(0);
        this.error.set('');
        const system = this.systems.find(item => item.nome === this.systemName);
        if (!system) return;
        this.loading.set(true);
        this.first = 0;
        this.listRequest = this.service.list(system.host, this.appliedFilters)
            .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
                next: page => {
                    this.titles.set(page.itens);
                    this.total.set(page.total);
                    this.loading.set(false);
                },
                error: (error: HttpErrorResponse) => {
                    this.loading.set(false);
                    this.error.set(error.status === 404 || error.status === 501
                        ? 'A consulta de contas a receber ainda não está disponível neste sistema.'
                        : getApiErrorMessage(error, 'Não foi possível consultar os títulos. Tente novamente.'));
                }
            });
    }

    canGenerate(title: Receivable): boolean {
        return title.podeGerarPix && title.saldoAberto > 0 && ['ABERTO', 'PARCIAL'].includes(title.situacao);
    }

    key(title: Receivable): string { return JSON.stringify([title.empresaId, title.tituloId]); }

    generate(title: Receivable): void {
        if (!this.canGenerate(title) || this.generatingKey()) return;
        const system = this.systems.find(item => item.nome === this.systemName);
        const operation = system?.operacoes.find(item => item.tipoTransacao === 'CONTAS_RECEBER');
        if (!system || !operation) return;
        this.generatingKey.set(this.key(title));
        this.error.set('');
        this.pixRequest = this.service.generatePix(system.host, title).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: payment => {
                this.generatingKey.set(null);
                this.result.set({ referenceLabel: 'Título', referenceValue: `${title.tituloId}-${title.parcela || '—'}`, payment, system, operation });
                this.pixVisible = true;
            },
            error: (error: HttpErrorResponse) => {
                this.generatingKey.set(null);
                this.error.set(getApiErrorMessage(error, 'Não foi possível gerar o Pix para este título.'));
            }
        });
    }

    formatClienteId(value: string | number | null | undefined): string {
        const raw = String(value ?? '').trim();
        if (!/^\d+(?:[.,]\d+)?$/.test(raw)) return raw || '—';
        const id = Math.trunc(Number(raw.replace(',', '.')));
        return Number.isSafeInteger(id) ? String(id) : raw;
    }

    formatDate(value: string | null): string {
        if (!value) return '—';
        const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
        return match ? `${match[3]}/${match[2]}/${match[1]}` : '—';
    }
}
