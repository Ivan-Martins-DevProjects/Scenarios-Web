import { Component, computed, input, output } from '@angular/core';

import { buildPager, PagerItem } from '../../core/utils/pager';

/**
 * Paginador reutilizável: renderiza apenas quando há mais de uma página.
 * Os botões ficam desabilitados durante o carregamento de uma página.
 */
@Component({
  selector: 'app-pager',
  template: `
    @if (totalPages() > 1) {
      <nav class="pager" aria-label="Paginação">
        <button
          class="pager-btn pager-btn--nav"
          type="button"
          (click)="go(current() - 1)"
          [disabled]="current() <= 1 || loading()"
          aria-label="Página anterior"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M12.7 4.3a.9.9 0 010 1.27l-4.4 4.4 4.4 4.4a.9.9 0 11-1.27 1.27l-5.03-5.03a.9.9 0 010-1.27l5.03-5.03a.9.9 0 011.27 0z"
              clip-rule="evenodd"
            />
          </svg>
        </button>

        @for (item of items(); track $index) {
          @if (item === 'gap') {
            <span class="pager-gap">…</span>
          } @else {
            <button
              class="pager-btn"
              type="button"
              [class.pager-btn--active]="item === current()"
              [disabled]="loading()"
              (click)="go(item)"
              [attr.aria-current]="item === current() ? 'page' : null"
            >
              {{ item }}
            </button>
          }
        }

        <button
          class="pager-btn pager-btn--nav"
          type="button"
          (click)="go(current() + 1)"
          [disabled]="current() >= totalPages() || loading()"
          aria-label="Próxima página"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path
              fill-rule="evenodd"
              d="M7.3 4.3a.9.9 0 000 1.27l4.4 4.4-4.4 4.4a.9.9 0 101.27 1.27l5.03-5.03a.9.9 0 000-1.27L8.57 4.3a.9.9 0 00-1.27 0z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
      </nav>
    }
  `,
  styles: `
    .pager {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-top: 18px;
    }

    .pager-btn {
      display: grid;
      place-items: center;
      min-width: 36px;
      height: 36px;
      padding: 0 8px;
      font: inherit;
      font-size: 0.8438rem;
      font-weight: 600;
      color: var(--text-muted);
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      cursor: pointer;
      transition: color 0.2s ease, border-color 0.2s ease, background 0.2s ease;

      svg {
        width: 15px;
        height: 15px;
      }

      &:hover:not(:disabled) {
        color: var(--text);
        border-color: var(--border-strong);
        background: rgba(148, 163, 184, 0.08);
      }

      &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      &--active {
        color: #fff;
        background: rgba(99, 102, 241, 0.22);
        border-color: rgba(99, 102, 241, 0.55);
        box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.12);

        &:hover:not(:disabled) {
          color: #fff;
          background: rgba(99, 102, 241, 0.22);
          border-color: rgba(99, 102, 241, 0.55);
        }
      }
    }

    .pager-gap {
      display: grid;
      place-items: center;
      min-width: 24px;
      height: 36px;
      color: var(--text-muted);
      font-size: 0.8125rem;
      user-select: none;
    }
  `,
})
export class Pager {
  readonly totalPages = input.required<number>();
  readonly current = input.required<number>();
  readonly loading = input(false);

  readonly pageChange = output<number>();

  protected readonly items = computed<PagerItem[]>(() =>
    buildPager(this.totalPages(), this.current()),
  );

  protected go(page: number): void {
    if (this.loading() || page < 1 || page > this.totalPages() || page === this.current()) {
      return;
    }
    this.pageChange.emit(page);
  }
}
