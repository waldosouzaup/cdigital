/**
 * Máquina de estados do contrato — Seção 7 do PROMPT-Comite-Digital.md.
 *
 * Função pura, sem dependência de banco. Toda transição bem-sucedida deve gravar uma
 * linha em `eventos_contrato` na mesma transação de quem chama esta função (ver
 * src/lib/contratos/transicionar.ts, que envolve isso com a persistência).
 */

export type ContractStatus =
  | "rascunho"
  | "emitido"
  | "enviado"
  | "assinado"
  | "distratado"
  | "distrato_assinado"
  | "encerrado"
  | "cancelado";

/** Mapa de transições permitidas — a única fonte da verdade sobre o fluxo do contrato. */
const ALLOWED_TRANSITIONS: Record<ContractStatus, readonly ContractStatus[]> = {
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
export const ACTIVE_BOARD_STATUSES: readonly ContractStatus[] = [
  "emitido",
  "enviado",
  "assinado",
];

export function canTransition(from: ContractStatus, to: ContractStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/**
 * Valida a transição e retorna o novo estado, ou lança um erro explicativo em
 * português nomeando o estado atual e os destinos permitidos.
 */
export function transitionOrThrow(from: ContractStatus, to: ContractStatus): ContractStatus {
  if (!canTransition(from, to)) {
    const allowedDestinations = ALLOWED_TRANSITIONS[from];
    const destinationsText =
      allowedDestinations.length > 0
        ? allowedDestinations.join(", ")
        : "nenhum — este é um estado final";
    throw new Error(
      `Transição inválida: o contrato está em "${from}" e não pode ir para "${to}". ` +
        `A partir de "${from}", os destinos permitidos são: ${destinationsText}.`,
    );
  }
  return to;
}
