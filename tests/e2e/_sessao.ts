import type { BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Autentica um contexto do Playwright injetando o cookie de sessão do
 * `@supabase/ssr`. O login real é link mágico (sem senha na tela), então os
 * testes E2E criam o usuário com senha via admin e montam o cookie na mão.
 */
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const REF = new URL(SUPA_URL).hostname.split(".")[0];
const CHUNK = 3180;

export const admin = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function autenticarContexto(
  context: BrowserContext,
  email: string,
  senha: string,
): Promise<void> {
  const anon = createClient(SUPA_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data, error } = await anon.auth.signInWithPassword({ email, password: senha });
  if (error || !data.session) throw error ?? new Error("sem sessão");

  const payload = "base64-" + Buffer.from(JSON.stringify(data.session)).toString("base64");
  const cookies =
    payload.length <= CHUNK
      ? [{ name: `sb-${REF}-auth-token`, value: payload }]
      : Array.from({ length: Math.ceil(payload.length / CHUNK) }, (_, i) => ({
          name: `sb-${REF}-auth-token.${i}`,
          value: payload.slice(i * CHUNK, (i + 1) * CHUNK),
        }));

  await context.addCookies(
    cookies.map((c) => ({
      ...c,
      domain: "localhost",
      path: "/",
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    })),
  );
}
