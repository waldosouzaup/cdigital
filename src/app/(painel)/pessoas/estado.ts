/**
 * Tipos e estado inicial das Server Actions de pessoas.
 *
 * Fica FORA de `acoes.ts` de propósito: um arquivo `"use server"` só pode
 * exportar funções assíncronas — exportar uma constante (o estado inicial do
 * `useActionState`) dali faz o Next.js 15 responder 500 em toda invocação de
 * action do módulo.
 */
import type { EntradaPessoa } from "@/lib/pessoas/validacao";

export interface EstadoCriarPessoa {
  status: "idle" | "sucesso" | "erro" | "duplicada";
  errors?: Partial<Record<keyof EntradaPessoa, string>>;
  mensagem?: string;
  pessoaExistenteId?: string;
}

export const ESTADO_INICIAL_CRIAR_PESSOA: EstadoCriarPessoa = { status: "idle" };
