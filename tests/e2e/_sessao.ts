import type { BrowserContext, Page } from "@playwright/test";
import { createHmac } from "node:crypto";
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

/** TOTP de 6 dígitos a partir de um secret base32 (para o fluxo de MFA nos testes). */
export function totp(secret: string, at = Date.now()): string {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.replace(/=+$/, "").toUpperCase()) {
    const v = A.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  const counter = Math.floor(at / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const h = createHmac("sha1", Buffer.from(bytes)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  return String(
    (((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1_000_000,
  ).padStart(6, "0");
}

/**
 * Passa pela tela /mfa: cadastra o TOTP a partir do secret exibido e verifica.
 * O `mfa.enroll` do Supabase pode ter rate limit quando dois testes cadastram
 * fator em sequência — recua e recarrega até 3 vezes.
 */
export async function passarPeloMfa(page: Page): Promise<void> {
  await page.waitForURL("**/mfa", { timeout: 20_000 });
  for (let tentativa = 0; tentativa < 4; tentativa++) {
    const emErro = await page
      .getByText(/Não foi possível iniciar a verificação/i)
      .isVisible()
      .catch(() => false);
    if (emErro) {
      await page.waitForTimeout(3000 * (tentativa + 1));
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      continue;
    }
    const secret = (await page.getByText(/[A-Z2-7]{16,}/).first().innerText()).replace(/\s/g, "");
    await page.getByRole("textbox").first().fill(totp(secret));
    await page.getByRole("button", { name: /verificar|confirmar|entrar/i }).click();
    await page.waitForURL("**/dashboard", { timeout: 20_000 });
    return;
  }
  throw new Error("MFA não iniciou depois de recarregar (rate limit do enroll?)");
}

/**
 * Cria uma sessão já em **aal2** para um usuário, fazendo enroll + challenge +
 * verify do TOTP pelo lado servidor (sem passar pela tela /mfa). Injeta o cookie
 * no contexto. Para testes que precisam de um gestor/coord_comite autenticado
 * mas cujo foco NÃO é o fluxo de MFA em si.
 */
export async function autenticarContextoAal2(
  context: BrowserContext,
  email: string,
  senha: string,
): Promise<void> {
  const anon = createClient(SUPA_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: login, error: erroLogin } = await anon.auth.signInWithPassword({
    email,
    password: senha,
  });
  if (erroLogin || !login.session) throw erroLogin ?? new Error("sem sessão");

  const fatores = await anon.auth.mfa.listFactors();
  let factorId = fatores.data?.totp?.find((f) => f.status === "verified")?.id;

  if (!factorId) {
    const enroll = await anon.auth.mfa.enroll({ factorType: "totp" });
    if (enroll.error || !enroll.data) throw enroll.error ?? new Error("enroll falhou");
    const secret = enroll.data.totp.secret;
    const challenge = await anon.auth.mfa.challenge({ factorId: enroll.data.id });
    if (challenge.error) throw challenge.error;
    const verify = await anon.auth.mfa.verify({
      factorId: enroll.data.id,
      challengeId: challenge.data.id,
      code: totp(secret),
    });
    if (verify.error) throw verify.error;
    factorId = enroll.data.id;
  }

  const { data: sess } = await anon.auth.getSession();
  const payload = "base64-" + Buffer.from(JSON.stringify(sess.session)).toString("base64");
  const CHUNK = 3180;
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
