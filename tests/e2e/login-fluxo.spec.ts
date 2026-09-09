import { test, expect } from "@playwright/test";
import { admin } from "./_sessao";

/**
 * Fluxo de login de ponta a ponta contra o Supabase real: e-mail + senha.
 *
 *  - usuário com senha definitiva entra direto no painel.
 *  - usuário com senha temporária (`app_metadata.must_change_password`) é levado
 *    para /definir-senha e só chega ao painel depois de escolher uma senha.
 *
 * MFA/TOTP deixou de ser obrigatório (migration 0018) — é opcional, fora do fluxo
 * de login.
 *
 * Pré-requisitos: `npm run dev` + variáveis de `.env.local` no shell.
 */
test.use({ viewport: { width: 1280, height: 900 } });

const SENHA_DEFINITIVA = "SenhaDefinitiva!123";
const SENHA_TEMP = "TempPrimeiroAcesso!9";

let orgId: string;

test.beforeAll(async () => {
  const { data: org } = await admin
    .from("organizacoes")
    .select("id")
    .eq("nome", "Comitê Michelle — Eleição 2026")
    .single();
  orgId = org!.id;
});

async function recriarUsuario(
  email: string,
  papel: string,
  opcoes: { senha: string; mustChange: boolean; regiaoId?: string },
) {
  const list = await admin.auth.admin.listUsers();
  const antigo = list.data.users.find((u) => u.email === email);
  if (antigo) await admin.auth.admin.deleteUser(antigo.id).catch(() => {});
  const { data } = await admin.auth.admin.createUser({
    email,
    password: opcoes.senha,
    email_confirm: true,
    app_metadata: { must_change_password: opcoes.mustChange },
  });
  const user = data.user!;
  await admin.from("usuarios").upsert({
    id: user.id,
    organizacao_id: orgId,
    nome: `E2E Login ${papel}`,
    email,
    papel,
    regiao_id: opcoes.regiaoId ?? null,
  });
  return user;
}

test("coord_regiao com senha definitiva entra direto no painel", async ({ page }) => {
  const email = "e2e-login-coord@exemplo.invalid";
  const { data: reg } = await admin
    .from("regioes")
    .select("id")
    .eq("organizacao_id", orgId)
    .order("nome")
    .limit(1)
    .single();
  const user = await recriarUsuario(email, "coord_regiao", {
    senha: SENHA_DEFINITIVA,
    mustChange: false,
    regiaoId: reg!.id,
  });

  try {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(SENHA_DEFINITIVA);
    await page.getByRole("button", { name: /^Entrar$/ }).click();

    await page.waitForURL("**/dashboard", { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await page.goto("/pessoas", { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: /Pessoas/i })).toBeVisible();
  } finally {
    await admin.from("usuarios").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
  }
});

test("senha temporária: login leva a /definir-senha e só libera o painel após a troca", async ({
  page,
}) => {
  const email = "e2e-login-primeiro-acesso@exemplo.invalid";
  const user = await recriarUsuario(email, "gestor", { senha: SENHA_TEMP, mustChange: true });

  try {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email);
    await page.getByLabel("Senha").fill(SENHA_TEMP);
    await page.getByRole("button", { name: /^Entrar$/ }).click();

    // O middleware barra o painel até a troca.
    await page.waitForURL("**/definir-senha", { timeout: 20_000 });

    await page.getByLabel(/Nova senha/i).fill(SENHA_DEFINITIVA);
    await page.getByLabel(/Repita a nova senha/i).fill(SENHA_DEFINITIVA);
    await page.getByRole("button", { name: /Salvar e continuar/i }).click();

    await page.waitForURL("**/dashboard", { timeout: 20_000 });
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    // Nova sessão: recarregar o painel não volta mais para /definir-senha.
    await page.goto("/regioes", { waitUntil: "networkidle" });
    await expect(page).toHaveURL(/\/regioes$/);
  } finally {
    await admin.from("usuarios").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
  }
});
