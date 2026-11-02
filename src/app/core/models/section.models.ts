/** Setor da plataforma (contrato da API: GET /api/sections/list-all). */
export interface Section {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}

/** Setor enriquecido com contadores de uso (pastas e usuários). */
export interface SectionUsage extends Section {
  folder_count: number;
  user_count: number;
}
