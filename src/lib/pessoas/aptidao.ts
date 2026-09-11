/**
 * Regra de aptidão documental — Fase 2, item 6: "Documentação completa e aprovada
 * marca a pessoa como apta." Função pura, separada da leitura do banco, porque a
 * lista de tipos obrigatórios só tende a crescer (hoje é 1 tipo — ver
 * TIPO_DOCUMENTO_PADRAO em src/app/api/coleta/[token]/documento/route.ts) e a regra
 * "todos aprovados, nenhum pendente nem rejeitado" precisa continuar certa quando
 * virarem vários.
 */

export const DOCUMENTOS_OBRIGATORIOS = [
  "documento_identidade",
  "comprovante_endereco",
] as const;

export interface DocumentoParaAptidao {
  tipo: string;
  status: "pendente" | "aprovado" | "rejeitado";
  /** Quando omitida, todo documento do mesmo tipo é tratado como a versão vigente —
   * quem chama normalmente já filtra para só a versão mais recente por tipo. */
  versao?: number;
}

/**
 * Considera só a versão mais recente de cada tipo obrigatório (reenvio substitui a
 * decisão da versão anterior — Fase 2, item 5) e exige todas aprovadas, nenhuma
 * pendente ou rejeitada.
 */
export function pessoaEstaApta(documentos: DocumentoParaAptidao[]): boolean {
  return DOCUMENTOS_OBRIGATORIOS.every((tipoObrigatorio) => {
    const doTipo = documentos.filter((d) => d.tipo === tipoObrigatorio);
    if (doTipo.length === 0) return false;

    const maisRecente = doTipo.reduce((maior, atual) =>
      (atual.versao ?? 1) > (maior.versao ?? 1) ? atual : maior,
    );

    return maisRecente.status === "aprovado";
  });
}
