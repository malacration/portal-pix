import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { AppSystemConfig, AppSystemOperationConfig } from '@/app/core/config/app-config.service';
import { getApiErrorMessage } from '@/app/pages/service/api-error-response';
import { BranchOption, PixClienteAdvanceRequest, PixService } from '@/app/pages/service/pix.service';
import { PixGeneratedResult } from '../../pix.models';

@Component({
    selector: 'app-pix-adiantamento-cliente',
    standalone: true,
    imports: [CommonModule, FormsModule, InputTextModule, InputNumberModule, ButtonModule, FluidModule, SelectModule],
    templateUrl: './pix-adiantamento-cliente.component.html'
})
export class PixAdiantamentoClienteComponent implements OnInit, OnChanges {
    private readonly pixService = inject(PixService);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);

    @Input({ required: true }) systemConfig!: AppSystemConfig;
    @Input({ required: true }) operationConfig!: AppSystemOperationConfig;
    @Input() resultChange?: (result: PixGeneratedResult | null) => void;

    idCliente = '';
    branchId = '';
    valor: number | null = null;
    departamentoCod: number | null = null;
    tipoFichaRazaoCod: number | null = null;

    readonly departamentos = [
        { label: 'ADMINISTRAÇÃO', value: 1 },
        { label: 'ASSISTÊNCIA TÉCNICA', value: 4 },
        { label: 'AUTO CENTRO', value: 10 },
        { label: 'FUNILARIA E PINTURA', value: 2 },
        { label: 'MARKETING', value: 25 },
        { label: 'OFICINA PRODUTIVO', value: 57 },
        { label: 'PEÇAS E ACESSÓRIOS', value: 3 },
        { label: 'VEÍCULOS NOVOS', value: 5 },
        { label: 'VEÍCULOS USADOS', value: 6 },
        { label: 'VENDA DIRETA', value: 7 }
    ];

    readonly tiposFichaRazao = [
        { label: 'ADIANT DE CLIENTES (OUTROS)', value: 3 },
        { label: 'ADIANT DE CLIENTES (PEÇAS)', value: 4 },
        { label: 'ADIANT DE CLIENTES (VEÍCULOS)', value: 5 },
        { label: 'ADIANT DE CLIENTES (VENDA DIRETA)', value: 6 },
        { label: 'ADIANT DE CLIENTES (SERVIÇOS)', value: 10 },
        { label: 'ADIANT DE CLIENTES (FUNILARIA)', value: 11 },
        { label: 'ADIANT DE CLIENTE (MVP ATV)', value: 19 },
        { label: 'ADIANT DE CLIENTES (BIONIO)', value: 21 },
        { label: 'ADIANT RETORNO FINANCEIRO', value: 23 }
    ];

    readonly branches = signal<BranchOption[]>([]);
    readonly branchesLoading = signal(false);
    readonly loading = signal(false);
    readonly errorMessage = signal('');
    readonly lastSubmittedClientId = signal('');

    ngOnInit(): void {
        this.loadBranches();

        this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
            const idCliente = params.get('idCliente')?.trim() ?? params.get('cliente')?.trim() ?? '';
            const branchId = params.get('branchId')?.trim() ?? params.get('filial')?.trim() ?? '';
            const valor = this.parseCurrencyValue(params.get('valor'));

            if (!idCliente || idCliente === this.lastSubmittedClientId()) {
                return;
            }

            this.idCliente = idCliente;
            this.branchId = branchId;
            this.valor = valor;

            if (this.branchId) {
                this.generatePix();
            }
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['systemConfig']?.firstChange && changes['operationConfig']?.firstChange) {
            return;
        }

        this.errorMessage.set('');
        this.lastSubmittedClientId.set('');
        this.branchId = '';
        this.departamentoCod = null;
        this.tipoFichaRazaoCod = null;
        this.branches.set([]);
        this.resultChange?.(null);
        this.loadBranches();
    }

    generatePix(): void {
        const idCliente = this.idCliente.trim();
        const branchId = this.branchId.trim();

        if (!idCliente) {
            this.errorMessage.set('Informe o ID do cliente para gerar o PIX.');
            this.lastSubmittedClientId.set('');
            this.resultChange?.(null);
            return;
        }

        if (!branchId) {
            this.errorMessage.set('Selecione a filial para gerar o PIX de adiantamento.');
            this.lastSubmittedClientId.set('');
            this.resultChange?.(null);
            return;
        }

        if (!this.departamentoCod) {
            this.errorMessage.set('Selecione o departamento para gerar o PIX de adiantamento.');
            this.lastSubmittedClientId.set('');
            this.resultChange?.(null);
            return;
        }

        if (!this.tipoFichaRazaoCod) {
            this.errorMessage.set('Selecione o tipo de ficha razão para gerar o PIX de adiantamento.');
            this.lastSubmittedClientId.set('');
            this.resultChange?.(null);
            return;
        }

        this.lastSubmittedClientId.set('');
        this.loading.set(true);
        this.errorMessage.set('');
        this.resultChange?.(null);

        const payload = this.buildAdvancePayload(idCliente, branchId);

        this.pixService.generateClienteAdvancePix(payload, this.systemConfig.host).subscribe({
            next: (response) => {
                this.lastSubmittedClientId.set(idCliente);
                this.loading.set(false);
                this.resultChange?.({
                    referenceLabel: 'ID do cliente',
                    referenceValue: idCliente,
                    payment: response,
                    system: this.systemConfig,
                    operation: this.operationConfig
                });
            },
            error: (error: HttpErrorResponse) => {
                this.loading.set(false);
                this.errorMessage.set(getApiErrorMessage(error, 'Nao foi possivel gerar o Pix de adiantamento para este cliente.'));
                this.resultChange?.(null);
            }
        });
    }

    private parseCurrencyValue(value: string | null): number | null {
        if (!value?.trim()) {
            return null;
        }

        const normalizedValue = value.replace(/\./g, '').replace(',', '.');
        const parsedValue = Number(normalizedValue);

        return Number.isFinite(parsedValue) ? parsedValue : null;
    }

    private buildAdvancePayload(idCliente: string, branchId: string): PixClienteAdvanceRequest {
        return {
            idCliente,
            branchId,
            valor: this.valor,
            departamentoCod: this.departamentoCod,
            tipoFichaRazaoCod: this.tipoFichaRazaoCod
        };
    }

    private loadBranches(): void {
        this.branchesLoading.set(true);

        this.pixService.getBranches(this.systemConfig?.host).subscribe({
            next: (branches) => {
                this.branches.set(branches);
                this.branchesLoading.set(false);

                if (!this.branchId && branches.length === 1) {
                    this.branchId = branches[0].id;
                }
            },
            error: (error: HttpErrorResponse) => {
                this.branchesLoading.set(false);
                this.branches.set([]);
                this.errorMessage.set(getApiErrorMessage(error, 'Nao foi possivel carregar as filiais para o adiantamento.'));
            }
        });
    }
}
