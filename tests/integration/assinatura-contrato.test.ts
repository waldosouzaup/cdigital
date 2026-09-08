import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createAdminClient, createClient } from "@supabase/supabase-js";
import { generateValidCpf } from "@/lib/documentos/cpf";

/**
 * Fase 2, item 12: "Registro de assinatura por upload do PDF assinado ou marcação
 * de assinatura presencial." A marcação sem arquivo já é coberta indiretamente por
 * `emissao-contrato.test.ts` (mesma RPC de transição). Este teste cobre o caminho
 * de upload: o Route Handler (`/api/contratos/[id]/assinatura`) não dá para chamar
 * direto do Vitest (usa `cookies()`), então o teste replica exatamente a mesma
 * sequência que ele executa — upload real no bucket `contratos` com o sufixo
 * `_assinado.pdf`, gravação de `caminho_pdf_assinado`, e a transição
 * `enviado -> assinado` pela mesma RPC.
 */
const SENHA_TESTE = "SenhaDeTeste!123456";

const admin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

describe("Fase 2 — assinatura de contrato via upload do PDF assinado", () => {
  let orgId: string;
  let regiaoId: string;
  let pessoaId: string;
  let contratoId: string;
  let userId: string;
  let caminhoAssinado: string;
  const email = "rls-teste-assinatura@exemplo.invalid";

  beforeAll(async () => {
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

    const { data: pessoa } = await admin
      .from("pessoas")
      .insert({
        organizacao_id: orgId,
        nome_completo: "Pessoa Teste Assinatura",
        cpf: generateValidCpf("33344455"),
        regiao_id: regiaoId,
        apta: true,
      })
      .select("id")
      .single();
    pessoaId = pessoa!.id;

    // Já nasce "enviado" — é o pré-requisito da transição que este teste cobre.
    const { data: contrato } = await admin
      .from("contratos")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        objeto: "Teste de Assinatura",
        valor: "1500.00",
        valor_extenso: "um mil e quinhentos reais",
        vigencia_inicio: "2026-09-01",
        vigencia_fim: "2026-10-03",
        status: "enviado",
      })
      .select("id")
      .single();
    contratoId = contrato!.id;
    caminhoAssinado = `${orgId}/${pessoaId}/contrato_${contratoId}_assinado.pdf`;

    const { data: authUser } = await admin.auth.admin.createUser({
      email,
      password: SENHA_TESTE,
      email_confirm: true,
    });
    userId = authUser!.user!.id;
    await admin
      .from("usuarios")
      .insert({ id: userId, organizacao_id: orgId, nome: "Auditor Teste", email, papel: "auditor" });
  }, 30000);

  afterAll(async () => {
    await admin.storage.from("contratos").remove([caminhoAssinado]);
    await admin.from("eventos_contrato").delete().eq("contrato_id", contratoId);
    await admin.from("contratos").delete().eq("id", contratoId);
    await admin.from("pessoas").delete().eq("id", pessoaId);
    await admin.from("usuarios").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }, 30000);

  it("faz upload do PDF assinado, grava o caminho e transiciona enviado -> assinado", async () => {
    const cliente = createAnonClient();
    await cliente.auth.signInWithPassword({ email, password: SENHA_TESTE });

    const conteudo = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" });
    const { error: erroUpload } = await cliente.storage
      .from("contratos")
      .upload(caminhoAssinado, conteudo, { contentType: "application/pdf", upsert: true });
    expect(erroUpload).toBeNull();

    const { error: erroUpdate } = await cliente
      .from("contratos")
      .update({ caminho_pdf_assinado: caminhoAssinado })
      .eq("id", contratoId);
    expect(erroUpdate).toBeNull();

    const { error: erroTransicao } = await cliente.rpc("gravar_transicao_contrato", {
      p_contrato_id: contratoId,
      p_status_anterior: "enviado",
      p_status_novo: "assinado",
      p_observacao: "Assinatura registrada via upload do PDF assinado (teste).",
    });
    expect(erroTransicao).toBeNull();

    const { data: contrato } = await admin
      .from("contratos")
      .select("status, caminho_pdf_assinado, assinado_em")
      .eq("id", contratoId)
      .single();
    expect(contrato?.status).toBe("assinado");
    expect(contrato?.caminho_pdf_assinado).toBe(caminhoAssinado);
    expect(contrato?.assinado_em).not.toBeNull();
  });

  it("o coordenador consegue gerar uma URL assinada para baixar o PDF anexado", async () => {
    const cliente = createAnonClient();
    await cliente.auth.signInWithPassword({ email, password: SENHA_TESTE });

    const { data, error } = await cliente.storage
      .from("contratos")
      .createSignedUrl(caminhoAssinado, 900);

    expect(error).toBeNull();
    expect(data?.signedUrl).toBeTruthy();
  });
});
