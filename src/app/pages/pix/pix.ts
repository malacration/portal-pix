import { Component } from '@angular/core';
import { PixStateComponent } from './components/pix-state/pix-state.component';

@Component({
    selector: 'app-pix',
    standalone: true,
    imports: [PixStateComponent],
    templateUrl: './pix.html'
})
export class Pix {}
