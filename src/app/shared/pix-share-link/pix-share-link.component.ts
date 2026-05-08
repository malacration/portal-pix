import { Component, Input, signal } from '@angular/core';
import { ButtonModule } from 'primeng/button';
import { TooltipModule } from 'primeng/tooltip';

export interface PixShareLinkData {
    txId?: string | number | null;
    qrCode?: string | null;
    valor?: number | string | null;
    vencimento?: string | null;
    nome?: string | null;
    system?: string | null;
}

@Component({
    selector: 'app-pix-share-link',
    standalone: true,
    imports: [ButtonModule, TooltipModule],
    templateUrl: './pix-share-link.component.html'
})
export class PixShareLinkComponent {
    @Input({ required: true }) data!: PixShareLinkData;
    @Input() copyLabel = 'Copiar link';
    @Input() openLabel = 'Abrir link';
    @Input() size: 'small' | 'large' = 'small';
    @Input() showLabels = true;

    readonly copied = signal(false);
    private copyTimeoutId: ReturnType<typeof setTimeout> | null = null;

    buildUrl(): string {
        const qrCode = this.data?.qrCode?.trim();

        if (!qrCode) {
            return '';
        }

        const payload = {
            txId: this.normalize(this.data.txId),
            qrCode,
            valor: this.normalize(this.data.valor),
            vencimento: this.normalize(this.data.vencimento),
            nome: this.normalize(this.data.nome),
            system: this.normalize(this.data.system)
        };

        const base64 = this.encodePayload(payload);
        return `${window.location.origin}/pix/share?data=${base64}`;
    }

    async copy(): Promise<void> {
        const url = this.buildUrl();

        if (!url) {
            return;
        }

        try {
            await navigator.clipboard.writeText(url);
            this.copied.set(true);

            if (this.copyTimeoutId) {
                clearTimeout(this.copyTimeoutId);
            }

            this.copyTimeoutId = setTimeout(() => this.copied.set(false), 2500);
        } catch { /* ignore */ }
    }

    open(): void {
        const url = this.buildUrl();

        if (!url) {
            return;
        }

        window.open(url, '_blank', 'noopener noreferrer');
    }

    private encodePayload(payload: object): string {
        const json = JSON.stringify(payload);
        const bytes = new TextEncoder().encode(json);
        let binary = '';
        bytes.forEach(b => (binary += String.fromCharCode(b)));
        return btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    private normalize(value: unknown): string | number | null {
        if (value === null || value === undefined) {
            return null;
        }

        if (typeof value === 'string') {
            const trimmed = value.trim();
            return trimmed || null;
        }

        if (typeof value === 'number') {
            return Number.isFinite(value) ? value : null;
        }

        const str = String(value).trim();
        return str || null;
    }
}
