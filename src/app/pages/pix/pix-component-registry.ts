import { Type } from '@angular/core';
import { PixAdiantamentoClienteComponent } from './components/pix-adiantamento-cliente/pix-adiantamento-cliente.component';
import { PixContasReceberComponent } from './components/pix-contas-receber/pix-contas-receber.component';

export const PIX_COMPONENT_REGISTRY: Record<string, Type<unknown>> = {
    pixContasReceber: PixContasReceberComponent,
    adiantamentoCliente: PixAdiantamentoClienteComponent
};
