import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  CreateFolderInput,
  UpdateFolderInput,
  Folder,
  PaginatedResponse,
  Paging,
} from '../models/folder.models';
import { Role } from '../models/role.models';
import { Section } from '../models/section.models';
import { SearchHit } from '../models/search.models';
import {
  CreateNoteInput,
  CreateNoteVersionInput,
  CreateReferenceInput,
  NoteInfoResponse,
  NoteListItem,
  NoteReferenceItem,
  NoteVersionItem,
  UpdateReferenceInput,
} from '../models/note-api.models';

/**
 * Base de conhecimento, alimentada pela API:
 * listagens, detalhes e criação de pastas, notas e versões.
 */
@Injectable({ providedIn: 'root' })
export class KnowledgeBaseService {
  private readonly http = inject(HttpClient);

  /* ---------------- Pastas ---------------- */

  private static readonly FoldersPageSize = 10;

  private readonly _folders = signal<Folder[]>([]);
  private readonly _foldersLoading = signal(false);
  private readonly _foldersError = signal('');
  private readonly _foldersPaging = signal<Paging | null>(null);
  private readonly _currentFolderPage = signal(1);

  readonly folders = this._folders.asReadonly();
  readonly foldersLoading = this._foldersLoading.asReadonly();
  readonly foldersError = this._foldersError.asReadonly();
  readonly foldersPaging = this._foldersPaging.asReadonly();
  readonly currentFolderPage = this._currentFolderPage.asReadonly();

  /** Carrega uma página de pastas (10 itens por página), com filtro por setor
   *  e ordenação opcionais. Sem página, recarrega a atual. */
  loadFolders(page?: number, sectionId?: string, order?: string): void {
    const targetPage = page ?? this._currentFolderPage();

    this._currentFolderPage.set(targetPage);
    this._foldersLoading.set(true);
    this._foldersError.set('');

    this.http
      .get<PaginatedResponse<Folder>>(`${environment.apiUrl}/folders/list-all`, {
        params: {
          page: targetPage,
          page_size: KnowledgeBaseService.FoldersPageSize,
          ...(sectionId ? { section_id: sectionId } : {}),
          ...(order ? { order } : {}),
        },
      })
      .subscribe({
        next: (response) => {
          this._folders.set(response.data ?? []);
          this._foldersPaging.set(response.paging ?? null);
          this._foldersLoading.set(false);
        },
        error: () => {
          this._foldersError.set(
            'Não foi possível carregar as pastas. Verifique se o servidor está ativo e tente novamente.',
          );
          this._foldersLoading.set(false);
        },
      });
  }

  folderById(id: string): Folder | undefined {
    return this.folders().find((folder) => folder.id === id);
  }

  /* ---------------- Pasta atual (API) ---------------- */

  private readonly _currentFolder = signal<Folder | null>(null);
  private readonly _currentFolderLoading = signal(false);
  private readonly _currentFolderError = signal('');

  readonly currentFolder = this._currentFolder.asReadonly();
  readonly currentFolderLoading = this._currentFolderLoading.asReadonly();
  readonly currentFolderError = this._currentFolderError.asReadonly();

  /** Carrega uma pasta pelo id via GET /api/folders/get-info. */
  loadFolderInfo(folderId: string): void {
    this._currentFolderLoading.set(true);
    this._currentFolderError.set('');

    this.http
      .get<Folder>(`${environment.apiUrl}/folders/get-info`, {
        params: { folder_id: folderId },
      })
      .subscribe({
        next: (folder) => {
          this._currentFolder.set(folder);
          this._currentFolderLoading.set(false);
        },
        error: () => {
          this._currentFolderError.set(
            'Não foi possível carregar esta pasta. Verifique se ela ainda existe.',
          );
          this._currentFolderLoading.set(false);
        },
      });
  }

  /** Cria uma pasta via POST /api/folders/create, opcionalmente restrita a uma role. */
  createFolder(input: CreateFolderInput) {
    return this.http.post<Folder>(`${environment.apiUrl}/folders/create`, input);
  }

  /** Atualiza nome e descrição de uma pasta via POST /api/folders/update. */
  updateFolder(input: UpdateFolderInput) {
    return this.http.post<Folder>(`${environment.apiUrl}/folders/update`, input);
  }

  /* ---------------- Roles e Setores ---------------- */

  private readonly _roles = signal<Role[]>([]);
  private readonly _sections = signal<Section[]>([]);

  readonly roles = this._roles.asReadonly();
  readonly sections = this._sections.asReadonly();

  /** Carrega as roles disponíveis. */
  loadRoles(): void {
    this.http
      .get<PaginatedResponse<Role>>(`${environment.apiUrl}/roles/list-all`, {
        params: { page: 1, page_size: 100 },
      })
      .subscribe({
        next: (response) => this._roles.set(response.data ?? []),
        error: () => this._roles.set([]),
      });
  }

  /** Carrega os setores disponíveis (para o seletor de organização da pasta). */
  loadSections(): void {
    this.http
      .get<PaginatedResponse<Section>>(`${environment.apiUrl}/sections/list-all`, {
        params: { page: 1, page_size: 100 },
      })
      .subscribe({
        next: (response) => this._sections.set(response.data ?? []),
        error: () => this._sections.set([]),
      });
  }

  /* ---------------- Notas por pasta ---------------- */

  private static readonly NotesPageSize = 10;

  private readonly _folderNotes = signal<NoteListItem[]>([]);
  private readonly _folderNotesLoading = signal(false);
  private readonly _folderNotesError = signal('');
  private readonly _folderNotesPaging = signal<Paging | null>(null);
  private readonly _currentNotesPage = signal(1);

  readonly folderNotes = this._folderNotes.asReadonly();
  readonly folderNotesLoading = this._folderNotesLoading.asReadonly();
  readonly folderNotesError = this._folderNotesError.asReadonly();
  readonly folderNotesPaging = this._folderNotesPaging.asReadonly();
  readonly currentNotesPage = this._currentNotesPage.asReadonly();

  /** Carrega uma página de notas de uma pasta (10 itens por página). */
  loadNotesFromFolder(folderId: string, page?: number): void {
    const targetPage = page ?? this._currentNotesPage();

    this._currentNotesPage.set(targetPage);
    this._folderNotesLoading.set(true);
    this._folderNotesError.set('');

    this.http
      .get<PaginatedResponse<NoteListItem>>(`${environment.apiUrl}/notes/list-all`, {
        params: {
          folder_id: folderId,
          page: targetPage,
          page_size: KnowledgeBaseService.NotesPageSize,
        },
      })
      .subscribe({
        next: (response) => {
          this._folderNotes.set(response.data ?? []);
          this._folderNotesPaging.set(response.paging ?? null);
          this._folderNotesLoading.set(false);
        },
        error: () => {
          this._folderNotesError.set(
            'Não foi possível carregar as notas desta pasta. Verifique se o servidor está ativo e tente novamente.',
          );
          this._folderNotesLoading.set(false);
        },
      });
  }

  /** Cria uma nota via POST /api/notes/create. */
  createNote(input: CreateNoteInput) {
    return this.http.post<NoteListItem>(`${environment.apiUrl}/notes/create`, input);
  }

  /** Cria uma versão de nota via POST /api/notes/create-version. */
  createNoteVersion(input: CreateNoteVersionInput) {
    return this.http.post<NoteVersionItem>(`${environment.apiUrl}/notes/create-version`, input);
  }

  /** Exclui uma versão específica (e suas referências) via POST /api/notes/delete-version. */
  deleteNoteVersion(versionId: string) {
    return this.http.post(`${environment.apiUrl}/notes/delete-version`, {
      version_id: versionId,
    });
  }

  /** Exclui uma nota (com versões e referências) via POST /api/notes/delete. */
  deleteNote(noteId: string) {
    return this.http.post(`${environment.apiUrl}/notes/delete`, { note_id: noteId });
  }

  /** Exclui uma pasta (com todo o conteúdo) via POST /api/folders/delete. */
  deleteFolder(folderId: string) {
    return this.http.post(`${environment.apiUrl}/folders/delete`, { folder_id: folderId });
  }

  /** Cria uma referência vinculada a uma versão via POST /api/references/create. */
  createReference(input: CreateReferenceInput) {
    return this.http.post<NoteReferenceItem>(
      `${environment.apiUrl}/references/create`,
      input,
    );
  }

  /** Atualiza uma referência via POST /api/references/update. */
  updateReference(input: UpdateReferenceInput) {
    return this.http.post<NoteReferenceItem>(`${environment.apiUrl}/references/update`, input);
  }

  /** Exclui uma referência via POST /api/references/delete. */
  deleteReference(referenceId: string) {
    return this.http.post(`${environment.apiUrl}/references/delete`, {
      reference_id: referenceId,
    });
  }

  /* ---------------- Detalhe da nota ---------------- */

  private readonly _noteInfo = signal<NoteInfoResponse | null>(null);
  private readonly _noteInfoLoading = signal(false);
  private readonly _noteInfoError = signal('');

  readonly noteInfo = this._noteInfo.asReadonly();
  readonly noteInfoLoading = this._noteInfoLoading.asReadonly();
  readonly noteInfoError = this._noteInfoError.asReadonly();

  /**
   * Carrega as informações de uma nota e suas versões.
   * A paginação enviada é apenas para as versões.
   */
  loadNoteInfo(noteId: string): void {
    this._noteInfoLoading.set(true);
    this._noteInfoError.set('');

    this.http
      .get<NoteInfoResponse>(`${environment.apiUrl}/notes/get-info`, {
        params: { note_id: noteId, page: 1, page_size: 100 },
      })
      .subscribe({
        next: (response) => {
          this._noteInfo.set(response);
          this._noteInfoLoading.set(false);
        },
        error: () => {
          this._noteInfoError.set(
            'Não foi possível carregar esta nota. Verifique se o servidor está ativo e tente novamente.',
          );
          this._noteInfoLoading.set(false);
        },
      });
  }

  /** Renomeia uma versão via POST /api/notes/update-version. */
  updateNoteVersionName(versionId: string, name: string) {
    return this.http.post<NoteVersionItem>(`${environment.apiUrl}/notes/update-version`, {
      version_id: versionId,
      name,
    });
  }

  /** Busca global por expressão regular via GET /api/search. */
  search(query: string, page = 1, pageSize = 10) {
    return this.http.get<PaginatedResponse<SearchHit>>(`${environment.apiUrl}/search`, {
      params: { query, page, page_size: pageSize },
    });
  }
}
