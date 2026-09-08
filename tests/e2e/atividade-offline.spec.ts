import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

/**
 * Fase 4, item 2 — gate: "Registro de atividade em modo avião entra na fila e
 * sobe sozinho ao restaurar a rede." + "PWA instalável".
 *
 * Pré-requisitos: `npm run dev` rodando e as variáveis de `.env.local` no shell.
 * Autentica injetando o cookie de sessão do @supabase/ssr (login é link mágico;
 * não dá para digitar senha na tela).
 */
const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const REF = new URL(SUPA_URL).hostname.split(".")[0];
const EMAIL = "e2e-atividade-offline@exemplo.invalid";
const SENHA = "SenhaDeTeste!123456";

const admin = createClient(SUPA_URL, process.env.SUPABASE_SERVICE_ROLE_KEY!);

let userId: string;
let pessoaId: string;
let pessoaNome: string;
let orgId: string;

test.beforeAll(async () => {
  const { data: org } = await admin
    .from("organizacoes")
    .select("id")
    .eq("nome", "Comitê Michelle — Eleição 2026")
    .single();
  orgId = org!.id;

  const { data: regiao } = await admin
    .from("regioes")
    .select("id, nome")
    .eq("organizacao_id", orgId)
    .order("nome")
    .limit(1)
    .single();

  const lista = await admin.auth.admin.listUsers();
  let user = lista.data.users.find((u) => u.email === EMAIL);
  if (!user) {
    user = (
      await admin.auth.admin.createUser({ email: EMAIL, password: SENHA, email_confirm: true })
    ).data.user!;
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: SENHA });
  }
  userId = user.id;
  await admin.from("usuarios").upsert({
    id: userId,
    organizacao_id: orgId,
    nome: "Coord E2E Offline",
    email: EMAIL,
    papel: "coord_regiao",
    regiao_id: regiao!.id,
  });

  const { data: pessoa } = await admin
    .from("pessoas")
    .insert({
      organizacao_id: orgId,
      nome_completo: "Pessoa E2E Offline",
      cpf: "39053344705",
      regiao_id: regiao!.id,
      apta: true,
    })
    .select("id, nome_completo")
    .single();
  pessoaId = pessoa!.id;
  pessoaNome = pessoa!.nome_completo;
});

test.afterAll(async () => {
  await admin.from("registros_atividade").delete().eq("pessoa_id", pessoaId);
  await admin.from("log_auditoria").delete().eq("usuario_id", userId);
  await admin.from("pessoas").delete().eq("id", pessoaId);
  await admin.from("usuarios").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
});

test("modo avião: registro entra na fila e sobe sozinho ao voltar a rede", async ({
  page,
  context,
}) => {
  // Sessão via cookie do @supabase/ssr.
  const anon = createClient(SUPA_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const { data: sess } = await anon.auth.signInWithPassword({ email: EMAIL, password: SENHA });
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

  page.on("console", (m) => console.log(`[browser:${m.type()}]`, m.text()));
  page.on("pageerror", (e) => console.log("[pageerror]", e.message));

  await page.goto("/atividades", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Registrar atividade" })).toBeVisible();

  // manifest presente (PWA instalável)
  const manifestHref = await page.getAttribute('link[rel="manifest"]', "href");
  expect(manifestHref).toBeTruthy();

  // Escolhe a pessoa de teste
  await page.getByLabel("Quem executou a atividade").selectOption({ label: pessoaNome });

  // ENTRA EM MODO AVIÃO
  await context.setOffline(true);

  await page.getByRole("button", { name: "Panfletagem", exact: true }).click();
  await page.getByRole("button", { name: "3 · Registrar atividade" }).click();

  // Feedback de fila + fila local com 1 item
  await expect(page.getByText(/entrou na fila/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText(/1 registro\(s\) na fila/i)).toBeVisible();

  const naFilaAntes = await page.evaluate(async () => {
    const req = indexedDB.open("comite-campo", 1);
    return await new Promise<number>((resolve) => {
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("fila-atividades", "readonly");
        const count = tx.objectStore("fila-atividades").count();
        count.onsuccess = () => resolve(count.result);
      };
    });
  });
  expect(naFilaAntes).toBe(1);

  // Nada gravado no banco ainda
  const { count: antes } = await admin
    .from("registros_atividade")
    .select("id", { count: "exact", head: true })
    .eq("pessoa_id", pessoaId);
  expect(antes ?? 0).toBe(0);

  // VOLTA A REDE
  await context.setOffline(false);
  await page.waitForTimeout(500);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  // O registro chega ao banco (critério do gate), com sincronizado_em preenchido.
  await expect
    .poll(
      async () => {
        const { data } = await admin
          .from("registros_atividade")
          .select("tipo, quantidade, sincronizado_em")
          .eq("pessoa_id", pessoaId);
        return data ?? [];
      },
      { timeout: 20_000 },
    )
    .toEqual([
      expect.objectContaining({ tipo: "Panfletagem", sincronizado_em: expect.any(String) }),
    ]);

  // E o banner de pendências some
  await expect(page.getByText(/registro\(s\) na fila/i)).toBeHidden({ timeout: 10_000 });

  const naFilaDepois = await page.evaluate(async () => {
    const req = indexedDB.open("comite-campo", 1);
    return await new Promise<number>((resolve) => {
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("fila-atividades", "readonly");
        const count = tx.objectStore("fila-atividades").count();
        count.onsuccess = () => resolve(count.result);
      };
    });
  });
  expect(naFilaDepois).toBe(0);
});
