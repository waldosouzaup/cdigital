import { test, expect } from "@playwright/test";
import { admin, autenticarContexto } from "./_sessao";

/**
 * Fase 4, item 3 — gate: "OCR nunca grava sem confirmação — teste prova isso."
 *
 * Fluxo: abre o cadastro de pessoa, sobe uma foto de RG, o OCR (tesseract.js no
 * navegador) sugere nome/CPF. Prova, em dois pontos, que nada é gravado sem a
 * pessoa mandar salvar:
 *   1. depois de o OCR sugerir       -> 0 linhas em pessoas
 *   2. depois de "Usar estes dados"  -> 0 linhas (só preencheu o formulário)
 *
 * A gravação em si (o "Salvar" do cadastro) é o caminho da Fase 2, já coberto
 * por `gate-fase2-e2e-completo.test.ts` — não se repete aqui.
 *
 * Pré-requisitos: `npm run dev` + variáveis de `.env.local` no shell.
 */
const EMAIL = "e2e-ocr-coord@exemplo.invalid";
const SENHA = "SenhaDeTeste!123456";
const IMG_RG =
  "/tmp/claude-1000/-home-waldo-Projetos-ComiteDigital/8d7fdcca-e592-459b-bb50-c222d0b7f7b2/scratchpad/rg-teste.png";
const NOME_ESPERADO = "JOAQUIM ROBERTO DA SILVA TESTE";

// O gate do item 3 é sobre a confirmação, não sobre 360 px (isso é o item 1).
// Desktop evita que o botão do modal fique fora da viewport no clique.
test.use({ viewport: { width: 1280, height: 900 } });

let userId: string;
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
    .select("id")
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
  // coord_regiao: pode cadastrar pessoa e não passa pelo gate de MFA (a policy
  // restritiva mfaGatePolicy só trava gestor/coord_comite sem aal2 — a sessão de
  // senha do teste é aal1).
  await admin.from("usuarios").upsert({
    id: userId,
    organizacao_id: orgId,
    nome: "Coord E2E OCR",
    email: EMAIL,
    papel: "coord_regiao",
    regiao_id: regiao!.id,
  });

  await admin.from("pessoas").delete().ilike("nome_completo", "JOAQUIM ROBERTO DA SILVA%");
});

test.afterAll(async () => {
  const { data: p } = await admin
    .from("pessoas")
    .select("id")
    .ilike("nome_completo", "JOAQUIM ROBERTO DA SILVA%");
  for (const row of p ?? []) {
    await admin.from("log_auditoria").delete().eq("entidade_id", row.id);
    await admin.from("pessoas").delete().eq("id", row.id);
  }
  await admin.from("usuarios").delete().eq("id", userId);
  await admin.auth.admin.deleteUser(userId).catch(() => {});
});

// O OCR não é pixel-perfeito; conta por qualquer pessoa cujo nome contenha o
// núcleo esperado.
async function contarPessoas(): Promise<number> {
  const { count } = await admin
    .from("pessoas")
    .select("id", { count: "exact", head: true })
    .ilike("nome_completo", "%JOAQUIM ROBERTO DA SILVA%");
  return count ?? 0;
}

test("OCR sugere nome/CPF mas só grava depois que a pessoa manda salvar", async ({
  page,
  context,
}) => {
  test.setTimeout(150_000); // tesseract.js baixa ~5 MB de wasm+idioma na 1ª vez

  await autenticarContexto(context, EMAIL, SENHA);
  await page.goto("/pessoas", { waitUntil: "networkidle" });

  await page.getByRole("button", { name: /Cadastrar Pessoa/i }).click();
  await page.getByText(/Preencher a partir de uma foto do RG ou CNH/i).click();

  await page.setInputFiles('input[type="file"]', IMG_RG);

  // O OCR roda no navegador e mostra o bloco de sugestões.
  await expect(page.getByTestId("ocr-sugestoes")).toBeVisible({ timeout: 120_000 });

  const nomeSugerido = page.locator('[data-testid="ocr-sugestoes"] input').first();
  await expect(nomeSugerido).toHaveValue(new RegExp(NOME_ESPERADO, "i"), { timeout: 10_000 });

  // (1) OCR sugeriu — nada gravado
  expect(await contarPessoas()).toBe(0);

  // (2) "Usar estes dados" só preenche o formulário — ainda nada gravado
  await page.getByRole("button", { name: /Usar estes dados no formulário/i }).click();
  await expect(page.locator("#novo-nome")).toHaveValue(new RegExp(NOME_ESPERADO, "i"));
  await expect(page.locator("#novo-cpf")).toHaveValue(/\d{3}\.\d{3}\.\d{3}-\d{2}/);
  expect(await contarPessoas()).toBe(0);
});
