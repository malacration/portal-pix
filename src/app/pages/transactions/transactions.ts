import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
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
    id: 'ID',
    idLancamento: 'ID lancamento',
    txId: 'TxID',
    reference: 'Reference',
    empresa: 'Empresa',
    empresaCod: 'Codigo empresa',
    clienteNome: 'Cliente',
    clienteCodigo: 'Codigo cliente',
    valor: 'Valor',
    statusTitulo: 'Status',
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
    'id',
    'idLancamento',
    'txId',
    'reference',
    'empresa',
    'empresaCod',
    'clienteNome',
    'clienteCodigo',
    'valor',
    'statusTitulo',
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
    imports: [CommonModule, FormsModule, TableModule, ButtonModule, InputTextModule, SelectModule, DialogModule, TagModule, IconFieldModule, InputIconModule],
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
                        <div class="col-span-12 lg:col-span-7">
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
                        <div class="rounded-border border border-red-200 bg-red-50 px-4 py-3 text-red-700 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <span>{{ errorMessage() }}</span>
                            <p-button label="Tentar novamente" icon="pi pi-refresh" severity="danger" [text]="true" (onClick)="reloadTransactions()" />
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
                            [scrollable]="true"
                            dataKey="id"
                            styleClass="p-datatable-sm"
                            [tableStyle]="{ 'min-width': '96rem' }"
                        >
                            <ng-template #header>
                                <tr>
                                    <th style="min-width: 10rem">Acoes</th>
                                    <th style="min-width: 10rem">ID</th>
                                    <th style="min-width: 10rem">ID lancamento</th>
                                    <th style="min-width: 12rem">Reference</th>
                                    <th style="min-width: 12rem">Empresa</th>
                                    <th style="min-width: 12rem">Cliente</th>
                                    <th style="min-width: 9rem">Valor</th>
                                    <th style="min-width: 10rem">Status</th>
                                    <th style="min-width: 11rem">Vencimento</th>
                                    <th style="min-width: 11rem">Pix gerado</th>
                                    <th style="min-width: 11rem">Pix expira</th>
                                    <th style="min-width: 11rem">Criado em</th>
                                    <th style="min-width: 12rem">TxID</th>
                                </tr>
                            </ng-template>

                            <ng-template #body let-transaction>
                                <tr class="cursor-pointer" (click)="openDetails(transaction)">
                                    <td>
                                        <p-button
                                            label="Consultar"
                                            icon="pi pi-search"
                                            size="small"
                                            severity="secondary"
                                            [outlined]="true"
                                            [disabled]="!hasTransactionId(transaction)"
                                            (onClick)="consultPayment(transaction, $event)"
                                        />
                                    </td>
                                    <td>
                                        <div class="flex items-center gap-2 min-w-0">
                                            <span class="block truncate" style="max-width: 8rem" [title]="getDisplayValue(transaction.id)">
                                                {{ getDisplayValue(transaction.id) }}
                                            </span>
                                            <p-button
                                                icon="pi pi-copy"
                                                size="small"
                                                severity="secondary"
                                                [text]="true"
                                                [rounded]="true"
                                                [ariaLabel]="getCopiedLabel(getTableCopyKey('id', transaction.id), 'Copiar ID')"
                                                [disabled]="!hasCopyableValue(transaction.id)"
                                                (onClick)="copyTextValue(getTableCopyKey('id', transaction.id), transaction.id, $event)"
                                            />
                                        </div>
                                    </td>
                                    <td>{{ getDisplayValue(transaction.idLancamento) }}</td>
                                    <td>
                                        <div class="flex items-center gap-2 min-w-0">
                                            <span class="block truncate" style="max-width: 10rem" [title]="getDisplayValue(transaction.reference)">
                                                {{ getDisplayValue(transaction.reference) }}
                                            </span>
                                            <p-button
                                                icon="pi pi-copy"
                                                size="small"
                                                severity="secondary"
                                                [text]="true"
                                                [rounded]="true"
                                                [ariaLabel]="getCopiedLabel(getTableCopyKey('reference', transaction.id), 'Copiar reference')"
                                                [disabled]="!hasCopyableValue(transaction.reference)"
                                                (onClick)="copyTextValue(getTableCopyKey('reference', transaction.id), transaction.reference, $event)"
                                            />
                                        </div>
                                    </td>
                                    <td>{{ getDisplayValue(transaction.empresa) }}</td>
                                    <td>{{ getDisplayValue(transaction.clienteNome) }}</td>
                                    <td>{{ formatCurrency(transaction.valor) }}</td>
                                    <td>
                                        <p-tag [value]="getDisplayValue(transaction.statusTitulo)" [severity]="getStatusSeverity(transaction.statusTitulo)" />
                                    </td>
                                    <td>{{ formatTableDate(transaction.vencimentoTitulo) }}</td>
                                    <td>{{ formatTableDate(transaction.pixGeradoEm) }}</td>
                                    <td>{{ formatTableDate(transaction.pixExpiraEm) }}</td>
                                    <td>{{ formatTableDate(transaction.createdAt) }}</td>
                                    <td>
                                        <div class="flex items-center gap-2 min-w-0">
                                            <span class="block truncate" style="max-width: 10rem" [title]="getDisplayValue(transaction.txId)">
                                                {{ getDisplayValue(transaction.txId) }}
                                            </span>
                                            <p-button
                                                icon="pi pi-copy"
                                                size="small"
                                                severity="secondary"
                                                [text]="true"
                                                [rounded]="true"
                                                [ariaLabel]="getCopiedLabel(getTableCopyKey('txId', transaction.id), 'Copiar TxID')"
                                                [disabled]="!hasCopyableValue(transaction.txId)"
                                                (onClick)="copyTextValue(getTableCopyKey('txId', transaction.id), transaction.txId, $event)"
                                            />
                                        </div>
                                    </td>
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
            header="Detalhes da transacao"
            [modal]="true"
            [draggable]="false"
            [resizable]="false"
            [breakpoints]="{ '1280px': '90vw' }"
            [style]="{ width: '72rem', maxWidth: '96vw' }"
        >
            <ng-template #content>
                @if (selectedTransaction(); as transaction) {
                    <div class="flex flex-col gap-6">
                        <div class="rounded-border border border-emerald-200 bg-emerald-50/60 p-5 flex flex-col gap-5">
                            <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div class="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Dados do pagamento</div>
                                    <div class="text-lg font-semibold text-emerald-950">Retorno da consulta no provedor PIX</div>
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
                                <div class="rounded-border border border-dashed border-emerald-300 bg-white/70 px-6 py-8 text-center text-emerald-800">
                                    Consultando pagamento...
                                </div>
                            } @else if (paymentConsultationError()) {
                                <div class="rounded-border border border-red-200 bg-red-50 px-4 py-3 text-red-700 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full">
                                            <div class="text-sm text-surface-500 mb-2">TXID</div>
                                            <div class="font-semibold text-lg break-all">{{ getDisplayValue(payment.txId) }}</div>
                                        </div>
                                    </div>
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full">
                                            <div class="text-sm text-surface-500 mb-2">Situacao</div>
                                            <p-tag [value]="getPaymentStatusLabel(payment)" [severity]="getPaymentStatusSeverity(payment)" />
                                        </div>
                                    </div>
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full">
                                            <div class="text-sm text-surface-500 mb-2">Valor original</div>
                                            <div class="font-semibold text-lg">{{ formatCurrency(payment.originalAmount ?? payment.valor) }}</div>
                                        </div>
                                    </div>
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full">
                                            <div class="text-sm text-surface-500 mb-2">Valor recebido</div>
                                            <div class="font-semibold text-lg">{{ formatCurrency(payment.receivedAmount) }}</div>
                                        </div>
                                    </div>
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full">
                                            <div class="text-sm text-surface-500 mb-2">Data do pagamento</div>
                                            <div class="font-semibold text-lg">{{ formatDetailDate(payment.paymentDate) }}</div>
                                        </div>
                                    </div>
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-emerald-200 bg-white p-4 h-full">
                                            <div class="text-sm text-surface-500 mb-2">Tipo de pagamento</div>
                                            <div class="font-semibold text-lg">{{ getDisplayValue(payment.paymentType) }}</div>
                                        </div>
                                    </div>
                                </div>

                                @if (hasLegacyPaymentDetails(payment)) {
                                    <div class="grid grid-cols-12 gap-4">
                                        <div class="col-span-12 md:col-span-6">
                                            <div class="rounded-border border border-emerald-200 bg-white p-4 h-full">
                                                <div class="text-sm text-surface-500 mb-2">Descricao</div>
                                                <div class="font-medium break-words">{{ getDisplayValue(payment.descricao) }}</div>
                                            </div>
                                        </div>
                                        <div class="col-span-12 md:col-span-6">
                                            <div class="rounded-border border border-emerald-200 bg-white p-4 h-full">
                                                <div class="text-sm text-surface-500 mb-2">Expiracao</div>
                                                <div class="font-semibold text-lg">{{ formatDetailDate(payment.expiracaoEm) }}</div>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-12 gap-4">
                                        <div class="col-span-12">
                                            <div class="rounded-border border border-emerald-200 bg-white p-4 h-full flex flex-col gap-3">
                                                <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                                    <div class="text-sm text-surface-500">Pix copia e cola do pagamento</div>
                                                    <p-button
                                                        [label]="copiedValueKey() === 'payment' ? 'Copiado' : 'Copiar PIX'"
                                                        icon="pi pi-copy"
                                                        size="small"
                                                        severity="secondary"
                                                        [outlined]="true"
                                                        [disabled]="!getQrCodeValue(payment).trim()"
                                                        (onClick)="copyPixValue('payment', payment, $event)"
                                                    />
                                                </div>
                                                @if (getQrCodeValue(payment).trim()) {
                                                    <div class="rounded-border bg-surface-50 p-3 font-mono text-sm break-all min-h-24">
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
                                <div class="rounded-border border border-dashed border-emerald-300 bg-white/70 px-6 py-8 text-center text-emerald-800">
                                    Execute a consulta para carregar os dados do pagamento separados dos dados da transacao.
                                </div>
                            }
                        </div>

                        <div class="rounded-border border border-surface-200 bg-surface-0 p-5 flex flex-col gap-5">
                            <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                                <div>
                                    <div class="text-xs font-semibold uppercase tracking-[0.2em] text-surface-500">Dados da transacao</div>
                                    <div class="text-lg font-semibold text-surface-900">Registro interno e cobranca gerada</div>
                                </div>
                                <div class="text-sm text-surface-500">Campos salvos na transacao selecionada</div>
                            </div>

                            <div class="grid grid-cols-12 gap-4">
                                <div class="col-span-12 md:col-span-4">
                                    <div class="rounded-border border border-surface-200 p-4 h-full">
                                        <div class="text-sm text-surface-500 mb-2">Status</div>
                                        <p-tag [value]="getDisplayValue(transaction.statusTitulo)" [severity]="getStatusSeverity(transaction.statusTitulo)" />
                                    </div>
                                </div>
                                <div class="col-span-12 md:col-span-4">
                                    <div class="rounded-border border border-surface-200 p-4 h-full">
                                        <div class="text-sm text-surface-500 mb-2">Valor</div>
                                        <div class="font-semibold text-lg">{{ formatCurrency(transaction.valor) }}</div>
                                    </div>
                                </div>
                                <div class="col-span-12 md:col-span-4">
                                    <div class="rounded-border border border-surface-200 p-4 h-full">
                                        <div class="text-sm text-surface-500 mb-2">Criado em</div>
                                        <div class="font-semibold text-lg">{{ formatDetailDate(transaction.createdAt) }}</div>
                                    </div>
                                </div>
                            </div>
                            <div class="grid grid-cols-12 gap-4">
                                @for (entry of detailEntries(); track entry.field) {
                                    <div class="col-span-12 md:col-span-6">
                                        <div class="rounded-border border border-surface-200 p-4 h-full">
                                            <div class="text-sm text-surface-500 mb-2">{{ entry.label }}</div>
                                            @if (entry.field === 'statusTitulo') {
                                                <p-tag [value]="getDisplayValue(entry.value)" [severity]="getStatusSeverity(entry.value)" />
                                            } @else if (isLargeTextField(entry.field)) {
                                                <div class="max-h-40 overflow-auto rounded-border bg-surface-50 p-3 font-mono text-xs break-all">
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
                                    <div class="rounded-border border border-surface-200 p-4 h-full flex flex-col gap-3">
                                        <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                            <div class="text-sm text-surface-500">Pix copia e cola da transacao</div>
                                            <p-button
                                                [label]="copiedValueKey() === 'transaction' ? 'Copiado' : 'Copiar PIX'"
                                                icon="pi pi-copy"
                                                size="small"
                                                severity="secondary"
                                                [outlined]="true"
                                                [disabled]="!getQrCodeValue(transaction).trim()"
                                                (onClick)="copyPixValue('transaction', transaction, $event)"
                                            />
                                        </div>
                                        @if (getQrCodeValue(transaction).trim()) {
                                            <div class="rounded-border bg-surface-50 p-3 font-mono text-sm break-all min-h-24">
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
    private readonly transactionsService = inject(TransactionsService);
    private readonly pixService = inject(PixService);

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

    private copyFeedbackTimeoutId: ReturnType<typeof setTimeout> | null = null;

    readonly filteredTransactions = computed(() => {
        const searchTerm = this.searchTerm().trim().toLowerCase();
        const statusFilter = this.statusFilter().trim().toLowerCase();

        return this.transactions().filter((transaction) => {
            const matchesStatus = !statusFilter || this.normalizeText(transaction.statusTitulo) === statusFilter;
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
                    .map((transaction) => transaction.statusTitulo?.trim())
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
        this.reloadTransactions();
    }

    reloadTransactions(): void {
        this.loading.set(true);
        this.errorMessage.set('');

        this.transactionsService.getTransactions().subscribe({
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

        this.pixService.consultTransactionPayment(transactionId).subscribe({
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

    private formatDate(value: unknown, formatter: Intl.DateTimeFormat): string {
        const timestamp = this.getTimestamp(value);

        return timestamp ? formatter.format(timestamp) : '-';
    }

    private getTimestamp(value: unknown): number {
        if (value === null || value === undefined || value === '') {
            return 0;
        }

        const timestamp = value instanceof Date ? value.getTime() : new Date(String(value)).getTime();
        return Number.isNaN(timestamp) ? 0 : timestamp;
    }
}
