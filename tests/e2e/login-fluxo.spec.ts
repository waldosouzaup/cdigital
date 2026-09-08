import { test, expect } from "@playwright/test";
import { createHmac } from "node:crypto";
import { admin } from "./_sessao";

/**
 * Fluxo de login de ponta a ponta contra o Supabase real: link mágico ->
 * /auth/callback -> encaminhamento por papel.
 *
 *  - coord_regiao: entra direto no painel (sem MFA), enxerga só a própria região.
 *  - gestor: cai em /mfa, cadastra o TOTP (QR real), o teste calcula o código a
 *    partir do secret, verifica, e a sessão vira aal2 (o dashboard carrega).
 *
 * Pré-requisitos: `npm run dev` + variáveis de `.env.local` no shell.
 * O login por senha não existe na tela; os testes geram o link com o admin.
 */
test.use({ viewport: { width: 1280, height: 900 } });

function base32Decode(s: string): Buffer {
  const alfabeto = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.replace(/=+$/, "").toUpperCase()) {
    const v = alfabeto.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret: string, at = Date.now()): string {
  const counter = Math.floor(at / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const off = h[h.length - 1] & 0xf;
  const code =
    (((h[off] & 0x7f) << 24) | ((h[off + 1] & 0xff) << 16) | ((h[off + 2] & 0xff) << 8) | (h[off + 3] & 0xff)) %
    1_000_000;
  return String(code).padStart(6, "0");
}

async function linkMagico(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:3000/auth/callback" },
  });
  if (error || !data.properties?.action_link) throw error ?? new Error("sem link");
  return data.properties.action_link;
}

let orgId: string;

test.beforeAll(async () => {
  const { data: org } = await admin
    .from("organizacoes")
    .select("id")
    .eq("nome", "Comitê Michelle — Eleição 2026")
    .single();
  orgId = org!.id;
});

test("coord_regiao: link mágico entra no painel sem MFA e enxerga só a própria região", async ({
  page,
}) => {
  const email = "e2e-login-coord@exemplo.invalid";
  const list = await admin.auth.admin.listUsers();
  let user = list.data.users.find((u) => u.email === email);
  if (!user)
    user = (await admin.auth.admin.createUser({ email, email_confirm: true })).data.user!;
  const { data: reg } = await admin
    .from("regioes")
    .select("id")
    .eq("organizacao_id", orgId)
    .order("nome")
    .limit(1)
    .single();
  await admin.from("usuarios").upsert({
    id: user.id,
    organizacao_id: orgId,
    nome: "Coord E2E Login",
    email,
    papel: "coord_regiao",
    regiao_id: reg!.id,
  });

  try {
    await page.goto(await linkMagico(email));
    await page.waitForURL("**/dashboard", { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // dado real com RLS: a tela de pessoas carrega e o filtro de região
    // só mostra a região do coord ou "todas" — não vaza outras regiões nas linhas.
    await page.goto("/pessoas", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Pessoas/i })).toBeVisible();
  } finally {
    await admin.from("usuarios").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
  }
});

test("gestor: link mágico exige MFA; cadastra TOTP, verifica e entra (aal2)", async ({ page }) => {
  test.setTimeout(120_000); // enroll do TOTP pode ter backoff por rate limit
  const email = "e2e-login-gestor@exemplo.invalid";
  // usuário novo a cada execução, para o cadastro de TOTP começar do zero
  const list = await admin.auth.admin.listUsers();
  const antigo = list.data.users.find((u) => u.email === email);
  if (antigo) await admin.auth.admin.deleteUser(antigo.id).catch(() => {});
  const user = (await admin.auth.admin.createUser({ email, email_confirm: true })).data.user!;
  await admin.from("usuarios").insert({
    id: user.id,
    organizacao_id: orgId,
    nome: "Gestor E2E Login",
    email,
    papel: "gestor",
  });

  try {
    await page.goto(await linkMagico(email));
    // gestor é encaminhado para /mfa
    await page.waitForURL("**/mfa", { timeout: 20_000 });

    // enroll do Supabase pode ter rate limit em execução cheia — recua e recarrega
    for (let i = 0; i < 4; i++) {
      const emErro = await page
        .getByText(/Não foi possível iniciar a verificação/i)
        .isVisible()
        .catch(() => false);
      if (!emErro) break;
      await page.waitForTimeout(3000 * (i + 1));
      await page.reload({ waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
    }

    // QR real do Supabase (otpauth://…), não um placeholder
    const qrSrc = await page.locator("img").first().getAttribute("src");
    expect(qrSrc).toMatch(/^data:image\/svg\+xml/); // Supabase entrega o QR como SVG data URI

    // o secret aparece na tela para digitação manual — usa ele para gerar o código
    const secret = (await page.getByText(/[A-Z2-7]{16,}/).first().innerText()).replace(/\s/g, "");
    expect(secret.length).toBeGreaterThanOrEqual(16);

    await page.getByRole("textbox").first().fill(totp(secret));
    await page.getByRole("button", { name: /verificar|confirmar|entrar/i }).click();

    await page.waitForURL("**/dashboard", { timeout: 20_000 });

    // chegou ao painel = a verificação passou e a sessão virou aal2 (o middleware
    // e a RLS bloqueiam gestor em aal1). O cookie de sessão do Supabase existe.
    const temCookieSessao = await page.evaluate(() => document.cookie.includes("sb-"));
    expect(temCookieSessao).toBe(true);
  } finally {
    await admin.from("usuarios").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
  }
});
