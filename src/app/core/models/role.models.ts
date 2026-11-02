/** Role disponível na plataforma (contrato da API: GET /api/roles/list-all). */
export interface Role {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
}
