import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, computed, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { AppSystemConfig, AppSystemOperationConfig } from '@/app/core/config/app-config.service';
import { PixComponentSelection } from '../../pix.models';

@Component({
    selector: 'app-pix-component-selector',
    standalone: true,
    imports: [CommonModule, FormsModule, SelectModule],
    templateUrl: './pix-component-selector.component.html'
})
export class PixComponentSelectorComponent implements OnChanges {
    @Input({ required: true }) systems: AppSystemConfig[] = [];

    readonly selectionChange = output<PixComponentSelection>();
    readonly selectedSystemName = signal('');
    readonly selectedOperationComponent = signal('');
    readonly selectedSystem = computed(() => this.getSystemByName(this.selectedSystemName()));
    readonly availableOperations = computed(() => this.selectedSystem()?.operacoes ?? []);
    readonly selectedOperation = computed(
        () => this.availableOperations().find((operation) => operation.componente === this.selectedOperationComponent()) ?? null
    );

    ngOnChanges(): void {
        this.syncSelection();
    }

    onSystemChange(systemName: string): void {
        this.selectedSystemName.set(systemName);
        this.selectedOperationComponent.set(this.getSystemByName(systemName)?.operacoes[0]?.componente ?? '');
        this.emitSelection();
    }

    onOperationChange(componentName: string): void {
        this.selectedOperationComponent.set(componentName);
        this.emitSelection();
    }

    private syncSelection(): void {
        if (!this.systems.length) {
            this.selectedSystemName.set('');
            this.selectedOperationComponent.set('');
            this.emitSelection();
            return;
        }

        const selectedSystem = this.getSystemByName(this.selectedSystemName()) ?? this.systems[0];
        const selectedOperation =
            selectedSystem.operacoes.find((operation) => operation.componente === this.selectedOperationComponent()) ?? selectedSystem.operacoes[0] ?? null;

        this.selectedSystemName.set(selectedSystem.nome);
        this.selectedOperationComponent.set(selectedOperation?.componente ?? '');
        this.emitSelection();
    }

    private emitSelection(): void {
        this.selectionChange.emit({
            system: this.selectedSystem(),
            operation: this.selectedOperation()
        });
    }

    private getSystemByName(systemName: string): AppSystemConfig | null {
        return this.systems.find((system) => system.nome === systemName) ?? null;
    }
}
