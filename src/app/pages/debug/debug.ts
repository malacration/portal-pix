import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { IconFieldModule } from 'primeng/iconfield';
import { ImageModule } from 'primeng/image';
import { InputIconModule } from 'primeng/inputicon';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { AppConfigService } from '@/app/core/config/app-config.service';
import { getApiErrorMessage } from '../service/api-error-response';
import { Cliente, DebugArtifact, DebugService } from '../service/debug.service';

const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);

const tableDateFormatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
});

@Component({
    selector: 'app-debug',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ButtonModule,
        InputTextModule,
        IconFieldModule,
        ImageModule,
        InputIconModule,
        SelectModule,
        TableModule,
        TabsModule,
        TagModule,
        MessageModule,
        TooltipModule
    ],
    template: `
        <div class="grid grid-cols-12 gap-8">
            <div class="col-span-12">
                <div class="card flex flex-col gap-6">
                    <div class="flex flex-col gap-2 xl:flex-row xl:items-start xl:justify-between">
                        <div class="flex flex-col gap-2">
                            <div class="font-semibold text-xl">Debug</div>
                            <p class="m-0 text-surface-500">Ferramentas de diagnostico para consultar dados no Dealer e inspecionar artefatos gerados pela automacao do navegador.</p>
                        </div>

                        <div class="w-full max-w-xs">
                            <label for="debug-system" class="mb-2 block font-medium">Sistema</label>
                            <p-select
                                inputId="debug-system"
                                class="w-full"
                                [options]="systems"
                                optionLabel="nome"
                                optionValue="nome"
                                [ngModel]="selectedSystemName()"
                                (ngModelChange)="onSystemChange($event ?? '')"
                                placeholder="Selecione um sistema"
                            />
                        </div>
                    </div>

                    @if (selectedSystem(); as system) {
                        <div class="rounded-border border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600 dark:border-surface-700 dark:bg-surface-800/70 dark:text-surface-200">
                            <span class="font-medium">Host selecionado:</span> {{ system.host }}
                        </div>
                    }

                    <p-tabs value="pessoa">
                        <p-tablist>
                            <p-tab value="pessoa"><i class="pi pi-user mr-2"></i>Consultar pessoa</p-tab>
                            <p-tab value="artefatos"><i class="pi pi-folder-open mr-2"></i>Artefatos</p-tab>
                        </p-tablist>

                        <p-tabpanels>
                            <p-tabpanel value="pessoa">
                                <div class="flex flex-col gap-5 pt-2">
                                    <div class="flex flex-col gap-3 md:flex-row md:items-end">
                                        <div class="flex-1">
                                            <label for="debug-pessoa-id" class="mb-2 block font-medium">Codigo da pessoa</label>
                                            <p-iconfield class="w-full">
                                                <p-inputicon styleClass="pi pi-hashtag" />
                                                <input
                                                    pInputText
                                                    id="debug-pessoa-id"
                                                    type="text"
                                                    inputmode="numeric"
                                                    class="w-full"
                                                    placeholder="Ex.: 123625"
                                                    [ngModel]="pessoaId()"
                                                    (ngModelChange)="pessoaId.set($event ?? '')"
                                                    (keyup.enter)="consultarPessoa()"
                                                />
                                            </p-iconfield>
                                        </div>
                                        <div>
                                            <p-button
                                                label="Consultar"
                                                icon="pi pi-search"
                                                [loading]="pessoaLoading()"
                                                [disabled]="!isPessoaIdValid()"
                                                (onClick)="consultarPessoa()"
                                            />
                                        </div>
                                    </div>

                                    @if (pessoaError()) {
                                        <p-message severity="error" [text]="pessoaError()" styleClass="w-full" />
                                    }

                                    @if (pessoa(); as cliente) {
                                        <div class="grid grid-cols-12 gap-4">
                                            <div class="col-span-12 md:col-span-4">
                                                <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                                    <div class="text-sm text-surface-500 mb-2">Codigo</div>
                                                    <div class="font-semibold text-lg">{{ cliente.codigo }}</div>
                                                </div>
                                            </div>
                                            <div class="col-span-12 md:col-span-4">
                                                <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                                    <div class="text-sm text-surface-500 mb-2">Situacao</div>
                                                    <p-tag [value]="cliente.ativo ? 'Ativo' : 'Inativo'" [severity]="cliente.ativo ? 'success' : 'danger'" />
                                                </div>
                                            </div>
                                            <div class="col-span-12 md:col-span-4">
                                                <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                                    <div class="text-sm text-surface-500 mb-2">CPF / CNPJ</div>
                                                    <div class="font-medium break-words">{{ display(cliente.cpfCnpj) }}</div>
                                                </div>
                                            </div>
                                            <div class="col-span-12 md:col-span-6">
                                                <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                                    <div class="text-sm text-surface-500 mb-2">Nome</div>
                                                    <div class="font-medium break-words">{{ display(cliente.nome) }}</div>
                                                </div>
                                            </div>
                                            <div class="col-span-12 md:col-span-6">
                                                <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                                    <div class="text-sm text-surface-500 mb-2">Nome fantasia</div>
                                                    <div class="font-medium break-words">{{ display(cliente.nomeFantasia) }}</div>
                                                </div>
                                            </div>
                                            <div class="col-span-12 md:col-span-6">
                                                <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                                    <div class="text-sm text-surface-500 mb-2">Municipio</div>
                                                    <div class="font-medium break-words">{{ display(cliente.municipio) }}</div>
                                                </div>
                                            </div>
                                            <div class="col-span-12 md:col-span-6">
                                                <div class="rounded-border border border-surface-200 bg-surface-0 p-4 h-full dark:border-surface-700 dark:bg-surface-900">
                                                    <div class="text-sm text-surface-500 mb-2">UF</div>
                                                    <div class="font-medium break-words">{{ display(cliente.uf) }}</div>
                                                </div>
                                            </div>
                                        </div>
                                    } @else if (!pessoaLoading() && !pessoaError()) {
                                        <div class="rounded-border border border-dashed border-surface-300 px-6 py-10 text-center text-surface-500">
                                            Informe o codigo de uma pessoa para consultar os dados no Dealer.
                                        </div>
                                    }
                                </div>
                            </p-tabpanel>

                            <p-tabpanel value="artefatos">
                                <div class="flex flex-col gap-5 pt-2">
                                    <div class="flex flex-wrap items-center justify-between gap-3">
                                        <span class="text-sm text-surface-500">
                                            @if (artifactsDirectory()) {
                                                Diretorio: <span class="font-mono">{{ artifactsDirectory() }}</span>
                                            } @else {
                                                Arquivos de diagnostico gerados pela automacao do navegador.
                                            }
                                        </span>
                                        <p-button label="Atualizar" icon="pi pi-refresh" severity="secondary" [outlined]="true" [loading]="artifactsLoading()" (onClick)="loadArtifacts()" />
                                    </div>

                                    @if (artifactsError()) {
                                        <p-message severity="error" [text]="artifactsError()" styleClass="w-full" />
                                    }

                                    <p-table
                                        [value]="artifacts()"
                                        [loading]="artifactsLoading()"
                                        [paginator]="artifacts().length > 10"
                                        [rows]="10"
                                        [rowsPerPageOptions]="[10, 20, 50]"
                                        [rowHover]="true"
                                        [stripedRows]="true"
                                        styleClass="p-datatable-sm"
                                        [tableStyle]="{ 'min-width': '48rem' }"
                                    >
                                        <ng-template #header>
                                            <tr>
                                                <th style="width: 5rem">Preview</th>
                                                <th>Arquivo</th>
                                                <th style="width: 6rem">Tipo</th>
                                                <th style="width: 8rem">Tamanho</th>
                                                <th style="width: 12rem">Modificado em</th>
                                                <th style="width: 1%">Acoes</th>
                                            </tr>
                                        </ng-template>

                                        <ng-template #body let-artifact>
                                            <tr>
                                                <td>
                                                    @if (imagePreviewUrls()[artifact.name]; as previewUrl) {
                                                        <p-image [src]="previewUrl" [alt]="artifact.name" width="48" [preview]="true" />
                                                    } @else if (isImageArtifact(artifact)) {
                                                        <i class="pi pi-spin pi-spinner text-2xl text-surface-400"></i>
                                                    } @else {
                                                        <i class="pi pi-file text-2xl text-surface-400"></i>
                                                    }
                                                </td>
                                                <td class="font-mono text-sm break-all">{{ artifact.name }}</td>
                                                <td><p-tag [value]="artifact.extension || '-'" severity="secondary" /></td>
                                                <td>{{ artifact.sizeLabel }}</td>
                                                <td>{{ formatDate(artifact.lastModified) }}</td>
                                                <td>
                                                    <div class="flex items-center gap-1 whitespace-nowrap">
                                                        <p-button
                                                            icon="pi pi-external-link"
                                                            size="small"
                                                            severity="secondary"
                                                            [outlined]="true"
                                                            pTooltip="Abrir em nova aba"
                                                            tooltipPosition="top"
                                                            (onClick)="openArtifact(artifact)"
                                                        />
                                                        <p-button
                                                            icon="pi pi-download"
                                                            size="small"
                                                            severity="secondary"
                                                            [outlined]="true"
                                                            pTooltip="Baixar arquivo"
                                                            tooltipPosition="top"
                                                            (onClick)="downloadArtifact(artifact)"
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        </ng-template>

                                        <ng-template #emptymessage>
                                            <tr>
                                                <td colspan="6" class="text-center py-8 text-surface-500">
                                                    Nenhum artefato disponivel.
                                                </td>
                                            </tr>
                                        </ng-template>
                                    </p-table>
                                </div>
                            </p-tabpanel>
                        </p-tabpanels>
                    </p-tabs>
                </div>
            </div>
        </div>
    `
})
export class Debug implements OnInit, OnDestroy {
    private readonly appConfig = inject(AppConfigService);
    private readonly debugService = inject(DebugService);

    readonly systems = this.appConfig.systems;
    readonly selectedSystemName = signal(this.systems[0]?.nome ?? '');
    readonly selectedSystem = computed(() => this.systems.find((system) => system.nome === this.selectedSystemName()) ?? null);

    readonly pessoaId = signal('');
    readonly pessoaLoading = signal(false);
    readonly pessoaError = signal('');
    readonly pessoa = signal<Cliente | null>(null);

    readonly artifacts = signal<DebugArtifact[]>([]);
    readonly artifactsDirectory = signal('');
    readonly artifactsLoading = signal(false);
    readonly artifactsError = signal('');
    readonly imagePreviewUrls = signal<Record<string, string>>({});

    readonly isPessoaIdValid = computed(() => {
        const parsed = Number(this.pessoaId().trim());
        return Number.isInteger(parsed) && parsed > 0;
    });

    ngOnInit(): void {
        this.loadArtifacts();
    }

    ngOnDestroy(): void {
        this.revokeImagePreviewUrls();
    }

    onSystemChange(systemName: string): void {
        this.selectedSystemName.set(systemName);
        this.pessoa.set(null);
        this.pessoaError.set('');
        this.loadArtifacts();
    }

    consultarPessoa(): void {
        if (!this.isPessoaIdValid()) {
            return;
        }

        const id = Number(this.pessoaId().trim());
        const host = this.selectedSystem()?.host;

        this.pessoaLoading.set(true);
        this.pessoaError.set('');
        this.pessoa.set(null);

        this.debugService.consultarPessoa(id, host).subscribe({
            next: (cliente) => {
                this.pessoa.set(cliente);
                this.pessoaLoading.set(false);
            },
            error: (error: HttpErrorResponse) => {
                this.pessoaLoading.set(false);
                this.pessoaError.set(getApiErrorMessage(error, 'Nao foi possivel consultar a pessoa informada.'));
            }
        });
    }

    loadArtifacts(): void {
        const host = this.selectedSystem()?.host;

        this.artifactsLoading.set(true);
        this.artifactsError.set('');

        this.debugService.getArtifacts(host).subscribe({
            next: (response) => {
                this.revokeImagePreviewUrls();
                this.artifacts.set(response.files ?? []);
                this.artifactsDirectory.set(response.directory ?? '');
                this.artifactsLoading.set(false);
                this.loadImagePreviews(response.files ?? [], host);
            },
            error: (error: HttpErrorResponse) => {
                this.revokeImagePreviewUrls();
                this.artifacts.set([]);
                this.artifactsDirectory.set('');
                this.artifactsLoading.set(false);
                this.artifactsError.set(getApiErrorMessage(error, 'Nao foi possivel carregar os artefatos.'));
            }
        });
    }

    isImageArtifact(artifact: DebugArtifact): boolean {
        return IMAGE_EXTENSIONS.has(artifact.extension?.toLowerCase() ?? '');
    }

    openArtifact(artifact: DebugArtifact): void {
        const host = this.selectedSystem()?.host;

        this.debugService.getArtifactBlob(artifact.name, host).subscribe({
            next: (blob) => {
                const blobUrl = URL.createObjectURL(blob);
                window.open(blobUrl, '_blank', 'noopener');
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
            },
            error: (error: HttpErrorResponse) => {
                this.artifactsError.set(getApiErrorMessage(error, 'Nao foi possivel abrir o artefato.'));
            }
        });
    }

    downloadArtifact(artifact: DebugArtifact): void {
        const host = this.selectedSystem()?.host;

        this.debugService.getArtifactBlob(artifact.name, host).subscribe({
            next: (blob) => {
                const blobUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = blobUrl;
                link.download = artifact.name;
                link.click();
                setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
            },
            error: (error: HttpErrorResponse) => {
                this.artifactsError.set(getApiErrorMessage(error, 'Nao foi possivel baixar o artefato.'));
            }
        });
    }

    private loadImagePreviews(artifacts: DebugArtifact[], host: string | undefined): void {
        artifacts
            .filter((artifact) => this.isImageArtifact(artifact))
            .forEach((artifact) => {
                this.debugService.getArtifactBlob(artifact.name, host).subscribe({
                    next: (blob) => {
                        const blobUrl = URL.createObjectURL(blob);
                        this.imagePreviewUrls.update((current) => ({ ...current, [artifact.name]: blobUrl }));
                    },
                    error: () => {
                        // Preview e apenas cosmetico: ignora falhas silenciosamente, o botao "Abrir em nova aba" continua disponivel.
                    }
                });
            });
    }

    private revokeImagePreviewUrls(): void {
        Object.values(this.imagePreviewUrls()).forEach((url) => URL.revokeObjectURL(url));
        this.imagePreviewUrls.set({});
    }

    display(value: string | null | undefined): string {
        const normalized = typeof value === 'string' ? value.trim() : '';
        return normalized || '-';
    }

    formatDate(value: string | null | undefined): string {
        if (!value) {
            return '-';
        }

        const normalized = value.includes('T') ? value : value.replace(' ', 'T');
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? value : tableDateFormatter.format(parsed);
    }
}
