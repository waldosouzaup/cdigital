/**
 * Cliente Supabase com a `service_role` key.
 *
 * ATENÇÃO (Seção 3.1 do PROMPT-Comite-Digital.md): a `service_role` ignora o RLS por
 * completo. Se este cliente for usado para atender uma requisição de usuário, o
 * isolamento multi-tenant deixa de existir — silenciosamente, sem nenhum sintoma visível.
 *
 * Uso permitido: seed, migrations, jobs do pg_cron e webhooks (ex.: `/api/webhooks/resend`,
 * `/api/cron/*`). NUNCA em Server Action ou Route Handler que responde a uma sessão de
 * usuário autenticado.
 *
 * A regra de ESLint em `eslint.config.mjs` proíbe importar este arquivo dentro de
 * `src/app/(painel)/**` — não contorne essa regra.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// `SupabaseClient` direto, não `ReturnType<typeof createClient>`: extrair o retorno
// de uma função genérica não instanciada não aplica os parâmetros-padrão da mesma
// forma que chamar a função aplica, e deixa `.update()`/`.insert()` como `never` em
// tempo de compilação (achado do `tsc`, não do Context 7).
let cliente: SupabaseClient | undefined;

export function criarClienteAdmin(): SupabaseClient {
  if (cliente) return cliente;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chaveSecreta = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !chaveSecreta) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são obrigatórias para o cliente admin.",
    );
  }

  cliente = createClient(url, chaveSecreta, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return cliente;
}
