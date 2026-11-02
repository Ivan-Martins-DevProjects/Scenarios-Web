import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { PaginatedResponse, Paging } from '../models/folder.models';
import { Section, SectionUsage } from '../models/section.models';

export interface CreateSectionInput {
  name: string;
  description: string;
}

export interface UpdateSectionInput {
  section_id: string;
  name: string;
  description: string;
}

/** Administração de setores: listagem com contadores de uso e CRUD. */
@Injectable({ providedIn: 'root' })
export class SectionService {
  private readonly http = inject(HttpClient);

  private static readonly PageSize = 10;

  private readonly _sections = signal<SectionUsage[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal('');
  private readonly _paging = signal<Paging | null>(null);
  private readonly _currentPage = signal(1);

  readonly sections = this._sections.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  readonly paging = this._paging.asReadonly();
  readonly currentPage = this._currentPage.asReadonly();

  /** Carrega uma página de setores (10 itens por página), com contadores de uso. */
  loadSections(page?: number): void {
    const targetPage = page ?? this._currentPage();

    this._currentPage.set(targetPage);
    this._loading.set(true);
    this._error.set('');

    this.http
      .get<PaginatedResponse<SectionUsage>>(`${environment.apiUrl}/sections/list-all`, {
        params: { page: targetPage, page_size: SectionService.PageSize },
      })
      .subscribe({
        next: (response) => {
          this._sections.set(response.data ?? []);
          this._paging.set(response.paging ?? null);
          this._loading.set(false);
        },
        error: () => {
          this._error.set(
            'Não foi possível carregar os setores. Verifique se o servidor está ativo e tente novamente.',
          );
          this._loading.set(false);
        },
      });
  }

  /** Cria um novo setor via POST /api/sections/create. */
  createSection(input: CreateSectionInput) {
    return this.http.post<Section>(`${environment.apiUrl}/sections/create`, input);
  }

  /** Atualiza um setor via POST /api/sections/update. */
  updateSection(input: UpdateSectionInput) {
    return this.http.post<Section>(`${environment.apiUrl}/sections/update`, input);
  }

  /** Exclui um setor via POST /api/sections/delete. */
  deleteSection(sectionId: string) {
    return this.http.post(`${environment.apiUrl}/sections/delete`, {
      section_id: sectionId,
    });
  }
}
