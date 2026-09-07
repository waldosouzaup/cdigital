/**
 * Máquina de estados do contrato — Seção 7 do PROMPT-Comite-Digital.md.
 *
 * Função pura, sem dependência de banco. Toda transição bem-sucedida deve gravar uma
 * linha em `eventos_contrato` na mesma transação de quem chama esta função (ver
 * src/lib/contratos/transicionar.ts, que envolve isso com a persistência).
 */

export type StatusContrato =
  | "rascunho"
  | "emitido"
  | "enviado"
  | "assinado"
  | "distratado"
  | "distrato_assinado"
  | "encerrado"
  | "cancelado";

/** Mapa de transições permitidas — a única fonte da verdade sobre o fluxo do contrato. */
const TRANSICOES_PERMITIDAS: Record<StatusContrato, readonly StatusContrato[]> = {
  rascunho: ["emitido", "cancelado"],
  emitido: ["enviado", "cancelado"],
  enviado: ["assinado", "cancelado"],
  assinado: ["distratado", "encerrado"],
  distratado: ["distrato_assinado"],
  distrato_assinado: [],
  encerrado: [],
  cancelado: [],
};

/**
 * Estados que contam no quadro ativo do dashboard (Seção 7, "Regra de contagem").
 * Os estados de distrato formam visão separada e nunca entram neste total.
 */
export const CONTAM_NO_QUADRO_ATIVO: readonly StatusContrato[] = [
  "emitido",
  "enviado",
  "assinado",
];

export function podeTransicionar(de: StatusContrato, para: StatusContrato): boolean {
  return TRANSICOES_PERMITIDAS[de].includes(para);
}

/**
 * Valida a transição e retorna o novo estado, ou lança um erro explicativo em
 * português nomeando o estado atual e os destinos permitidos.
 */
export function transicionarOuErro(de: StatusContrato, para: StatusContrato): StatusContrato {
  if (!podeTransicionar(de, para)) {
    const destinos = TRANSICOES_PERMITIDAS[de];
    const destinosTexto =
      destinos.length > 0 ? destinos.join(", ") : "nenhum — este é um estado final";
    throw new Error(
      `Transição inválida: o contrato está em "${de}" e não pode ir para "${para}". ` +
        `A partir de "${de}", os destinos permitidos são: ${destinosTexto}.`,
    );
  }
  return para;
}
