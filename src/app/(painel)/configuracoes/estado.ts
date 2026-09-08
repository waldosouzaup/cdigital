/**
 * Estado inicial da Server Action de modelo de contrato — fora de `acoes.ts`
 * porque um arquivo `"use server"` só pode exportar funções assíncronas
 * (exportar a constante dali faz o Next.js 15 responder 500 na invocação).
 */
export interface EstadoSalvarTemplate {
  status: "idle" | "sucesso" | "erro";
  mensagem?: string;
}

export const ESTADO_INICIAL_SALVAR_TEMPLATE: EstadoSalvarTemplate = { status: "idle" };
