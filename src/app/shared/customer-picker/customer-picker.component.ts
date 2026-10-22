import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, EventEmitter, Injector, Input, OnChanges, Output, QueryList, SimpleChanges, ViewChildren, afterNextRender, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TableModule } from 'primeng/table';
import { CustomerOption, CustomerSearchService } from '@/app/pages/service/customer-search.service';
import { getApiErrorMessage } from '@/app/pages/service/api-error-response';

@Component({
    selector: 'app-customer-picker',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, TableModule],
    templateUrl: './customer-picker.component.html'
})
export class CustomerPickerComponent implements OnChanges {
    private readonly service = inject(CustomerSearchService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly injector = inject(Injector);
    @ViewChildren('customerSelect', { read: ElementRef }) resultButtons?: QueryList<ElementRef<HTMLButtonElement>>;
    private request?: Subscription;
    private appliedSearch = '';
    @Input() host = '';
    @Input() empresaId = '';
    @Input() disabled = false;
    @Input() selected: CustomerOption | null = null;
    @Input() resetKey = 0;
    @Output() selectionChange = new EventEmitter<CustomerOption | null>();
    readonly customers = signal<CustomerOption[]>([]);
    readonly total = signal(0);
    readonly loading = signal(false);
    readonly error = signal('');
    visible = false;
    query = '';
    first = 0;
    activeIndex = 0;

    ngOnChanges(changes: SimpleChanges): void {
        if (['host', 'empresaId', 'resetKey'].some(key => changes[key])) {
            this.request?.unsubscribe();
            this.visible = false;
            this.customers.set([]);
            this.total.set(0);
            this.loading.set(false);
            this.error.set('');
            if (changes['resetKey']) this.query = '';
            else if (changes['host']) this.query = this.selected?.nome ?? '';
        }
        const selection = changes['selected'];
        if (selection?.currentValue) this.query = (selection.currentValue as CustomerOption).nome;
        else if (selection?.previousValue && this.query === (selection.previousValue as CustomerOption).nome) this.query = '';
    }

    changeQuery(query: string): void {
        if (this.selected) return;
        this.query = query;
    }

    canSearch(): boolean {
        return !this.disabled && !this.selected && !!this.host;
    }

    fieldEnter(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        if ((event instanceof KeyboardEvent && event.repeat) || this.selected || this.disabled) return;
        if (this.visible) this.confirmEnter(event);
        else this.open();
    }

    confirmEnter(event: Event): void {
        event.preventDefault();
        event.stopPropagation();
        if ((event instanceof KeyboardEvent && event.repeat) || this.loading() || this.disabled) return;
        if (this.query !== this.appliedSearch || !this.customers().length) { this.search(); return; }
        const customer = this.customers()[this.activeIndex];
        if (customer) this.select(customer);
    }

    focusCustomer(customer: CustomerOption): void {
        this.activeIndex = this.customers().findIndex(item => item.id === customer.id);
    }

    navigate(event: KeyboardEvent): void {
        if (!['ArrowDown', 'ArrowUp'].includes(event.key) || this.loading() || !this.customers().length) return;
        event.preventDefault();
        event.stopPropagation();
        this.activeIndex = Math.max(0, Math.min(this.customers().length - 1, this.activeIndex + (event.key === 'ArrowDown' ? 1 : -1)));
        this.first = Math.floor(this.activeIndex / 20) * 20;
        this.focusResult();
    }

    private focusResult(): void {
        afterNextRender(() => this.resultButtons?.get(this.activeIndex - this.first)?.nativeElement.focus(), { injector: this.injector });
    }

    open(): void {
        if (!this.canSearch()) return;
        this.visible = true;
        this.search();
    }

    close(): void {
        this.visible = false;
        this.request?.unsubscribe();
        this.loading.set(false);
    }

    search(): void {
        this.first = 0;
        this.appliedSearch = this.query;
        this.load();
    }

    paginate(event: { first?: number }): void {
        this.first = event.first ?? 0;
        this.activeIndex = this.first;
    }

    private load(): void {
        if (!this.canSearch()) return;
        this.request?.unsubscribe();
        this.loading.set(true);
        this.error.set('');
        this.customers.set([]);
        this.total.set(0);
        const request = this.empresaId
            ? this.service.search(this.host, this.appliedSearch, this.empresaId)
            : this.service.search(this.host, this.appliedSearch);
        this.request = request
            .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
                next: page => {
                    this.customers.set(page.itens); this.total.set(page.total); this.loading.set(false);
                    this.activeIndex = 0;
                    if (page.itens.length) this.focusResult();
                },
                error: (error: HttpErrorResponse) => { this.loading.set(false); this.error.set(getApiErrorMessage(error, 'Não foi possível buscar os clientes.')); }
            });
    }

    select(customer: CustomerOption | null): void {
        this.selected = customer;
        this.query = customer?.nome ?? '';
        this.close();
        this.selectionChange.emit(customer);
    }
}
