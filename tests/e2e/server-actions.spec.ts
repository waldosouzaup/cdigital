import { test, expect } from "@playwright/test";
import { admin, autenticarContextoAal2 } from "./_sessao";

const SENHA = "SenhaDeTeste!123456";

/**
 * Exercita as Server Actions PELO NAVEGADOR — o caminho que nenhum teste cobria
 * (os de integração gravam via `admin.from(...)`, contornando a action). É o que
 * expôs o bug: um arquivo `"use server"` que exporta uma constante (o estado
 * inicial do `useActionState`) faz o Next.js 15 responder 500 em toda invocação.
 *
 * Pré-requisitos: `npm run dev` + variáveis de `.env.local` no shell.
 */
test.use({ viewport: { width: 1280, height: 900 } });

async function entrar(page: import("@playwright/test").Page, email: string) {
  const { data } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { redirectTo: "http://localhost:3000/auth/callback" },
  });
  await page.goto(data!.properties!.action_link!);
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

test("criarPessoa: a Server Action grava a pessoa quando o coordenador clica em Salvar", async ({
  page,
}) => {
  const email = "e2e-sa-coord@exemplo.invalid";
  const nome = `Pessoa Server Action ${Date.now()}`;
  const list = await admin.auth.admin.listUsers();
  let user = list.data.users.find((u) => u.email === email);
  if (!user) user = (await admin.auth.admin.createUser({ email, email_confirm: true })).data.user!;
  const { data: reg } = await admin
    .from("regioes")
    .select("id, nome")
    .eq("organizacao_id", orgId)
    .order("nome")
    .limit(1)
    .single();
  await admin.from("usuarios").upsert({
    id: user.id,
    organizacao_id: orgId,
    nome: "Coord SA",
    email,
    papel: "coord_regiao",
    regiao_id: reg!.id,
  });

  try {
    await entrar(page, email);
    await page.waitForURL("**/dashboard", { timeout: 20_000 });
    await page.goto("/pessoas", { waitUntil: "networkidle" });

    await page.getByRole("button", { name: /Cadastrar Pessoa/i }).click();
    await page.locator("#novo-nome").fill(nome);
    await page.locator("#novo-cpf").fill("529.982.247-25"); // CPF válido
    await page.locator("#novo-regiao").selectOption({ label: reg!.nome });
    await page.getByRole("button", { name: /Salvar e Gerar Ficha/i }).click();

    await expect
      .poll(
        async () => {
          const { count } = await admin
            .from("pessoas")
            .select("id", { count: "exact", head: true })
            .eq("nome_completo", nome);
          return count ?? 0;
        },
        { timeout: 15_000 },
      )
      .toBe(1);
  } finally {
    const { data: p } = await admin.from("pessoas").select("id").eq("nome_completo", nome);
    for (const row of p ?? []) {
      await admin.from("log_auditoria").delete().eq("entidade_id", row.id);
      await admin.from("pessoas").delete().eq("id", row.id);
    }
    await admin.from("usuarios").delete().eq("id", user.id);
    await admin.auth.admin.deleteUser(user.id).catch(() => {});
  }
});

test("salvarTemplate: a Server Action grava o modelo quando o gestor clica em Salvar", async ({
  page,
  context,
}) => {
  // Gestor PERSISTENTE: criado uma vez e reutilizado (o fator TOTP fica
  // cadastrado), para não disparar `mfa.enroll` a cada execução — o rate limit
  // do enroll do Supabase colidia com o teste de login+MFA.
  const email = "e2e-persist-gestor@exemplo.invalid";
  const nomeModelo = `Modelo Server Action ${Date.now()}`;
  const list = await admin.auth.admin.listUsers();
  let user = list.data.users.find((u) => u.email === email);
  if (!user) {
    user = (await admin.auth.admin.createUser({ email, password: SENHA, email_confirm: true })).data
      .user!;
  } else {
    await admin.auth.admin.updateUserById(user.id, { password: SENHA });
  }
  await admin.from("usuarios").upsert({
    id: user.id,
    organizacao_id: orgId,
    nome: "Gestor SA (persistente)",
    email,
    papel: "gestor",
  });

  try {
    // Sessão já em aal2 (enroll+verify pelo lado servidor; o fator é reaproveitado
    // em execuções seguintes). O foco do teste é a Server Action, não a tela de MFA.
    await autenticarContextoAal2(context, email, SENHA);
    await page.goto("/configuracoes", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Novo Modelo de Contrato/i }).click();
    await page.locator("#template-nome").fill(nomeModelo);
    await page.locator("#template-objeto").fill("Prestação de serviços de campanha");
    await page.locator('textarea[name="corpoHtml"]').fill("<p>{{nome}} — {{valor_extenso}}</p>");
    await page.getByRole("button", { name: /Salvar Modelo/i }).click();

    await expect
      .poll(
        async () => {
          const { count } = await admin
            .from("templates_contrato")
            .select("id", { count: "exact", head: true })
            .eq("nome", nomeModelo);
          return count ?? 0;
        },
        { timeout: 15_000 },
      )
      .toBe(1);
  } finally {
    await admin.from("templates_contrato").delete().eq("nome", nomeModelo);
    // O gestor persistente NÃO é apagado — o fator TOTP é reaproveitado.
  }
});

test("salvarIdentidadeComite: o gestor edita nome/CNPJ e o valor persiste (item 4)", async ({
  page,
  context,
}) => {
  const email = "e2e-persist-gestor@exemplo.invalid";
  const user = (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === email)!;
  await admin.auth.admin.updateUserById(user.id, { password: SENHA });
  await admin.from("usuarios").upsert({
    id: user.id,
    organizacao_id: orgId,
    nome: "Gestor SA (persistente)",
    email,
    papel: "gestor",
  });

  const { data: original } = await admin
    .from("organizacoes")
    .select("nome, cnpj")
    .eq("id", orgId)
    .single();
  const novoNome = `${original!.nome} (teste ${Date.now() % 100000})`;

  try {
    await autenticarContextoAal2(context, email, SENHA);
    await page.goto("/configuracoes", { waitUntil: "networkidle" });

    await page.locator("#nome-comite").fill(novoNome);
    await page.locator("#cnpj").fill("11.222.333/0001-81"); // CNPJ válido
    await page.getByRole("button", { name: /Salvar identidade/i }).click();

    await expect
      .poll(
        async () => {
          const { data } = await admin
            .from("organizacoes")
            .select("nome, cnpj")
            .eq("id", orgId)
            .single();
          return data;
        },
        { timeout: 15_000 },
      )
      .toEqual({ nome: novoNome, cnpj: "11.222.333/0001-81" });
  } finally {
    // Restaura o valor original da organização real.
    await admin
      .from("organizacoes")
      .update({ nome: original!.nome, cnpj: original!.cnpj })
      .eq("id", orgId);
  }
});

test("criarRegiao / renomearRegiao: o gestor cadastra e renomeia uma região (item 2)", async ({
  page,
  context,
}) => {
  const email = "e2e-persist-gestor@exemplo.invalid";
  const user = (await admin.auth.admin.listUsers()).data.users.find((u) => u.email === email)!;
  await admin.auth.admin.updateUserById(user.id, { password: SENHA });
  await admin.from("usuarios").upsert({
    id: user.id,
    organizacao_id: orgId,
    nome: "Gestor SA (persistente)",
    email,
    papel: "gestor",
  });

  const nome1 = `Região Teste ${Date.now() % 100000}`;
  const nome2 = `${nome1} Renomeada`;

  try {
    await autenticarContextoAal2(context, email, SENHA);
    await page.goto("/regioes", { waitUntil: "networkidle" });

    await page.locator("#nova-regiao").fill(nome1);
    await page.getByRole("button", { name: /Adicionar região/i }).click();

    await expect
      .poll(async () => {
        const { count } = await admin
          .from("regioes")
          .select("id", { count: "exact", head: true })
          .eq("organizacao_id", orgId)
          .eq("nome", nome1);
        return count ?? 0;
      }, { timeout: 15_000 })
      .toBe(1);

    // aparece no seletor de região do cadastro de pessoa
    await page.goto("/pessoas", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: /Cadastrar Pessoa/i }).click();
    await expect(page.locator(`#novo-regiao option:has-text("${nome1}")`)).toHaveCount(1);

    // renomear
    await page.goto("/regioes", { waitUntil: "networkidle" });
    await page.getByRole("listitem").filter({ hasText: nome1 }).getByRole("button", { name: /Renomear/i }).click();
    await page.locator("input[name='nome']").last().fill(nome2);
    await page.getByRole("button", { name: /^Salvar$/i }).click();

    await expect
      .poll(async () => {
        const { count } = await admin
          .from("regioes")
          .select("id", { count: "exact", head: true })
          .eq("organizacao_id", orgId)
          .eq("nome", nome2);
        return count ?? 0;
      }, { timeout: 15_000 })
      .toBe(1);
  } finally {
    // admin ignora a policy (sem DELETE para o gestor, mas o teste limpa o seu).
    await admin.from("regioes").delete().eq("organizacao_id", orgId).ilike("nome", `${nome1}%`);
  }
});
