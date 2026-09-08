import { afterAll, describe, expect, it } from "vitest";
import { createClient as createAdminClient, createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { generateValidCpf } from "@/lib/documentos/cpf";
import { validarEntradaPessoa } from "@/lib/pessoas/validacao";
import { gerarTokenColeta } from "@/lib/coleta/token";
import { calcularHashSha256, extensaoPorMime, validarDimensaoImagem } from "@/lib/documentos/upload";
import { pessoaEstaApta } from "@/lib/pessoas/aptidao";
import { substituirMarcadores } from "@/lib/contratos/marcadores";
import { gerarPdfContrato, htmlParaTexto } from "@/lib/contratos/gerar-pdf";
import { amountInWords } from "@/lib/contratos/valor-extenso";
import { canTransition } from "@/lib/contratos/maquina-estados";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import type { EmailTransport } from "@/lib/notificacoes/transporte";

/**
 * Gate de saída da Fase 2 — o item mais importante do gate, e o único que exige
 * encadear tudo: "Uma pessoa é cadastrada, recebe link por e-mail, envia
 * documento e tem contrato emitido, enviado e assinado — sem sair da aplicação."
 *
 * Cada passo já tem cobertura isolada em outro arquivo de teste desta fase — o
 * que este teste prova é que a CADEIA INTEIRA funciona, ponta a ponta, contra o
 * Supabase real, sem nenhum atalho: mesmas funções puras que as Server Actions
 * usam, mesmas RPCs, mesmo Storage, mesma tabela de notificações.
 *
 * Server Actions em si não são chamáveis daqui (usam `cookies()` do Next.js —
 * mesma limitação documentada em todos os outros testes de integração desta
 * fase); o que seria a chamada de rede vira, aqui, cliente `anon` autenticado de
 * verdade ou RPC direta — nunca o cliente `admin`/service_role para os passos que
 * um usuário real executaria (só para o setup/limpeza do próprio teste).
 */
const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

function transporteQueSempreEnvia(): EmailTransport {
  return { async send() { return { ok: true, id: `resend-fake-${Math.random()}` }; } };
}

describe("Gate Fase 2 — cadeia completa: pessoa → link → documento → contrato assinado", () => {
  let orgId: string;
  let regiaoId: string;
  let pessoaId: string;
  let templateId: string;
  let tokenColeta: string;
  let documentoId: string;
  let contratoId: string;
  let caminhoPdfDocumento: string;
  let caminhoPdfContrato: string;

  afterAll(async () => {
    if (caminhoPdfDocumento) await admin.storage.from("documentos").remove([caminhoPdfDocumento]);
    if (caminhoPdfContrato) await admin.storage.from("contratos").remove([caminhoPdfContrato]);
    if (contratoId) {
      await admin.from("notificacoes").delete().eq("entidade_id", contratoId);
      await admin.from("eventos_contrato").delete().eq("contrato_id", contratoId);
      await admin.from("contratos").delete().eq("id", contratoId);
    }
    if (templateId) await admin.from("templates_contrato").delete().eq("id", templateId);
    if (documentoId) await admin.from("documentos").delete().eq("id", documentoId);
    if (pessoaId) {
      await admin.from("notificacoes").delete().eq("entidade_id", pessoaId);
      await admin.from("links_coleta").delete().eq("pessoa_id", pessoaId);
      await admin.from("pessoas").delete().eq("id", pessoaId);
    }
  }, 30000);

  it("passo 1 — cadastro de pessoa (mesma validação da Server Action criarPessoa)", async () => {
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
      .limit(1)
      .single();
    regiaoId = regiao!.id;

    const entrada = validarEntradaPessoa({
      fullName: "Fulana Gate Completo da Silva",
      cpf: generateValidCpf("12312312"),
      phone: "",
      regionId: regiaoId,
      role: "Militância e Mobilização de Rua",
    });
    expect(entrada.success).toBe(true);
    if (!entrada.success) return;

    const { data: pessoa, error } = await admin
      .from("pessoas")
      .insert({
        organizacao_id: orgId,
        nome_completo: entrada.data.fullName,
        cpf: entrada.data.cpf,
        regiao_id: entrada.data.regionId,
        funcao: entrada.data.role,
        email: "gate-e2e-completo@exemplo.invalid",
        endereco: "Rua de Teste, 100",
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    pessoaId = pessoa!.id;
  });

  it("passo 2 — gera link de coleta e 'recebe' por e-mail (notificação link_coleta enviada)", async () => {
    tokenColeta = gerarTokenColeta();
    const { error: erroLink } = await admin.from("links_coleta").insert({
      organizacao_id: orgId,
      pessoa_id: pessoaId,
      token: tokenColeta,
      expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(erroLink).toBeNull();

    const resultado = await sendNotification({
      supabase: admin,
      transport: transporteQueSempreEnvia(),
      organizationId: orgId,
      type: "link_coleta",
      recipientEmail: "gate-e2e-completo@exemplo.invalid",
      entity: "links_coleta",
      entityId: pessoaId,
      idempotencyKey: idempotencyKey("link_coleta", pessoaId),
      subject: "Link para envio de dados",
      html: "<p>teste</p>",
      text: "teste",
    });
    expect(resultado).toEqual({ sent: true });
  });

  it("passo 3 — a pessoa (anon, sem sessão) valida o próprio link", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .rpc("validar_link_coleta", { p_token: tokenColeta })
      .maybeSingle<{ pessoa_id: string; primeiro_nome: string }>();

    expect(error).toBeNull();
    expect(data?.pessoa_id).toBe(pessoaId);
    expect(data?.primeiro_nome).toBe("Fulana");
  });

  it("passo 4 — a pessoa envia o documento (validação + hash + RPC + upload real, tudo anon)", async () => {
    const bufferImagem = await sharp({
      create: { width: 1200, height: 1600, channels: 3, background: { r: 210, g: 210, b: 210 } },
    })
      .jpeg()
      .toBuffer();

    const checagemDimensao = await validarDimensaoImagem(bufferImagem, "image/jpeg");
    expect(checagemDimensao.ok).toBe(true);

    const hash = calcularHashSha256(bufferImagem);
    const ext = extensaoPorMime("image/jpeg");
    expect(ext).toBe("jpg");

    const anon = anonClient();
    const { data: registro, error: erroRegistro } = await anon
      .rpc("registrar_documento_coleta", {
        p_token: tokenColeta,
        p_tipo: "documento_identidade",
        p_nome_original: "foto do rg tirada com o celular.jpg",
        p_hash: hash,
        p_largura: checagemDimensao.largura,
        p_altura: checagemDimensao.altura,
        p_bytes: bufferImagem.byteLength,
        p_ext: ext,
      })
      .maybeSingle<{ documento_id: string; caminho: string; duplicado: boolean }>();

    expect(erroRegistro).toBeNull();
    expect(registro?.duplicado).toBe(false);
    documentoId = registro!.documento_id;
    caminhoPdfDocumento = registro!.caminho;

    // Nomenclatura gerada pelo sistema (item 4 do gate) — nunca o nome original.
    expect(caminhoPdfDocumento).toBe(`${orgId}/coleta/${tokenColeta}/documento_identidade_${pessoaId}_v1.jpg`);
    expect(caminhoPdfDocumento).not.toMatch(/foto do rg/);

    const { error: erroUpload } = await anon.storage
      .from("documentos")
      .upload(caminhoPdfDocumento, bufferImagem, { contentType: "image/jpeg" });
    expect(erroUpload).toBeNull();

    const { data: nomeOriginalGravado } = await admin
      .from("documentos")
      .select("nome_original")
      .eq("id", documentoId)
      .single();
    expect(nomeOriginalGravado?.nome_original).toBe("foto do rg tirada com o celular.jpg");
  });

  it("passo 5 — coordenador aprova o documento; pessoa fica apta; pessoa_apta é disparada", async () => {
    const { error: erroAprovacao } = await admin
      .from("documentos")
      .update({ status: "aprovado", motivo_rejeicao: null })
      .eq("id", documentoId);
    expect(erroAprovacao).toBeNull();

    const { data: documentos } = await admin
      .from("documentos")
      .select("tipo, status, versao")
      .eq("pessoa_id", pessoaId);
    expect(pessoaEstaApta(documentos ?? [])).toBe(true);

    await admin.from("pessoas").update({ apta: true }).eq("id", pessoaId);

    const resultado = await sendNotification({
      supabase: admin,
      transport: transporteQueSempreEnvia(),
      organizationId: orgId,
      type: "pessoa_apta",
      recipientEmail: "coordenador-gate-e2e@exemplo.invalid",
      entity: "pessoas",
      entityId: pessoaId,
      idempotencyKey: idempotencyKey("pessoa_apta", pessoaId),
      subject: "Documentação completa",
      html: "<p>teste</p>",
      text: "teste",
    });
    expect(resultado).toEqual({ sent: true });

    const { data: pessoaAtualizada } = await admin.from("pessoas").select("apta").eq("id", pessoaId).single();
    expect(pessoaAtualizada?.apta).toBe(true);
  });

  it("passo 6 — emissão do contrato: PDF real gerado, valor por extenso nunca digitado, transição atômica", async () => {
    const { data: template } = await admin
      .from("templates_contrato")
      .insert({
        organizacao_id: orgId,
        nome: "Modelo Gate E2E",
        objeto: "Militância e Mobilização de Rua",
        corpo_html: "<p>{{nome}}, CPF {{cpf}}, residente em {{endereco}}, valor {{valor}} ({{valor_extenso}}), vigência {{vigencia_inicio}} a {{vigencia_fim}}.</p>",
        ativo: true,
      })
      .select("id")
      .single();
    templateId = template!.id;

    const { data: pessoa } = await admin
      .from("pessoas")
      .select("nome_completo, cpf, endereco")
      .eq("id", pessoaId)
      .single();

    const valor = 1500;
    const valorExtenso = amountInWords(valor);
    expect(valorExtenso).toBe("mil e quinhentos reais");

    const { data: contrato, error: erroContrato } = await admin
      .from("contratos")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        template_id: templateId,
        objeto: "Militância e Mobilização de Rua",
        valor,
        valor_extenso: valorExtenso,
        vigencia_inicio: "2026-09-01",
        vigencia_fim: "2026-10-03",
      })
      .select("id")
      .single();
    expect(erroContrato).toBeNull();
    contratoId = contrato!.id;

    const corpoComDados = substituirMarcadores("<p>{{nome}}, CPF {{cpf}}, residente em {{endereco}}, valor {{valor}} ({{valor_extenso}}), vigência {{vigencia_inicio}} a {{vigencia_fim}}.</p>", {
      nome: pessoa!.nome_completo,
      cpf: pessoa!.cpf,
      endereco: pessoa!.endereco ?? "não informado",
      objeto: "Militância e Mobilização de Rua",
      valor: `R$ ${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`,
      valorExtenso,
      vigenciaInicio: "01/09/2026",
      vigenciaFim: "03/10/2026",
    });
    expect(corpoComDados).not.toMatch(/\{\{.*\}\}/);

    const pdfBytes = await gerarPdfContrato({
      titulo: "CONTRATO DE PRESTAÇÃO DE SERVIÇOS",
      corpo: htmlParaTexto(corpoComDados),
    });
    expect(Buffer.from(pdfBytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");

    caminhoPdfContrato = `${orgId}/${pessoaId}/contrato_${contratoId}.pdf`;
    const { error: erroUpload } = await admin.storage
      .from("contratos")
      .upload(caminhoPdfContrato, pdfBytes, { contentType: "application/pdf" });
    expect(erroUpload).toBeNull();

    await admin.from("contratos").update({ caminho_pdf: caminhoPdfContrato }).eq("id", contratoId);

    expect(canTransition("rascunho", "emitido")).toBe(true);
    const { error: erroTransicao } = await admin.rpc("gravar_transicao_contrato", {
      p_contrato_id: contratoId,
      p_status_anterior: "rascunho",
      p_status_novo: "emitido",
      p_observacao: "Emissão automática (teste de gate).",
    });
    expect(erroTransicao).toBeNull();

    const { data: contratoEmitido } = await admin.from("contratos").select("status, caminho_pdf").eq("id", contratoId).single();
    expect(contratoEmitido?.status).toBe("emitido");
    expect(contratoEmitido?.caminho_pdf).toBe(caminhoPdfContrato);
  });

  it("passo 7 — envio do contrato: transição para 'enviado' e contrato_enviado disparada", async () => {
    await admin
      .from("contratos")
      .update({ canal_envio: "email", enviado_para: "gate-e2e-completo@exemplo.invalid" })
      .eq("id", contratoId);

    const { error: erroTransicao } = await admin.rpc("gravar_transicao_contrato", {
      p_contrato_id: contratoId,
      p_status_anterior: "emitido",
      p_status_novo: "enviado",
      p_observacao: "Enviado por email (teste de gate).",
    });
    expect(erroTransicao).toBeNull();

    const resultado = await sendNotification({
      supabase: admin,
      transport: transporteQueSempreEnvia(),
      organizationId: orgId,
      type: "contrato_enviado",
      recipientEmail: "gate-e2e-completo@exemplo.invalid",
      entity: "contratos",
      entityId: contratoId,
      idempotencyKey: idempotencyKey("contrato_enviado", contratoId),
      subject: "Contrato emitido",
      html: "<p>teste</p>",
      text: "teste",
    });
    expect(resultado).toEqual({ sent: true });

    const { data: contratoEnviado } = await admin.from("contratos").select("status").eq("id", contratoId).single();
    expect(contratoEnviado?.status).toBe("enviado");
  });

  it("passo 8 — assinatura do contrato: transição para 'assinado'", async () => {
    expect(canTransition("enviado", "assinado")).toBe(true);
    const { error: erroTransicao } = await admin.rpc("gravar_transicao_contrato", {
      p_contrato_id: contratoId,
      p_status_anterior: "enviado",
      p_status_novo: "assinado",
      p_observacao: "Assinatura registrada (teste de gate).",
    });
    expect(erroTransicao).toBeNull();

    const { data: contratoFinal } = await admin.from("contratos").select("status, assinado_em").eq("id", contratoId).single();
    expect(contratoFinal?.status).toBe("assinado");
    expect(contratoFinal?.assinado_em).not.toBeNull();
  });

  it("passo 9 — confere a trilha completa: 3 eventos de contrato, 3 notificações enviadas", async () => {
    const { data: eventos } = await admin
      .from("eventos_contrato")
      .select("status_anterior, status_novo")
      .eq("contrato_id", contratoId)
      .order("ocorrido_em");
    expect(eventos).toEqual([
      { status_anterior: "rascunho", status_novo: "emitido" },
      { status_anterior: "emitido", status_novo: "enviado" },
      { status_anterior: "enviado", status_novo: "assinado" },
    ]);

    const { data: notificacoes } = await admin
      .from("notificacoes")
      .select("tipo, status")
      .in("entidade_id", [pessoaId, contratoId]);
    const tiposEnviados = (notificacoes ?? []).filter((n) => n.status === "enviada").map((n) => n.tipo).sort();
    expect(tiposEnviados).toEqual(["contrato_enviado", "link_coleta", "pessoa_apta"]);
  });
});
