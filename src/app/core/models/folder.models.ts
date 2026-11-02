/** Pasta da Base de conhecimento (contrato da API: GET /api/folders/list-all). */
export interface Folder {
  id: string;
  name: string;
  description: string;
  section_id: string | null;
  section_name: string | null;
  created_at: string;
  updated_at: string;
}

/** Metadados de paginação retornados pela API. */
export interface Paging {
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

/** Envelope paginado retornado pelas listagens da API. */
export interface PaginatedResponse<T> {
  data: T[];
  paging: Paging;
}

export interface CreateFolderInput {
  name: string;
  description: string;
  section_id?: string | null;
}

export interface UpdateFolderInput {
  folder_id: string;
  name: string;
  description: string;
}
