/**
 * Valor de contrato por extenso — Seção 3 e Seção 12 do PROMPT-Comite-Digital.md.
 *
 * Regra do projeto: "Nunca escrever valor por extenso à mão" — este arquivo é só um
 * wrapper fino sobre a biblioteca `extenso`, nunca reimplementa a conversão.
 *
 * O Context 7 não cobre o pacote `extenso` (consulta registrada em CONSULTAS.md como
 * lacuna); a API abaixo vem do README oficial do pacote (lusofonia/extenso.js).
 */
import extenso from "extenso";

/**
 * Recebe um valor em reais — número ou string (como o Drizzle devolve para colunas
 * `numeric`) — e retorna o valor por extenso em português, modo moeda (BRL).
 */
export function valorExtenso(valorEmReais: number | string): string {
  return extenso(valorEmReais, { mode: "currency", currency: { type: "BRL" } });
}
