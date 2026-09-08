/**
 * Estado inicial da Server Action da coleta pública — fora de `acoes.ts` porque
 * um arquivo `"use server"` só pode exportar funções assíncronas (exportar a
 * constante dali faz o Next.js 15 responder 500 na invocação da action).
 */
export interface EstadoEnviarDadosColeta {
  status: "idle" | "sucesso" | "erro";
  mensagem?: string;
}

export const ESTADO_INICIAL_ENVIAR_DADOS: EstadoEnviarDadosColeta = { status: "idle" };
