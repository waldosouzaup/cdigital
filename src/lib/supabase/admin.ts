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
import { createClient } from "@supabase/supabase-js";

let cliente: ReturnType<typeof createClient> | undefined;

export function criarClienteAdmin() {
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
