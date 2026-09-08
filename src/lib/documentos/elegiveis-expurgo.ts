/**
 * Retenção e expurgo de documentos pessoais — Fase 4, item 6.
 *
 * Lógica pura. Todos os registros de `documentos` são documentos pessoais
 * (RG/CNH/comprovante), então, passada a carência de retenção após o fim da
 * campanha, todos os que ainda não foram expurgados ficam elegíveis. A ação de
 * expurgo apaga o objeto no Storage e grava a linha em `expurgos` — este módulo
 * só decide *o quê*.
 */
export interface DocumentoRetencao {
  id: string;
  criadoEm: string;
  expurgadoEm: string | null;
}

/** Data (YYYY-MM-DD) a partir da qual o expurgo é permitido. */
export function dataLiberacaoExpurgo(fimCampanhaIso: string, carenciaDias: number): string {
  const base = new Date(`${fimCampanhaIso.slice(0, 10)}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + carenciaDias);
  return base.toISOString().slice(0, 10);
}

export function documentosParaExpurgo(
  documentos: DocumentoRetencao[],
  fimCampanhaIso: string,
  carenciaDias: number,
  hojeIso: string,
): string[] {
  const liberacao = dataLiberacaoExpurgo(fimCampanhaIso, carenciaDias);
  const hoje = hojeIso.slice(0, 10);
  if (Date.parse(`${hoje}T00:00:00Z`) < Date.parse(`${liberacao}T00:00:00Z`)) return [];

  return documentos.filter((d) => d.expurgadoEm == null).map((d) => d.id);
}

// Reexportado para o caller não recalcular a constante.
export const CARENCIA_PADRAO_DIAS = 180;
