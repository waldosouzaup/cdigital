/**
 * Estado das Server Actions de Gestão de Acessos — fora de `acoes.ts` (arquivo
 * `"use server"` só exporta funções assíncronas).
 *
 * O convite (criar membro + usuário de autenticação) NÃO usa Server Action: sai
 * do cliente via `fetch('/api/equipe/convite')`, porque um arquivo sob
 * `src/app/(painel)/**` não pode importar `@/lib/supabase/admin` (regra de ESLint).
 */
export interface EstadoAlterarPapel {
  status: "idle" | "sucesso" | "erro";
  erros?: { papel?: string; regiaoId?: string };
  mensagem?: string;
}

export const ESTADO_INICIAL_ALTERAR_PAPEL: EstadoAlterarPapel = { status: "idle" };

export interface EstadoAtivo {
  status: "idle" | "sucesso" | "erro";
  mensagem?: string;
}

export const ESTADO_INICIAL_ATIVO: EstadoAtivo = { status: "idle" };
