/**
 * Contexto do usuário logado, lido das claims do JWT (Custom Access Token Hook,
 * Fase 1) — sem round-trip a `usuarios`. Extraído para cá porque a mesma leitura
 * já se repetia em `(painel)/pessoas/acoes.ts` e `(painel)/documentos/acoes.ts`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ContextoUsuario {
  organizationId: string | undefined;
  userId: string | null;
}

export async function obterContextoUsuario(supabase: SupabaseClient): Promise<ContextoUsuario> {
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, unknown> | undefined;
  return {
    organizationId: claims?.organizacao_id as string | undefined,
    userId: (claims?.sub as string | undefined) ?? null,
  };
}
