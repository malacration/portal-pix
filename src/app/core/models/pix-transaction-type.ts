export type PixTransactionType = 'CONTAS_RECEBER' | 'ADIANTAMENTO' | 'ORCAMENTO' | 'PEDIDO';

export const PIX_TRANSACTION_TYPE_LABELS: Record<PixTransactionType, string> = {
    CONTAS_RECEBER: 'Contas a Receber',
    ADIANTAMENTO: 'Adiantamento',
    ORCAMENTO: 'Orcamento',
    PEDIDO: 'Pedido'
};

export function inferPixTransactionTypeFromComponent(componentName: string): PixTransactionType {
    switch (componentName) {
        case 'adiantamentoCliente':
            return 'ADIANTAMENTO';
        case 'pixContasReceber':
            return 'CONTAS_RECEBER';
        default:
            return 'CONTAS_RECEBER';
    }
}

export function getPixTransactionTypeLabel(value: unknown): string {
    if (typeof value !== 'string') {
        return 'Nao informado';
    }

    return PIX_TRANSACTION_TYPE_LABELS[value as PixTransactionType] ?? 'Nao informado';
}
