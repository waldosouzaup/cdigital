/**
 * Estado da Server Action de autoinscrição — fora de `acoes.ts` (arquivo
 * `"use server"` só exporta funções assíncronas).
 */
import type { EntradaInscricao } from "@/lib/inscricao/validacao";

export interface EstadoInscricao {
  status: "idle" | "sucesso" | "erro";
  /** Token do `links_coleta` recém-criado — a página redireciona para /coleta/<token>. */
  token?: string;
  /** CPF já tinha cadastro nesta organização — mensagem neutra, sem revelar nada. */
  jaExistia?: boolean;
  mensagem?: string;
  errors?: Partial<Record<keyof EntradaInscricao, string>>;
}

export const ESTADO_INICIAL_INSCRICAO: EstadoInscricao = { status: "idle" };
