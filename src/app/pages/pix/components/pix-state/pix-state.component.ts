import { CommonModule } from '@angular/common';
import { Component, Type, computed, inject, signal } from '@angular/core';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { PixComponentSelection, PixGeneratedResult } from '../../pix.models';
import { PIX_COMPONENT_REGISTRY } from '../../pix-component-registry';
import { PixComponentSelectorComponent } from '../pix-component-selector/pix-component-selector.component';
import { PixResultComponent } from '../pix-result/pix-result.component';

@Component({
    selector: 'app-pix-state',
    standalone: true,
    imports: [CommonModule, PixComponentSelectorComponent, PixResultComponent],
    templateUrl: './pix-state.component.html'
})
export class PixStateComponent {
    private readonly appConfig = inject(AppConfigService);

    readonly systems = this.appConfig.systems;
    readonly selection = signal<PixComponentSelection>({
        system: this.systems[0] ?? null,
        operation: this.systems[0]?.operacoes[0] ?? null
    });
    readonly generationResult = signal<PixGeneratedResult | null>(null);
    readonly selectedSystem = computed(() => this.selection().system);
    readonly selectedOperation = computed(() => this.selection().operation);
    readonly selectedComponentType = computed<Type<unknown> | null>(() => {
        const operation = this.selectedOperation();

        if (!operation) {
            return null;
        }

        return PIX_COMPONENT_REGISTRY[operation.componente] ?? null;
    });
    readonly selectedComponentInputs = computed(() => {
        const system = this.selectedSystem();
        const operation = this.selectedOperation();

        if (!system || !operation) {
            return {};
        }

        return {
            systemConfig: system,
            operationConfig: operation,
            resultChange: this.handleResultChange
        };
    });

    readonly handleResultChange = (result: PixGeneratedResult | null): void => {
        this.generationResult.set(result);
    };

    onSelectionChange(selection: PixComponentSelection): void {
        this.selection.set(selection);
        this.generationResult.set(null);
    }
}
