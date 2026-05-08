import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { Component, Input } from '@angular/core';
import { QRCodeComponent } from 'angularx-qrcode';
import { getPixTransactionTypeLabel } from '@/app/core/models/pix-transaction-type';
import { PixShareLinkComponent, PixShareLinkData } from '@/app/shared/pix-share-link/pix-share-link.component';
import { PixGeneratedResult } from '../../pix.models';

@Component({
    selector: 'app-pix-result',
    standalone: true,
    imports: [CommonModule, CurrencyPipe, DatePipe, QRCodeComponent, PixShareLinkComponent],
    templateUrl: './pix-result.component.html'
})
export class PixResultComponent {
    @Input() result: PixGeneratedResult | null = null;

    getQrCodeImageSource(): string | null {
        const qrCodeBase64 = this.result?.payment.qrCodeBase64?.trim();

        if (!qrCodeBase64) {
            return null;
        }

        return qrCodeBase64.startsWith('data:') ? qrCodeBase64 : `data:image/png;base64,${qrCodeBase64}`;
    }

    buildShareData(result: PixGeneratedResult): PixShareLinkData {
        const doc = result.payment.documento;
        return {
            txId: doc?.txId ?? result.payment.txId,
            qrCode: doc?.qrCode ?? result.payment.qrCode,
            valor: doc?.valor ?? result.payment.valor,
            vencimento: doc?.pixExpiraEm ?? result.payment.expiracaoEm,
            nome: doc?.nomeTitularContaRecebimento ?? result.payment.nomeRecebedor,
            system: result.system?.nome
        };
    }

    getTransactionTypeLabel(result: PixGeneratedResult): string {
        return getPixTransactionTypeLabel(result.payment.tipoTransacao ?? result.operation.tipoTransacao);
    }
}
