/** Nota da Base de conhecimento (contrato da API: GET /api/notes/list-all). */
export interface NoteListItem {
  id: string;
  folder_id: string;
  name: string;
  description: string;
  created_at: string;
}

/** Referência de contextualização, pertencente a uma versão da nota. */
export interface NoteReferenceItem {
  id: string;
  note_version_id: string;
  name: string;
  description: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/** Versão de uma nota: descrição, conteúdo e referências daquele ponto do histórico. */
export interface NoteVersionItem {
  id: string;
  note_id: string;
  name: string;
  description: string;
  content: string;
  created_by: string;
  created_by_name: string;
  created_at: string;
  references: NoteReferenceItem[];
}

/** Resposta de GET /api/notes/get-info: a nota e suas versões paginadas. */
export interface NoteInfoResponse {
  note: NoteListItem;
  versions: NoteVersionItem[];
  paging: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
  };
}

/** Corpo de POST /api/notes/create. */
export interface CreateNoteInput {
  folder_id: string;
  name: string;
  description: string;
}

/** Corpo de POST /api/notes/create-version. */
export interface CreateNoteVersionInput {
  note_id: string;
  name: string;
  description: string;
  content: string;
}

/** Corpo de POST /api/references/create. */
export interface CreateReferenceInput {
  note_version_id: string;
  name: string;
  description: string;
  content: string;
}

/** Corpo de POST /api/references/update. */
export interface UpdateReferenceInput {
  reference_id: string;
  name: string;
  description: string;
  content: string;
}
