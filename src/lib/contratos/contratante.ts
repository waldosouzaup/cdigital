/**
 * Qualificação da parte CONTRATANTE nos documentos contratuais.
 *
 * Estava escrita dentro de `modelo-referencia.ts` e do termo de distrato padrão
 * — nome, cargo, partido, endereço e CNPJ de uma candidata específica. Não era
 * limitação de produto e sim defeito: o sistema já é multi-tenant, então a
 * segunda organização a emitir um contrato o emitiria com os dados da primeira.
 *
 * Função pura: recebe os campos da organização já lidos e devolve texto. Quem
 * chama decide de onde vêm (migration 0037).
 */

export interface DadosContratante {
  nome: string;
  cnpj?: string | null;
  endereco?: string | null;
  representanteNome?: string | null;
  representanteCargo?: string | null;
  /** Redação integral escrita pela organização. Tem precedência sobre a composição. */
  qualificacaoContratante?: string | null;
}

/** Marcadores que os modelos de contrato e de distrato podem usar. */
export const MARCADORES_CONTRATANTE: ReadonlyArray<{ marcador: string; rotulo: string }> = [
  { marcador: "{{contratante}}", rotulo: "Qualificação completa da contratante" },
  { marcador: "{{contratante_nome}}", rotulo: "Nome da contratante" },
  { marcador: "{{contratante_cnpj}}", rotulo: "CNPJ da contratante" },
  { marcador: "{{contratante_endereco}}", rotulo: "Endereço da contratante" },
];

function limpo(valor: string | null | undefined): string {
  return (valor ?? "").trim();
}

/**
 * Monta a linha da CONTRATANTE.
 *
 * A redação livre vem primeiro porque a forma de qualificar uma parte muda com o
 * tipo de operação — candidatura, construtora, produtora de evento — e nenhuma
 * decomposição em colunas cobriria todas. A composição é o caminho de quem não
 * quer escrever nada.
 */
export function qualificacaoContratante(dados: DadosContratante): string {
  const propria = limpo(dados.qualificacaoContratante);
  if (propria) return propria;

  const nome = limpo(dados.nome) || "(contratante não configurada)";

  // Cada trecho só entra se tiver conteúdo, para não sobrar vírgula órfã no PDF.
  const trechos: string[] = [];

  const cnpj = limpo(dados.cnpj);
  if (cnpj) trechos.push(`inscrita no CNPJ sob o nº ${cnpj}`);

  const endereco = limpo(dados.endereco);
  if (endereco) trechos.push(`com endereço em ${endereco}`);

  const representante = limpo(dados.representanteNome);
  if (representante) {
    const cargo = limpo(dados.representanteCargo);
    trechos.push(
      cargo
        ? `neste ato representada por ${representante}, ${cargo}`
        : `neste ato representada por ${representante}`,
    );
  }

  return trechos.length > 0
    ? `CONTRATANTE: ${nome}, ${trechos.join(", ")}.`
    : `CONTRATANTE: ${nome}.`;
}
