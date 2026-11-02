import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-modal',
  template: `
    @if (open()) {
      <div class="modal-backdrop" (click)="closed.emit()">
        <div
          class="modal-card"
          [class.modal-card--sm]="size() === 'sm'"
          [class.modal-card--lg]="size() === 'lg'"
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="title()"
          (click)="$event.stopPropagation()"
        >
          <header class="modal-header">
            <div class="modal-title">
              <h2>{{ title() }}</h2>
              @if (subtitle()) {
                <p>{{ subtitle() }}</p>
              }
            </div>
            <button type="button" class="modal-close" aria-label="Fechar" (click)="closed.emit()">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M5.3 4.24a.9.9 0 00-1.27 1.27L8.74 10.2 4.02 14.9a.9.9 0 101.28 1.27l4.7-4.72 4.72 4.72a.9.9 0 101.27-1.27l-4.71-4.7 4.71-4.72a.9.9 0 10-1.27-1.27L10 8.92 5.3 4.24z" />
              </svg>
            </button>
          </header>
          <div class="modal-body">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './modal.scss',
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
})
export class Modal {
  readonly open = input.required<boolean>();
  readonly title = input('');
  readonly subtitle = input('');
  readonly size = input<'sm' | 'md' | 'lg'>('md');
  readonly closed = output<void>();

  protected onEscape(): void {
    if (this.open()) {
      this.closed.emit();
    }
  }
}
