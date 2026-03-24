import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { QRCodeComponent } from 'angularx-qrcode';
import { ButtonModule } from 'primeng/button';
import { FluidModule } from 'primeng/fluid';
import { InputTextModule } from 'primeng/inputtext';
import { getApiErrorMessage } from '../service/api-error-response';
import { PixGenerationResponse, PixService } from '../service/pix.service';

@Component({
    selector: 'app-pix',
    standalone: true,
    imports: [CommonModule, FormsModule, InputTextModule, ButtonModule, FluidModule, CurrencyPipe, DatePipe, QRCodeComponent],
    template: `
        <div class="grid grid-cols-12 gap-8">
            <div class="col-span-12 xl:col-span-5">
                <div class="card flex flex-col gap-6">
                    <div class="flex flex-col gap-2">
                        <div class="font-semibold text-xl">Gerar PIX por lançamento</div>
                        <p class="m-0 text-surface-500">Informe o número do lançamento para consultar o título e gerar a chave PIX para pagamento.</p>
                    </div>

                    <p-fluid>
                        <div class="flex flex-col gap-4">
                            <div class="flex flex-col gap-2">
                                <label for="numeroLancamento" class="font-medium">Número do lançamento</label>
                                <input
                                    pInputText
                                    id="numeroLancamento"
                                    type="text"
                                    [(ngModel)]="numeroLancamento"
                                    [disabled]="loading()"
                                    placeholder="Ex.: 123456"
                                />
                            </div>

                            <p-button
                                label="Gerar PIX"
                                icon="pi pi-qrcode"
                                [loading]="loading()"
                                [disabled]="!numeroLancamento.trim()"
                                (onClick)="generatePix()"
                            />
                        </div>
                    </p-fluid>

                    @if (errorMessage()) {
                        <div class="rounded-border border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                            {{ errorMessage() }}
                        </div>
                    }
                </div>
            </div>

            <div class="col-span-12 xl:col-span-7">
                <div class="card flex flex-col gap-5 h-full">
                    <div class="font-semibold text-xl">Dados do pagamento</div>

                    @if (paymentData(); as payment) {
                        <div class="grid grid-cols-12 gap-4">
                            <div class="col-span-12 md:col-span-6">
                                <div class="rounded-border border border-surface-200 p-4 h-full">
                                    <div class="text-sm text-surface-500 mb-2">Número do lançamento</div>
                                    <div class="font-semibold text-lg">{{ lastSubmittedLancamento() }}</div>
                                </div>
                            </div>
                            <div class="col-span-12 md:col-span-6">
                                <div class="rounded-border border border-surface-200 p-4 h-full">
                                    <div class="text-sm text-surface-500 mb-2">Valor</div>
                                    <div class="font-semibold text-lg">{{ payment.valor | currency: 'BRL' : 'symbol' : '1.2-2' }}</div>
                                </div>
                            </div>
                            <div class="col-span-12 md:col-span-6">
                                <div class="rounded-border border border-surface-200 p-4 h-full">
                                    <div class="text-sm text-surface-500 mb-2">TXID</div>
                                    <div class="font-semibold text-lg break-all">{{ payment.txId }}</div>
                                </div>
                            </div>
                            <div class="col-span-12 md:col-span-6">
                                <div class="rounded-border border border-surface-200 p-4 h-full">
                                    <div class="text-sm text-surface-500 mb-2">Status</div>
                                    <div class="font-semibold text-lg">{{ payment.status }}</div>
                                </div>
                            </div>
                            <div class="col-span-12 md:col-span-6">
                                <div class="rounded-border border border-surface-200 p-4">
                                    <div class="text-sm text-surface-500 mb-2">Recebedor</div>
                                    <div class="font-semibold text-lg">{{ payment.nomeRecebedor }}</div>
                                </div>
                            </div>
                            <div class="col-span-12 md:col-span-6">
                                <div class="rounded-border border border-surface-200 p-4 h-full">
                                    <div class="text-sm text-surface-500 mb-2">Expiração</div>
                                    <div class="font-semibold text-lg">{{ payment.expiracaoEm | date: 'dd/MM/yyyy HH:mm:ss' }}</div>
                                </div>
                            </div>
                            <div class="col-span-12">
                                <div class="rounded-border border border-surface-200 p-4">
                                    <div class="text-sm text-surface-500 mb-2">Descrição</div>
                                    <div class="font-semibold text-lg">{{ payment.descricao }}</div>
                                </div>
                            </div>
                            <div class="col-span-12 lg:col-span-5">
                                <div class="rounded-border border border-surface-200 p-4 h-full flex flex-col gap-3 items-center justify-center">
                                    <div class="text-sm text-surface-500">QR Code</div>
                                    @if (payment.qrCode.trim()) {
                                        <qrcode
                                            [qrdata]="payment.qrCode"
                                            [width]="220"
                                            [margin]="1"
                                            [errorCorrectionLevel]="'M'"
                                            [elementType]="'img'"
                                            alt="QR Code Pix"
                                        />
                                    } @else if (getQrCodeImageSource(payment); as qrCodeImageSource) {
                                        <img [src]="qrCodeImageSource" alt="QR Code Pix" class="max-w-full rounded-border border border-surface-200" />
                                    } @else {
                                        <div class="text-surface-500 text-sm text-center">O QR Code em imagem não foi enviado.</div>
                                    }
                                </div>
                            </div>
                            <div class="col-span-12 lg:col-span-7">
                                <div class="rounded-border border border-green-200 bg-green-50 p-4 h-full">
                                    <div class="text-sm text-green-700 mb-2">Pix copia e cola</div>
                                    <div class="font-semibold text-lg break-all">{{ payment.qrCode }}</div>
                                </div>
                            </div>
                        </div>
                    } @else {
                        <div class="rounded-border border border-dashed border-surface-300 px-6 py-10 text-center text-surface-500">
                            Os dados do PIX aparecerão aqui após a consulta do número do lançamento.
                        </div>
                    }
                </div>
            </div>
        </div>
    `
})
export class Pix implements OnInit {
    private readonly pixService = inject(PixService);
    private readonly route = inject(ActivatedRoute);
    private readonly destroyRef = inject(DestroyRef);

    numeroLancamento = '';

    readonly loading = signal(false);
    readonly errorMessage = signal('');
    readonly paymentData = signal<PixGenerationResponse | null>(null);
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

    getQrCodeImageSource(payment: PixGenerationResponse): string | null {
        if (!payment.qrCodeBase64?.trim()) {
            return null;
        }

        return payment.qrCodeBase64.startsWith('data:')
            ? payment.qrCodeBase64
            : `data:image/png;base64,${payment.qrCodeBase64}`;
    }

    generatePix(): void {
        const numeroLancamento = this.numeroLancamento.trim();

        if (!numeroLancamento) {
            this.errorMessage.set('Informe o número do lançamento para gerar o PIX.');
            this.paymentData.set(null);
            this.lastSubmittedLancamento.set('');
            return;
        }

        this.paymentData.set(null);
        this.lastSubmittedLancamento.set('');
        this.loading.set(true);
        this.errorMessage.set('');

        this.pixService.generatePix(numeroLancamento).subscribe({
            next: (response) => {
                this.paymentData.set(response);
                this.lastSubmittedLancamento.set(numeroLancamento);
                this.loading.set(false);
            },
            error: (error: HttpErrorResponse) => {
                this.paymentData.set(null);
                this.loading.set(false);
                this.errorMessage.set(getApiErrorMessage(error, 'Nao foi possivel gerar o Pix para este lancamento.'));
            }
        });
    }
}
