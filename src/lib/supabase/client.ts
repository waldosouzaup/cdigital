/**
 * Cliente Supabase para uso no navegador (Client Components).
 *
 * Usa a chave pública — RLS sempre ativo, nunca a service_role (Seção 3.1). A
 * variável `NEXT_PUBLIC_SUPABASE_ANON_KEY` mantém o nome da Seção 3.2, mas aceita
 * tanto uma chave legada `anon` (JWT) quanto uma nova `publishable` (`sb_publishable_...`)
 * — o Context 7 confirmou que as legadas saem de circulação no fim de 2026 (ver
 * CONSULTAS.md), e a lib trata as duas como uma string opaca de API key, sem exigir
 * variável própria para cada formato.
 */
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
