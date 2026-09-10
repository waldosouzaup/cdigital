import { test, expect, chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { admin, autenticarContexto } from "./_sessao";
import { MODELO_REFERENCIA_MICHELLE } from "../../src/lib/contratos/modelo-referencia";
import { PDFDocument } from "pdf-lib";

test("pesquisa no painel, termo completo e assinatura com câmera sem login", async ({
  page,
  context,
}) => {
  test.setTimeout(120000);
  const sufixo = randomUUID(),
    email = `teste-contrato-${sufixo}@exemplo.invalid`,
    senha = `Teste!${sufixo}`;
  let orgId = "",
    pessoaId = "",
    contratoId = "",
    userId = "",
    templateId = "";
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    const org = await admin
      .from("organizacoes")
      .insert({ nome: `Teste contratos ${sufixo}` })
      .select("id")
      .single();
    if (org.error) throw org.error;
    orgId = org.data.id;
    const user = await admin.auth.admin.createUser({ email, password: senha, email_confirm: true });
    if (user.error) throw user.error;
    userId = user.data.user.id;
    const usuario = await admin.from("usuarios").insert({
      id: userId,
      organizacao_id: orgId,
      nome: "Gestor de teste",
      email,
      papel: "gestor",
    });
    if (usuario.error) throw usuario.error;
    const pessoa = await admin
      .from("pessoas")
      .insert({
        organizacao_id: orgId,
        nome_completo: "Colaborador de Teste",
        cpf: "52998224725",
        email: "colaborador@exemplo.invalid",
        telefone: "(61) 99999-1234",
        endereco: "Endereço de teste",
        apta: true,
        chave_pix: "pix@exemplo.invalid",
      })
      .select("id")
      .single();
    if (pessoa.error) throw pessoa.error;
    pessoaId = pessoa.data.id;
    const template = await admin
      .from("templates_contrato")
      .insert({
        organizacao_id: orgId,
        nome: "Modelo completo",
        objeto: "Administrativo e Montagem de Material",
        corpo_html: MODELO_REFERENCIA_MICHELLE,
        ativo: true,
      })
      .select("id")
      .single();
    if (template.error) throw template.error;
    templateId = template.data.id;
    const contrato = await admin
      .from("contratos")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        template_id: templateId,
        objeto: "Administrativo e Montagem de Material",
        valor: 3553,
        valor_extenso: "três mil quinhentos e cinquenta e três reais",
        vigencia_inicio: "2026-09-01",
        vigencia_fim: "2026-10-03",
        status: "emitido",
      })
      .select("id")
      .single();
    if (contrato.error) throw contrato.error;
    contratoId = contrato.data.id;
    await autenticarContexto(context, email, senha);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/contratos");
    await expect(page.getByRole("heading", { name: "Gestão de Contratos e Vigor" })).toBeVisible();
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByLabel("Pesquisar colaborador").fill("(61) 99999-1234");
    await page.getByRole("button", { name: "Pesquisar", exact: true }).click();
    await expect(page).toHaveURL(/busca=/);
    await expect(page.locator("tbody tr")).toHaveCount(1);
    await page.getByRole("button", { name: "Ver Termo", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Contrato completo", exact: true })).toBeVisible(
      { timeout: 20000 },
    );
    await expect(page.getByLabel("Texto integral do contrato")).toContainText("Cláusula 7.5");
    await page.getByRole("button", { name: "Fechar", exact: true }).last().click();
    // Copiar link deve funcionar antes e depois do envio; não envia e-mail real no teste.
    const tokenPreparado = await admin
      .from("contratos")
      .select("pdf_sha256,caminho_pdf")
      .eq("id", contratoId)
      .single();
    expect(tokenPreparado.data?.pdf_sha256).toHaveLength(64);
    await page.getByRole("button", { name: "Enviar link", exact: true }).click();
    await expect(
      page.getByLabel("Destinatário (e-mail, telefone ou nome de quem recebeu presencialmente)"),
    ).toHaveValue("colaborador@exemplo.invalid");
    // Usa o canal manual apenas no teste para não chamar o provedor de e-mail.
    await page
      .locator("select")
      .filter({ has: page.locator('option[value="presencial"]') })
      .selectOption("presencial");
    await page.getByRole("button", { name: "Confirmar Envio", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Link de assinatura", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Link de assinatura", exact: true }).click();
    await expect(page.getByLabel("Link para o colaborador")).toBeVisible();
    const link = await page.getByLabel("Link para o colaborador").inputValue();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.evaluate(() => {
      window.scrollTo(0, 0);
      document.querySelector("main")?.scrollTo(0, 0);
    });
    await page.screenshot({ path: "test-results/contratos-desktop.png", fullPage: true });
    browser = await chromium.launch({
      args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
    });
    const publico = await browser.newContext({
      viewport: { width: 390, height: 844 },
      permissions: ["camera"],
    });
    const assinatura = await publico.newPage();
    await assinatura.goto(link);
    await expect(assinatura.getByRole("heading", { name: "Olá, Colaborador" })).toBeVisible();
    await expect(assinatura.getByLabel("Texto integral do contrato")).toContainText(
      "Cláusula 7.5",
      { timeout: 15000 },
    );
    await expect(assinatura.getByRole("button", { name: "Assinar e concluir" })).toBeDisabled();
    const tela = assinatura.getByLabel("Área para desenhar sua assinatura");
    await tela.scrollIntoViewIfNeeded();
    const box = await tela.boundingBox();
    if (!box) throw new Error("Canvas não visível");
    await assinatura.mouse.move(box.x + 25, box.y + 30);
    await assinatura.mouse.down();
    for (let n = 0; n < 12; n++)
      await assinatura.mouse.move(box.x + 25 + n * 20, box.y + 40 + (n % 2) * 35, { steps: 3 });
    await assinatura.mouse.up();
    await assinatura.getByRole("button", { name: "Abrir câmera" }).click();
    await expect(assinatura.locator("video")).toBeVisible();
    await expect
      .poll(() => assinatura.locator("video").evaluate((v: HTMLVideoElement) => v.videoWidth))
      .toBeGreaterThan(0);
    await assinatura.getByRole("button", { name: "Tirar foto", exact: true }).click();
    await expect(assinatura.getByAltText("Sua foto para o registro de assinatura")).toBeVisible();
    await assinatura.getByRole("checkbox").check();
    await expect(assinatura.getByRole("button", { name: "Assinar e concluir" })).toBeEnabled();
    await assinatura.screenshot({ path: "test-results/assinatura-mobile.png", fullPage: true });
    const resposta = assinatura.waitForResponse(
      (r) => r.url().endsWith("/assinatura") && r.request().method() === "POST",
    );
    await assinatura.getByRole("button", { name: "Assinar e concluir" }).click();
    const retorno = await resposta;
    expect(await retorno.json()).toMatchObject({ ok: true });
    await expect(
      assinatura.getByRole("heading", { name: "Contrato Assinado com Sucesso", exact: true }),
    ).toBeVisible();
    const salvo = await admin
      .from("contratos")
      .select("status,caminho_pdf_assinado,assinatura_evidencias")
      .eq("id", contratoId)
      .single();
    expect(salvo.data?.status).toBe("assinado");
    expect(salvo.data?.assinatura_evidencias.foto_sha256).toHaveLength(64);
    const pdf = await publico.request.get(
      link.replace("/assinar/", "/api/contratos/publico/") + "/pdf",
    );
    expect(pdf.ok()).toBe(true);
    expect((await PDFDocument.load(await pdf.body())).getPageCount()).toBeGreaterThan(2);
    await page.reload();
    await expect(page.getByRole("button", { name: "Ver Assinado", exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await browser?.close();
    if (orgId) {
      const arquivos = await admin.storage.from("contratos").list(`${orgId}/${pessoaId}`);
      if (arquivos.data?.length)
        await admin.storage
          .from("contratos")
          .remove(arquivos.data.map((a) => `${orgId}/${pessoaId}/${a.name}`));
      await admin.from("log_auditoria").delete().eq("organizacao_id", orgId);
      if (contratoId) await admin.from("eventos_contrato").delete().eq("contrato_id", contratoId);
      await admin.from("contratos").delete().eq("organizacao_id", orgId);
      if (templateId) await admin.from("templates_contrato").delete().eq("id", templateId);
      await admin.from("pessoas").delete().eq("organizacao_id", orgId);
      await admin.from("usuarios").delete().eq("organizacao_id", orgId);
      if (userId) await admin.auth.admin.deleteUser(userId);
      await admin.from("organizacoes").delete().eq("id", orgId);
    }
  }
});
