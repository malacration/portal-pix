import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, Input, OnChanges, OnInit, SimpleChanges, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { InputTextModule } from 'primeng/inputtext';
import { AppSystemConfig, AppSystemOperationConfig } from '@/app/core/config/app-config.service';
import { getApiErrorMessage } from '@/app/pages/service/api-error-response';
import { PixService } from '@/app/pages/service/pix.service';
import { PixGeneratedResult } from '../../pix.models';

@Component({
    selector: 'app-pix-contas-receber',
    standalone: true,
    imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, FluidModule],
    templateUrl: './pix-contas-receber.component.html'
})
export class PixContasReceberComponent implements OnInit, OnChanges {
    private readonly pixService = inject(PixService);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);

    @Input({ required: true }) systemConfig!: AppSystemConfig;
    @Input({ required: true }) operationConfig!: AppSystemOperationConfig;
    @Input() resultChange?: (result: PixGeneratedResult | null) => void;

    numeroLancamento = '';

    readonly loading = signal(false);
    readonly errorMessage = signal('');
    readonly lastSubmittedLancamento = signal('');

    ngOnInit(): void {
        this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
            const numeroLancamento = params.get('lancamento')?.trim() ?? '';

            if (!numeroLancamento || numeroLancamento === this.lastSubmittedLancamento()) {
                return;
            }

            this.numeroLancamento = numeroLancamento;
            this.generatePix();
        });
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['systemConfig']?.firstChange && changes['operationConfig']?.firstChange) {
            return;
        }

        this.errorMessage.set('');
        this.lastSubmittedLancamento.set('');
        this.resultChange?.(null);
    }

    generatePix(): void {
        const numeroLancamento = this.numeroLancamento.trim();

        if (!numeroLancamento) {
            this.errorMessage.set('Informe o número do lançamento para gerar o PIX.');
            this.lastSubmittedLancamento.set('');
            this.resultChange?.(null);
            return;
        }

        this.lastSubmittedLancamento.set('');
        this.loading.set(true);
        this.errorMessage.set('');
        this.resultChange?.(null);

        this.pixService.generatePix(numeroLancamento, this.systemConfig.host).subscribe({
            next: (response) => {
                this.lastSubmittedLancamento.set(numeroLancamento);
                this.loading.set(false);
                this.resultChange?.({
                    referenceLabel: 'Numero do lancamento',
                    referenceValue: numeroLancamento,
                    payment: response,
                    system: this.systemConfig,
                    operation: this.operationConfig
                });
            },
            error: (error: HttpErrorResponse) => {
                this.loading.set(false);
                this.errorMessage.set(getApiErrorMessage(error, 'Nao foi possivel gerar o Pix para este lancamento.'));
                this.resultChange?.(null);
            }
        });
    }
}
