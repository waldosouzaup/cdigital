/**
 * Cliente Supabase para uso no servidor (Server Components, Server Actions, Route
 * Handlers) — Seção 3.1: chave pública + JWT do usuário, RLS sempre ativo.
 *
 * `cookies()` do Next.js 15 é assíncrono (Context 7) — por isso esta função também é.
 * `getAll`/`setAll` são a API atual do `@supabase/ssr` (`get`/`set`/`remove` estão
 * depreciados).
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado a partir de um Server Component, que não pode escrever cookie.
            // Inofensivo aqui: o middleware já cuida de renovar a sessão a cada request.
          }
        },
      },
    },
  );
}
