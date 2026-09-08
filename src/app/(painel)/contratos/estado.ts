/**
 * Estados iniciais das Server Actions de contrato — fora de `acoes.ts` porque um
 * arquivo `"use server"` só pode exportar funções assíncronas (exportar a
 * constante dali faz o Next.js 15 responder 500 na invocação da action).
 */
export interface EstadoEmitirContrato {
  status: "idle" | "sucesso" | "erro";
  mensagem?: string;
}

export const ESTADO_INICIAL_EMITIR_CONTRATO: EstadoEmitirContrato = { status: "idle" };

export interface EstadoEmitirLote {
  status: "idle" | "sucesso" | "erro";
  mensagem?: string;
  sucessos?: number;
  falhas?: { pessoaNome: string; motivo: string }[];
}

export const ESTADO_INICIAL_EMITIR_LOTE: EstadoEmitirLote = { status: "idle" };
