/**
 * Estado das Server Actions de regiões — fora de `acoes.ts` (arquivo
 * `"use server"` só exporta funções assíncronas).
 */
export interface EstadoRegiao {
  status: "idle" | "sucesso" | "erro";
  erro?: string;
  mensagem?: string;
}

export const ESTADO_INICIAL_REGIAO: EstadoRegiao = { status: "idle" };
