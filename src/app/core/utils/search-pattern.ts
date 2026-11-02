/** Escapa caracteres especiais de regex no texto digitado pelo usuário. */
export function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Padrão RE2 (Go) enviado à API: case-insensitive, com espaços casando
 * qualquer sequência de espaço em branco.
 */
export function buildSearchPattern(term: string): string {
  return '(?i)' + escapeForRegex(term.trim()).replace(/ /g, '\\s+');
}

/** Regex JS equivalente, usada para localizar a ocorrência no DOM exibido. */
export function buildSearchRegex(term: string): RegExp {
  return new RegExp(escapeForRegex(term.trim()).replace(/ /g, '\\s+'), 'gi');
}
