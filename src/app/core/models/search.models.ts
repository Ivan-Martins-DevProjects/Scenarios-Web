/** Trecho que corresponde à busca, com as posições do casamento. */
export interface SearchMatch {
  excerpt: string;
  ranges: [number, number][];
}

/** Resultado da busca global (contrato da API: GET /api/search). */
export interface SearchHit {
  kind: 'folder' | 'note' | 'content' | 'reference';
  folder_id: string;
  folder_name: string;
  note_id?: string;
  note_name?: string;
  title: string;
  matches: SearchMatch[];
}

/** Segmento de um trecho, marcando o que casou com a expressão. */
export interface MatchSegment {
  text: string;
  matched: boolean;
}
