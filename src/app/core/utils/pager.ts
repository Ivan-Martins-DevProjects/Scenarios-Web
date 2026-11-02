export type PagerItem = number | 'gap';

/**
 * Constrói a sequência de itens do paginador: números de página e
 * 'gap' (reticências) quando há intervalos ocultos.
 * Sempre inclui a primeira e a última página e ±1 ao redor da atual.
 */
export function buildPager(totalPages: number, current: number): PagerItem[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: PagerItem[] = [1];

  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);

  if (start > 2) {
    items.push('gap');
  }
  for (let page = start; page <= end; page++) {
    items.push(page);
  }
  if (end < totalPages - 1) {
    items.push('gap');
  }
  items.push(totalPages);

  return items;
}
