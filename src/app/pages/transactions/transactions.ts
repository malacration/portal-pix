import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { interval, startWith } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { ButtonGroupModule } from 'primeng/buttongroup';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AuthService } from '@/app/core/auth/auth.service';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { getPixTransactionTypeLabel, PixTransactionType } from '@/app/core/models/pix-transaction-type';
import { PixShareLinkComponent, PixShareLinkData } from '@/app/shared/pix-share-link/pix-share-link.component';
import { getApiErrorMessage } from '../service/api-error-response';
import { PixService, TransactionPaymentConsultationResponse } from '../service/pix.service';
import { TransactionDocument, TransactionsService } from '../service/transactions.service';

type TransactionTagSeverity = 'success' | 'info' | 'warn' | 'danger' | 'secondary';

interface TransactionDetailEntry {
    field: string;
    label: string;
    value: unknown;
}


const TEXT_FILTER_FIELDS = ['txId', 'reference', 'clienteNome', 'empresa'] as const;
const DATE_FIELDS = new Set(['vencimentoTitulo', 'pixGeradoEm', 'pixExpiraEm', 'createdAt']);
const HIDDEN_DETAIL_FIELDS = new Set(['qrCode', 'qrCodeBase64']);
const FIELD_LABELS: Record<string, string> = {
    status: 'Status da transacao',
    statusTituloRef: 'Status do titulo de referencia',
    id: 'ID',
    idLancamento: 'ID Ref.',
    tipoTransacao: 'Tipo',
    txId: 'TxID',
    reference: 'Reference',
    empresa: 'Empresa',
    empresaCod: 'Codigo empresa',
    clienteNome: 'Cliente',
    clienteCodigo: 'Codigo cliente',
    valor: 'Valor',
    descricao: 'Descricao',
    numeroParcela: 'Parcela',
    vencimentoTitulo: 'Vencimento',
    pixGeradoEm: 'Pix gerado em',
    pixExpiraEm: 'Pix expira em',
    qrCode: 'QR Code',
    qrCodeBase64: 'QR Code Base64',
    cnpjContaRecebimento: 'CNPJ recebimento',
    chavePixRecebimento: 'Chave PIX recebimento',
    nomeTitularContaRecebimento: 'Titular conta recebimento',
    createdAt: 'Criado em'
};
const FIELD_ORDER = [
    'status',
    'statusTituloRef',
    'id',
    'idLancamento',
    'tipoTransacao',
    'txId',
    'reference',
    'empresa',
    'empresaCod',
    'clienteNome',
    'clienteCodigo',
    'valor',
    'descricao',
    'numeroParcela',
    'vencimentoTitulo',
    'pixGeradoEm',
    'pixExpiraEm',
    'cnpjContaRecebimento',
    'chavePixRecebimento',
    'nomeTitularContaRecebimento',
    'createdAt',
    'qrCode',
    'qrCodeBase64'
] as const;
const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const tableDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
});
const detailDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

@Component({
    selector: 'app-transactions',
    standalone: true,
    imports: [CommonModule, FormsModule, TableModule, ButtonModule, ButtonGroupModule, InputTextModule, SelectModule, DialogModule, TagModule, IconFieldModule, InputIconModule, TooltipModule, PixShareLinkComponent],
    template: `
        <div class="grid grid-cols-12 gap-8">
            <div class="col-span-12">
                <div class="card flex flex-col gap-6">
                    <div class="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                        <div class="flex flex-col gap-2">
                            <div class="font-semibold text-xl">Transacoes</div>
                            <p class="m-0 text-surface-500">Consulta operacional com filtros locais, ordenacao por data mais recente e detalhes completos do registro.</p>
                        </div>

                        <div class="flex flex-wrap items-center gap-2 text-sm text-surface-500">
                            <span>{{ filteredTransactions().length }} de {{ transactions().length }} registros</span>
                            <p-button label="Atualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" [loading]="loading()" (onClick)="reloadTransactions()" />
                        </div>
                    </div>

                    <div class="grid grid-cols-12 gap-4">
                        <div class="col-span-12 md:col-span-6 lg:col-span-3">
                            <label for="transactions-system" class="mb-2 block font-medium">Sistema</label>
                            <p-select
                                inputId="transactions-system"
                                class="w-full"
                                [options]="systems"
                                optionLabel="nome"
                                optionValue="nome"
                                [ngModel]="selectedSystemName()"
                                (ngModelChange)="onSystemChange($event ?? '')"
                                placeholder="Selecione um sistema"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 lg:col-span-4">
                            <label for="transactions-search" class="mb-2 block font-medium">Busca</label>
                            <p-iconfield class="w-full">
                                <p-inputicon styleClass="pi pi-search" />
                                <input
                                    pInputText
                                    id="transactions-search"
                                    type="text"
                                    class="w-full"
                                    [ngModel]="searchTerm()"
                                    (ngModelChange)="searchTerm.set($event ?? '')"
                                    placeholder="Buscar por TxID, reference, cliente ou empresa"
                                />
                            </p-iconfield>
                        </div>

                        <div class="col-span-12 md:col-span-6 lg:col-span-3">
                            <label for="transactions-status" class="mb-2 block font-medium">Status</label>
                            <p-select
                                inputId="transactions-status"
                                class="w-full"
                                [options]="statusOptions()"
                                optionLabel="label"
                                optionValue="value"
                                [ngModel]="statusFilter()"
                                (ngModelChange)="statusFilter.set($event ?? '')"
                            />
                        </div>

                        <div class="col-span-12 md:col-span-6 lg:col-span-2 flex items-end">
                            <p-button
                                label="Limpar"
                                icon="pi pi-filter-slash"
                                severity="secondary"
                                [outlined]="true"
                                [disabled]="!hasActiveFilters()"
                                (onClick)="clearFilters()"
                            />
                        </div>
                    </div>

                    @if (errorMessage()) {
                        <div class="rounded-border border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <span>{{ errorMessage() }}</span>
                            <p-button label="Tentar novamente" icon="pi pi-refresh" severity="danger" [text]="true" (onClick)="reloadTransactions()" />
                        </div>
                    }

                    @if (selectedSystem(); as system) {
                        <div class="rounded-border border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-800/70 dark:text-surface-200">
                            <span class="font-medium">Host selecionado:</span> {{ system.host }}
                        </div>
                    }

                    @if (loading() && !transactions().length) {
                        <div class="rounded-border border border-dashed border-surface-300 px-6 py-10 text-center text-surface-500">
                            Carregando transacoes...
                        </div>
                    } @else {
                        <p-table
                            [value]="filteredTransactions()"
                            [loading]="loading()"
                            [paginator]="true"
                            [rows]="10"
                            [rowsPerPageOptions]="[10, 20, 50]"
                            [showCurrentPageReport]="true"
                            currentPageReportTemplate="Mostrando {first} a {last} de {totalRecords} transacoes"
                            [rowHover]="true"
                            [stripedRows]="true"
                            [scrollable]="true"
                            dataKey="id"
                            styleClass="p-datatable-sm transactions-table"
                            [tableStyle]="{ 'min-width': '72rem' }"
                        >
                            <ng-template #header>
                                <tr>
                                    <th style="width: 1%">Acoes</th>
                                    <th style="width: 1%">Status</th>
                                    <th style="width: 1%">Criado em</th>
                                    <th style="width: 1%">Expira em</th>
                                    <th style="width: 1%">Valor</th>
                                    <th style="width: 1%">Cliente</th>
                                    <th style="width: 1%">Empresa</th>
                                    <th style="width: 1%">Reference</th>
                                    <th style="width: 1%">Tipo</th>
                                    <th style="width: 1%">ID</th>
                                    <th style="width: 1%">ID Ref.</th>
                                    <th style="width: 1%">Status Titulo Ref.</th>
                                    <th style="width: 1%">Vencimento Ref.</th>
                                </tr>
                            </ng-template>

                            <ng-template #body let-transaction>
                                <tr>
                                    <td>
                                        <div class="flex items-center gap-1 whitespace-nowrap">
                                            <p-button
                                                icon="pi pi-eye"
                                                size="small"
                                                severity="secondary"
                                                [outlined]="true"
                                                [disabled]="!hasTransactionId(transaction)"
                                                pTooltip="Abrir detalhes e consultar pagamento"
                                                tooltipPosition="top"
                                                (onClick)="consultPayment(transaction, $event)"
                                            />
                                            <app-pix-share-link
                                                [data]="buildTransactionShareData(transaction)"
                                                [showLabels]="false"
                                            />
                                            @if (canRetrySettlement() && isRetryableSettlement(transaction)) {
                                                <p-button
                                                    icon="pi pi-replay"
                                                    size="small"
                                                    severity="danger"
                                                    [outlined]="true"
                                                    [loading]="isRetryingSettlement(transaction)"
                                                    [disabled]="!hasTransactionId(transaction)"
                                                    pTooltip="Retentar baixa"
                                                    tooltipPosition="top"
                                                    (onClick)="retrySettlement(transaction, $event)"
                                                />
                                            }
                                        </div>
                                    </td>
                                    <td>
                                        <p-tag [value]="getTransactionStatus(transaction)" [severity]="getStatusSeverity(getTransactionStatus(transaction))" />
                                    </td>
                                    <td>{{ formatTableDate(transaction.createdAt) }}</td>
                                    <td>
                                        <span
                                            [ngClass]="getExpirationClass(transaction)"
                                            [pTooltip]="getExpirationTooltip(transaction)"
                                            tooltipPosition="top"
                                        >
                                            {{ getExpirationCountdown(transaction) }}
                                        </span>
                                    </td>
                                    <td>{{ formatCurrency(transaction.valor) }}</td>
                                    <td>{{ getDisplayValue(transaction.clienteNome) }}</td>
                                    <td>{{ getDisplayValue(transaction.empresa) }}</td>
                                    <td>
                                        <div class="flex items-center gap-2 min-w-0">
                                            <span class="block truncate" style="max-width: 10rem" [title]="getDisplayValue(transaction.reference)">
                                                {{ truncateReference(transaction.reference) }}
                                            </span>
                                            <p-button
                                                icon="pi pi-copy"
                                                size="small"
                                                severity="secondary"
                                                styleClass="table-copy-button"
                                                [text]="true"
                                                [rounded]="true"
                                                [ariaLabel]="getCopiedLabel(getTableCopyKey('reference', transaction.id), 'Copiar reference')"
                                                [disabled]="!hasCopyableValue(transaction.reference)"
                                                (onClick)="copyTextValue(getTableCopyKey('reference', transaction.id), transaction.reference, $event)"
                                            />
                                        </div>
                                    </td>
                                    <td>{{ getTransactionTypeLabel(transaction.tipoTransacao) }}</td>
                                    <td>
                                        <div class="flex items-center gap-1 min-w-0">
                                            <span class="font-mono text-sm" [title]="getDisplayValue(transaction.id)">
                                                {{ truncateId(transaction.id) }}
                                            </span>
                                            <p-button
                                                icon="pi pi-copy"
                                                size="small"
                                                severity="secondary"
                                                styleClass="table-copy-button"
                                                [text]="true"
                                                [rounded]="true"
                                                [ariaLabel]="getCopiedLabel(getTableCopyKey('id', transaction.id), 'Copiar ID')"
                                                [disabled]="!hasCopyableValue(transaction.id)"
                                                (onClick)="copyTextValue(getTableCopyKey('id', transaction.id), transaction.id, $event)"
                                            />
                                        </div>
                                    </td>
                                    <td>{{ getDisplayValue(transaction.idLancamento) }}</td>
                                    <td>{{ getStatusTitleReferenceValue(transaction.statusTituloRef ?? transaction.statusTitulo) }}</td>
                                    <td>{{ formatTableDate(transaction.vencimentoTitulo) }}</td>
                                </tr>
                            </ng-template>

                            <ng-template #emptymessage>
                                <tr>
                                    <td colspan="13" class="text-center py-8 text-surface-500">
                                        Nenhuma transacao encontrada para os filtros atuais.
                                    </td>
                                </tr>
                            </ng-template>

                            <ng-template #loadingbody>
                                <tr>
                                    <td colspan="13" class="text-center py-8 text-surface-500">
                                        Atualizando transacoes...
                                    </td>
                                </tr>
                            </ng-template>
                        </p-table>
                    }
                </div>
            </div>
        </div>

        <p-dialog
            [visible]="detailsVisible()"
            (visibleChange)="detailsVisible.set($event)"
            [modal]="true"
            [dismissableMask]="true"
            [draggable]="false"
            [resizable]="false"
            [breakpoints]="{ '1280px': '90vw' }"
            styleClass="transactions-dialog"
            [style]="{ width: '72rem', maxWidth: '96vw' }"
        >
            <ng-template #header>
                <div class="flex w-full flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div class="flex flex-col">
                        <div class="text-lg font-semibold">Detalhes da transacao</div>
                        @if (selectedTransaction(); as transaction) {
                            <div class="text-sm text-surface-500">TxID: {{ getDisplayValue(transaction.txId) }}</div>
                        }
                    </div>
                    @if (selectedTransaction(); as transaction) {
                        <app-pix-share-link
                            [data]="buildTransactionShareData(transaction)"
                            copyLabel="Compartilhar transacao"
                            openLabel="Abrir transacao"
                        />
                    }
                </div>
            </ng-template>
            <ng-template #content>
                @if (selectedTransaction(); as transaction) {
                    <div class="flex flex-col gap-6">
                        <div class="rounded-border border border-emerald-200 bg-emerald-50/60 p-5 flex flex-col gap-5 dark:border-emerald-800 dark:bg-emerald-950/25">
                            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div class="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Dados do pagamento</div>
                                    <div class="text-lg font-semibold text-emerald-950 dark:text-emerald-100">Retorno da consulta no provedor PIX</div>
                                </div>
                                <div class="flex justify-end">
                                    <p-button
                                        label="Consultar pagamento"
                                        icon="pi pi-search"
                                        [disabled]="!hasTransactionId(transaction)"
                                        (onClick)="consultPayment(transaction, $event)"
                                    />
                                </div>
                            </div>

                            @if (paymentConsultationLoading()) {
                                <div class="rounded-border border border-dashed border-emerald-300 bg-white/70 px-6 py-8 text-center text-emerald-800 dark:border-emerald-800 dark:bg-surface-900/70 dark:text-emerald-100">
                                    Consultando pagamento...
                                </div>
                            } @else if (paymentConsultationError()) {
                                <div class="rounded-border border border-red-200 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                    <span>{{ paymentConsultationError() }}</span>
                                    <p-button
                                        label="Consultar novamente"
                                        icon="pi pi-refresh"
                                        severity="danger"
                                        [text]="true"
                                        [disabled]="!hasTransactionId(transaction)"
                                        (onClick)="consultPayment(transaction, $event)"
                                    />
                                </div>
                            } @else if (paymentConsultationResult(); as payment) {
                                <div class="grid grid-cols-12 gap-4">
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full dark:border-emerald-800 dark:bg-surface-900">
                                            <div class="text-sm text-surface-500 mb-2">TXID</div>
                                            <div class="font-semibold text-lg break-all">{{ getDisplayValue(payment.txId) }}</div>
                                        </div>
                                    </div>
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full dark:border-emerald-800 dark:bg-surface-900">
                                            <div class="text-sm text-surface-500 mb-2">Situacao</div>
                                            <p-tag [value]="getPaymentStatusLabel(payment)" [severity]="getPaymentStatusSeverity(payment)" />
                                        </div>
                                    </div>
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full dark:border-emerald-800 dark:bg-surface-900">
                                            <div class="text-sm text-surface-500 mb-2">Valor original</div>
                                            <div class="font-semibold text-lg">{{ formatCurrency(payment.originalAmount ?? payment.valor) }}</div>
                                        </div>
                                    </div>
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full dark:border-emerald-800 dark:bg-surface-900">
                                            <div class="text-sm text-surface-500 mb-2">Valor recebido</div>
                                            <div class="font-semibold text-lg">{{ formatCurrency(payment.receivedAmount) }}</div>
                                        </div>
                                    </div>
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full dark:border-emerald-800 dark:bg-surface-900">
                                            <div class="text-sm text-surface-500 mb-2">Data do pagamento</div>
                                            <div class="font-semibold text-lg">{{ formatDetailDate(payment.paymentDate) }}</div>
                                        </div>
                                    </div>
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full dark:border-emerald-800 dark:bg-surface-900">
                                            <div class="text-sm text-surface-500 mb-2">Tipo de pagamento</div>
                                            <div class="font-semibold text-lg">{{ getDisplayValue(payment.paymentType) }}</div>
                                        </div>
                                    </div>
                                </div>

                                @if (hasLegacyPaymentDetails(payment)) {
                                    <div class="grid grid-cols-12 gap-4">
                                        <div class="col-span-12 md:col-span-6">
                                            <div class="rounded-border border border-emerald-200 bg-white p-4 h-full dark:border-emerald-800 dark:bg-surface-900">
                                                <div class="text-sm text-surface-500 mb-2">Descricao</div>
                                                <div class="font-medium break-words">{{ getDisplayValue(payment.descricao) }}</div>
                                            </div>
                                        </div>
                                        <div class="col-span-12 md:col-span-6">
                                            <div class="rounded-border border border-emerald-200 bg-white p-4 h-full dark:border-emerald-800 dark:bg-surface-900">
                                                <div class="text-sm text-surface-500 mb-2">Expiracao</div>
                                                <div class="font-semibold text-lg">{{ formatDetailDate(payment.expiracaoEm) }}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-12 gap-4">
                                        <div class="col-span-12">
                                            <div class="rounded-border border border-emerald-200 bg-white p-4 h-full flex flex-col gap-3 dark:border-emerald-800 dark:bg-surface-900">
                                                <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                    <div class="text-sm text-surface-500">Pix copia e cola do pagamento</div>
                                                    <p-button
                                                        [label]="getCopiedLabel('payment-pix', 'Copiar PIX')"
                                                        icon="pi pi-copy"
                                                        size="small"
                                                        severity="secondary"
                                                        [outlined]="true"
                                                        [disabled]="!getQrCodeValue(payment).trim()"
                                                        (onClick)="copyPixValue('payment-pix', payment, $event)"
                                                    />
                                                </div>
                                                @if (getQrCodeValue(payment).trim()) {
                                                    <div class="rounded-border bg-surface-50 p-3 font-mono text-sm break-all min-h-24 dark:bg-surface-800/80">
                                                        {{ getQrCodeValue(payment) }}
                                                    </div>
                                                } @else {
                                                    <div class="text-surface-500 text-sm">Nenhum valor de PIX copia e cola retornado na consulta.</div>
                                                }
                                            </div>
                                        </div>
                                    </div>

                                }
                            } @else {
                                <div class="rounded-border border border-dashed border-emerald-300 bg-white/70 px-6 py-8 text-center text-emerald-800 dark:border-emerald-800 dark:bg-surface-900/70 dark:text-emerald-100">
                                    Execute a consulta para carregar os dados do pagamento separados dos dados da transacao.
                                </div>
                            }
                        </div>

                        <div class="rounded-border border border-surface-200 bg-surface-0 p-5 flex flex-col gap-5 dark:border-surface-700 dark:bg-surface-900">
                            <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div class="text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">Dados da transacao</div>
                                    <div class="text-lg font-semibold text-surface-900 dark:text-surface-0">Registro interno e cobranca gerada</div>
                                </div>
                                <div class="text-sm text-surface-500">Campos salvos na transacao selecionada</div>
                            </div>

                            <div class="grid grid-cols-12 gap-4">
                                <div class="col-span-12 md:col-span-4">
                                    <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                        <div class="text-sm text-surface-500 mb-2">Status</div>
                                        <p-tag [value]="getTransactionStatus(transaction)" [severity]="getStatusSeverity(getTransactionStatus(transaction))" />
                                    </div>
                                </div>
                                <div class="col-span-12 md:col-span-4">
                                    <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                        <div class="text-sm text-surface-500 mb-2">Valor</div>
                                        <div class="font-semibold text-lg">{{ formatCurrency(transaction.valor) }}</div>
                                    </div>
                                </div>
                                <div class="col-span-12 md:col-span-4">
                                    <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                        <div class="text-sm text-surface-500 mb-2">Criado em</div>
                                        <div class="font-semibold text-lg">{{ formatDetailDate(transaction.createdAt) }}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="grid grid-cols-12 gap-4">
                                @for (entry of detailEntries(); track entry.field) {
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                            <div class="text-sm text-surface-500 mb-2">{{ entry.label }}</div>
                                            @if (entry.field === 'status') {
                                                <p-tag [value]="getTransactionStatusLabel(entry.value)" [severity]="getStatusSeverity(entry.value)" />
                                            } @else if (entry.field === 'statusTituloRef' || entry.field === 'statusTitulo') {
                                                <div class="font-medium break-words">{{ getStatusTitleReferenceValue(entry.value) }}</div>
                                            } @else if (isLargeTextField(entry.field)) {
                                                <div class="max-h-40 overflow-auto rounded-border bg-surface-50 p-3 font-mono text-xs break-all dark:bg-surface-800/80">
                                                    {{ getDisplayValue(entry.value) }}
                                                </div>
                                            } @else {
                                                <div class="font-medium break-words">{{ formatDetailValue(entry.field, entry.value) }}</div>
                                            }
                                        </div>
                                    </div>
                                }
                            </div>

                            <div class="grid grid-cols-12 gap-4">
                                <div class="col-span-12">
                                    <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full flex flex-col gap-3 dark:border-surface-700 dark:bg-surface-900">
                                        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div class="text-sm text-surface-500">Pix copia e cola da transacao</div>
                                            <p-button
                                                [label]="getCopiedLabel('transaction-pix', 'Copiar PIX')"
                                                icon="pi pi-copy"
                                                size="small"
                                                severity="secondary"
                                                [outlined]="true"
                                                [disabled]="!getQrCodeValue(transaction).trim()"
                                                (onClick)="copyPixValue('transaction-pix', transaction, $event)"
                                            />
                                        </div>
                                        @if (getQrCodeValue(transaction).trim()) {
                                            <div class="rounded-border bg-surface-50 p-3 font-mono text-sm break-all min-h-24 dark:bg-surface-800/80">
                                                {{ getQrCodeValue(transaction) }}
                                            </div>
                                        } @else {
                                            <div class="text-surface-500 text-sm">Nenhum valor de PIX copia e cola disponivel.</div>
                                        }
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>
                }
            </ng-template>
        </p-dialog>
    `
})
export class Transactions implements OnInit {
    private readonly appConfig = inject(AppConfigService);
    private readonly authService = inject(AuthService);
    private readonly transactionsService = inject(TransactionsService);
    private readonly pixService = inject(PixService);
    private readonly destroyRef = inject(DestroyRef);

    readonly systems = this.appConfig.systems;
    readonly transactions = signal<TransactionDocument[]>([]);
    readonly loading = signal(false);
    readonly errorMessage = signal('');
    readonly searchTerm = signal('');
    readonly statusFilter = signal('');
    readonly detailsVisible = signal(false);
    readonly selectedTransaction = signal<TransactionDocument | null>(null);
    readonly paymentConsultationLoading = signal(false);
    readonly paymentConsultationError = signal('');
    readonly paymentConsultationResult = signal<TransactionPaymentConsultationResponse | null>(null);
    readonly copiedValueKey = signal('');
    readonly selectedSystemName = signal(this.systems[0]?.nome ?? '');
    readonly now = signal(Date.now());
    readonly retryingTransactionIds = signal<ReadonlySet<string>>(new Set());

    private copyFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;
    readonly selectedSystem = computed(() => this.systems.find((system) => system.nome === this.selectedSystemName()) ?? null);
    readonly canRetrySettlement = computed(() => this.appConfig.features.retrySettlementEnabled && this.authService.hasRole('ADMIN'));

    readonly filteredTransactions = computed(() => {
        const searchTerm = this.searchTerm().trim().toLowerCase();
        const statusFilter = this.statusFilter().trim().toLowerCase();

        return this.transactions().filter((transaction) => {
            const matchesStatus = !statusFilter || this.normalizeText(this.getTransactionStatus(transaction)) === statusFilter;
            const matchesText =
                !searchTerm ||
                TEXT_FILTER_FIELDS.some((field) => {
                    return this.normalizeText(transaction[field]).includes(searchTerm);
                });

            return matchesStatus && matchesText;
        });
    });

    readonly statusOptions = computed(() => {
        const statuses = Array.from(
            new Set(
                this.transactions()
                    .map((transaction) => this.getTransactionStatus(transaction).trim())
                    .filter((status): status is string => Boolean(status))
            )
        ).sort((left, right) => left.localeCompare(right, 'pt-BR'));

        return [{ label: 'Todos os status', value: '' }, ...statuses.map((status) => ({ label: status, value: status }))];
    });

    readonly hasActiveFilters = computed(() => Boolean(this.searchTerm().trim() || this.statusFilter().trim()));

    readonly detailEntries = computed<TransactionDetailEntry[]>(() => {
        const transaction = this.selectedTransaction();

        if (!transaction) {
            return [];
        }

        const entries: TransactionDetailEntry[] = [];
        const seenFields = new Set<string>();

        for (const field of FIELD_ORDER) {
            if (field in transaction && !HIDDEN_DETAIL_FIELDS.has(field)) {
                entries.push({
                    field,
                    label: FIELD_LABELS[field] ?? field,
                    value: transaction[field]
                });
                seenFields.add(field);
            }
        }

        for (const field of Object.keys(transaction).sort((left, right) => left.localeCompare(right))) {
            if (!seenFields.has(field) && !HIDDEN_DETAIL_FIELDS.has(field)) {
                entries.push({
                    field,
                    label: FIELD_LABELS[field] ?? field,
                    value: transaction[field]
                });
            }
        }

        return entries;
    });

    ngOnInit(): void {
        interval(1000)
            .pipe(startWith(0), takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                this.now.set(Date.now());
            });

        this.reloadTransactions();
    }

    reloadTransactions(): void {
        const system = this.selectedSystem();

        if (!system) {
            this.transactions.set([]);
            this.loading.set(false);
            this.errorMessage.set('Selecione um sistema para carregar as transacoes.');
            return;
        }

        this.loading.set(true);
        this.errorMessage.set('');

        this.transactionsService.getTransactions(system.host).subscribe({
            next: (transactions) => {
                this.transactions.set(this.sortTransactions(transactions));
                this.loading.set(false);
            },
            error: (error: HttpErrorResponse) => {
                this.loading.set(false);
                this.errorMessage.set(getApiErrorMessage(error, 'Nao foi possivel carregar as transacoes.'));
            }
        });
    }

    onSystemChange(systemName: string): void {
        this.selectedSystemName.set(systemName);
        this.transactions.set([]);
        this.selectedTransaction.set(null);
        this.detailsVisible.set(false);
        this.clearFilters();
        this.resetPaymentConsultation();
        this.reloadTransactions();
    }

    clearFilters(): void {
        this.searchTerm.set('');
        this.statusFilter.set('');
    }

    openDetails(transaction: TransactionDocument): void {
        this.selectedTransaction.set(transaction);
        this.detailsVisible.set(true);
        this.resetPaymentConsultation();
    }

    consultPayment(transaction: TransactionDocument, event?: Event): void {
        event?.stopPropagation();

        const transactionId = this.getTransactionId(transaction);

        if (!transactionId) {
            return;
        }

        this.selectedTransaction.set(transaction);
        this.detailsVisible.set(true);
        this.paymentConsultationLoading.set(true);
        this.paymentConsultationError.set('');
        this.paymentConsultationResult.set(null);

        const source$ = this.pixService.consultTransactionPayment(transactionId, this.selectedSystem()?.host);

        source$.subscribe({
            next: (payment) => {
                this.paymentConsultationResult.set(payment);
                this.paymentConsultationLoading.set(false);
            },
            error: (error: HttpErrorResponse) => {
                this.paymentConsultationLoading.set(false);
                this.paymentConsultationError.set(getApiErrorMessage(error, 'Nao foi possivel consultar o pagamento desta transacao.'));
            }
        });
    }

    hasTransactionId(transaction: TransactionDocument): boolean {
        return Boolean(this.getTransactionId(transaction));
    }

    isRetryableSettlement(transaction: TransactionDocument): boolean {
        return this.normalizeText(transaction.status) === 'erro na baixa';
    }

    isRetryingSettlement(transaction: TransactionDocument): boolean {
        const transactionId = this.getTransactionId(transaction);
        return Boolean(transactionId) && this.retryingTransactionIds().has(transactionId);
    }

    retrySettlement(transaction: TransactionDocument, event?: Event): void {
        event?.stopPropagation();

        const transactionId = this.getTransactionId(transaction);

        if (!transactionId || this.isRetryingSettlement(transaction)) {
            return;
        }

        this.setRetrying(transactionId, true);

        this.transactionsService.retrySettlement(transactionId, this.selectedSystem()?.host).subscribe({
            next: (updatedTransaction) => {
                this.applyTransactionUpdate(updatedTransaction);
                this.setRetrying(transactionId, false);
            },
            error: (error: HttpErrorResponse) => {
                this.errorMessage.set(getApiErrorMessage(error, 'Nao foi possivel retentar a baixa desta transacao.'));
                this.setRetrying(transactionId, false);
            }
        });
    }

    getDisplayValue(value: unknown): string {
        if (value === null || value === undefined) {
            return '-';
        }

        const normalizedValue = String(value).trim();
        return normalizedValue ? normalizedValue : '-';
    }

    formatCurrency(value: unknown): string {
        const numericValue = typeof value === 'number' ? value : Number(value);

        return Number.isFinite(numericValue) ? currencyFormatter.format(numericValue) : '-';
    }

    formatTableDate(value: unknown): string {
        return this.formatDate(value, tableDateFormatter);
    }

    formatDetailDate(value: unknown): string {
        return this.formatDate(value, detailDateFormatter);
    }

    formatDetailValue(field: string, value: unknown): string {
        if (field === 'valor') {
            return this.formatCurrency(value);
        }

        if (field === 'status') {
            return this.getTransactionStatusLabel(value);
        }

        if (field === 'statusTituloRef' || field === 'statusTitulo') {
            return this.getStatusTitleReferenceValue(value);
        }

        if (field === 'tipoTransacao') {
            return this.getTransactionTypeLabel(value);
        }

        if (DATE_FIELDS.has(field)) {
            return this.formatDetailDate(value);
        }

        if (value && typeof value === 'object') {
            return JSON.stringify(value);
        }

        return this.getDisplayValue(value);
    }

    getStatusSeverity(status: unknown): TransactionTagSeverity {
        const normalizedStatus = this.normalizeText(status);

        if (!normalizedStatus) {
            return 'secondary';
        }

        if (normalizedStatus.includes('pago') || normalizedStatus.includes('baixado') || normalizedStatus.includes('concl')) {
            return 'success';
        }

        if (normalizedStatus.includes('expir') || normalizedStatus.includes('venc')) {
            return 'warn';
        }

        if (normalizedStatus.includes('cancel') || normalizedStatus.includes('erro') || normalizedStatus.includes('falh')) {
            return 'danger';
        }

        if (normalizedStatus.includes('pend') || normalizedStatus.includes('aguard') || normalizedStatus.includes('process')) {
            return 'info';
        }

        return 'secondary';
    }

    getTransactionStatusLabel(status: unknown): string {
        const normalizedStatus = this.normalizeText(status);

        if (!normalizedStatus) {
            return 'Criado';
        }

        return this.getDisplayValue(status);
    }

    getTransactionStatus(transaction: TransactionDocument): string {
        return this.getTransactionStatusLabel(transaction.status);
    }

    getStatusTitleReferenceValue(value: unknown): string {
        if (value === null || value === undefined) {
            return '-';
        }

        const normalizedValue = String(value).trim();
        return normalizedValue || '-';
    }

    /**
     * O dinheiro ja entrou: "Pago" e "Erro na baixa" (pagamento confirmado, so a baixa
     * no ERP falhou). Nesses casos a expiracao do QR Code nao diz mais nada, e mostrar
     * "Expirado" em vermelho passa a impressao de problema no pagamento.
     */
    isPaidTransaction(transaction: TransactionDocument): boolean {
        const normalizedStatus = this.normalizeText(transaction.status);
        return normalizedStatus === 'pago' || normalizedStatus === 'erro na baixa';
    }

    getExpirationCountdown(transaction: TransactionDocument): string {
        if (this.isPaidTransaction(transaction)) {
            return 'Pago';
        }

        const timestamp = this.getTimestamp(transaction.pixExpiraEm);

        if (!timestamp) {
            return '-';
        }

        const diff = timestamp - this.now();

        if (diff <= 0) {
            return 'Expirado';
        }

        return this.formatDuration(diff);
    }

    isExpired(value: unknown): boolean {
        const timestamp = this.getTimestamp(value);
        return Boolean(timestamp && timestamp <= this.now());
    }

    getExpirationClass(transaction: TransactionDocument): string {
        return !this.isPaidTransaction(transaction) && this.isExpired(transaction.pixExpiraEm)
            ? 'font-semibold text-red-600 dark:text-red-300'
            : 'font-semibold text-green-600 dark:text-green-300';
    }

    getExpirationTooltip(transaction: TransactionDocument): string {
        if (this.isPaidTransaction(transaction)) {
            const paidAt = this.formatDetailDate(transaction['pagamentoConfirmadoEm']);
            return paidAt === '-' ? 'Pagamento confirmado' : `Pago em ${paidAt}`;
        }

        const absoluteDate = this.formatDetailDate(transaction.pixExpiraEm);

        if (absoluteDate === '-') {
            return 'Expiracao nao informada';
        }

        return `Expira em ${absoluteDate}`;
    }

    getPaymentStatusLabel(payment: TransactionPaymentConsultationResponse): string {
        if (typeof payment.paid === 'boolean') {
            return payment.paid ? 'Pago' : 'Nao pago';
        }

        return this.getDisplayValue(payment.status);
    }

    getPaymentStatusSeverity(payment: TransactionPaymentConsultationResponse): TransactionTagSeverity {
        if (typeof payment.paid === 'boolean') {
            return payment.paid ? 'success' : 'warn';
        }

        return this.getStatusSeverity(payment.status);
    }

    getQrCodeImageSource(source: { qrCodeBase64?: unknown }): string | null {
        const qrCodeBase64 = source.qrCodeBase64;

        if (typeof qrCodeBase64 !== 'string') {
            return null;
        }

        const normalizedQrCodeBase64 = qrCodeBase64.trim();

        if (!normalizedQrCodeBase64) {
            return null;
        }

        return normalizedQrCodeBase64.startsWith('data:') ? normalizedQrCodeBase64 : `data:image/png;base64,${normalizedQrCodeBase64}`;
    }

    getQrCodeValue(source: { qrCode?: unknown }): string {
        return typeof source.qrCode === 'string' ? source.qrCode : '';
    }

    getTransactionTypeLabel(value: unknown): string {
        return getPixTransactionTypeLabel(this.normalizeTransactionType(value));
    }

    truncateId(value: unknown): string {
        const display = this.getDisplayValue(value);
        if (display === '-') return display;
        return display.length > 6 ? display.slice(0, 6) + '…' : display;
    }

    truncateReference(value: unknown): string {
        const display = this.getDisplayValue(value);
        if (display === '-') return display;
        return display.length > 8 ? display.slice(0, 8) : display;
    }

    hasCopyableValue(value: unknown): boolean {
        if (value === null || value === undefined) {
            return false;
        }

        return String(value).trim().length > 0;
    }

    getTableCopyKey(field: string, transactionId: unknown): string {
        return `${field}:${this.getDisplayValue(transactionId)}`;
    }

    getCopiedLabel(copyKey: string, defaultLabel: string): string {
        return this.copiedValueKey() === copyKey ? 'Copiado' : defaultLabel;
    }

    async copyPixValue(sourceKey: string, source: { qrCode?: unknown }, event?: Event): Promise<void> {
        await this.copyTextValue(sourceKey, this.getQrCodeValue(source), event);
    }

    buildTransactionShareData(transaction: TransactionDocument): PixShareLinkData {
        return {
            txId: transaction.txId,
            qrCode: transaction.qrCode,
            valor: transaction.valor,
            vencimento: transaction.pixExpiraEm,
            nome: transaction.nomeTitularContaRecebimento,
            system: this.selectedSystem()?.nome
        };
    }

    async copyTextValue(copyKey: string, value: unknown, event?: Event): Promise<void> {
        event?.stopPropagation();

        if (!this.hasCopyableValue(value)) {
            return;
        }

        const normalizedValue = String(value).trim();

        if (!normalizedValue) {
            return;
        }

        await this.writeToClipboard(normalizedValue);
        this.showCopyFeedback(copyKey);
    }

    private async writeToClipboard(value: string): Promise<void> {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(value);
        } else {
            const textArea = document.createElement('textarea');
            textArea.value = value;
            textArea.setAttribute('readonly', '');
            textArea.style.position = 'absolute';
            textArea.style.left = '-9999px';
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
        }
    }

    private showCopyFeedback(copyKey: string): void {
        this.copiedValueKey.set(copyKey);

        if (this.copyFeedbackTimeoutId) {
            clearTimeout(this.copyFeedbackTimeoutId);
        }

        this.copyFeedbackTimeoutId = setTimeout(() => this.copiedValueKey.set(''), 2000);
    }

    isLargeTextField(field: string): boolean {
        return field === 'qrCode' || field === 'qrCodeBase64';
    }

    hasLegacyPaymentDetails(payment: TransactionPaymentConsultationResponse): boolean {
        return Boolean(
            this.getDisplayValue(payment.descricao) !== '-' ||
                this.getDisplayValue(payment.expiracaoEm) !== '-' ||
                this.getQrCodeValue(payment).trim() ||
                this.getQrCodeImageSource(payment)
        );
    }

    private sortTransactions(transactions: TransactionDocument[]): TransactionDocument[] {
        return [...transactions].sort((left, right) => this.getTimestamp(right.createdAt) - this.getTimestamp(left.createdAt));
    }

    private setRetrying(transactionId: string, retrying: boolean): void {
        const nextRetryingIds = new Set(this.retryingTransactionIds());

        if (retrying) {
            nextRetryingIds.add(transactionId);
        } else {
            nextRetryingIds.delete(transactionId);
        }

        this.retryingTransactionIds.set(nextRetryingIds);
    }

    private applyTransactionUpdate(updatedTransaction: TransactionDocument): void {
        const updatedId = this.getTransactionId(updatedTransaction);

        this.transactions.update((current) =>
            this.sortTransactions(current.map((transaction) => (this.getTransactionId(transaction) === updatedId ? updatedTransaction : transaction)))
        );

        const selectedTransaction = this.selectedTransaction();

        if (selectedTransaction && this.getTransactionId(selectedTransaction) === updatedId) {
            this.selectedTransaction.set(updatedTransaction);
        }
    }

    private getTransactionId(transaction: TransactionDocument): string {
        if (transaction.id === null || transaction.id === undefined) {
            return '';
        }

        return String(transaction.id).trim();
    }

    private resetPaymentConsultation(): void {
        this.paymentConsultationLoading.set(false);
        this.paymentConsultationError.set('');
        this.paymentConsultationResult.set(null);
    }

    private normalizeText(value: unknown): string {
        if (value === null || value === undefined) {
            return '';
        }

        return String(value).trim().toLowerCase();
    }

    private normalizeTransactionType(value: unknown): PixTransactionType {
        if (typeof value === 'string') {
            const normalizedValue = value.trim().toUpperCase();

            if (
                normalizedValue === 'CONTAS_RECEBER' ||
                normalizedValue === 'ADIANTAMENTO' ||
                normalizedValue === 'ORCAMENTO' ||
                normalizedValue === 'PEDIDO'
            ) {
                return normalizedValue;
            }
        }

        return 'CONTAS_RECEBER';
    }

    private normalizeOptionalValue(value: unknown): string | number | null {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string') {
            const trimmedValue = value.trim();
            return trimmedValue ? trimmedValue : null;
        }

        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }

        const normalizedValue = String(value).trim();
        return normalizedValue ? normalizedValue : null;
    }

    private formatDate(value: unknown, formatter: Intl.DateTimeFormat): string {
        const timestamp = this.getTimestamp(value);

        return timestamp ? formatter.format(timestamp) : '-';
    }

    private formatDuration(milliseconds: number): string {
        const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
        const totalMinutes = Math.floor(totalSeconds / 60);
        const totalHours = Math.floor(totalMinutes / 60);
        const days = Math.floor(totalHours / 24);
        const hours = Math.floor(totalMinutes / 60);
        const minutes = totalMinutes % 60;
        const seconds = totalSeconds % 60;

        if (days > 0) {
            return `${days}d ${String(totalHours % 24).padStart(2, '0')}h`;
        }

        if (hours > 0) {
            return `${hours}h ${minutes.toString().padStart(2, '0')}m`;
        }

        if (minutes > 0) {
            return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
        }

        return `${seconds}s`;
    }

    private getTimestamp(value: unknown): number {
        if (value === null || value === undefined || value === '') {
            return 0;
        }

        const timestamp = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }
}
