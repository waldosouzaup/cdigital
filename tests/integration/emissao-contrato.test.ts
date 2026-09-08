import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createAdminClient, createClient } from "@supabase/supabase-js";
import { generateValidCpf } from "@/lib/documentos/cpf";

/**
 * Fase 2, itens 8/10/11: emissão de contrato e "eventos_contrato em transação".
 *
 * A Server Action `emitirContrato` não dá para chamar direto do Vitest (usa
 * `cookies()` do Next.js — mesma limitação já registrada para `criarPessoa` e
 * `aprovarDocumento`). Este teste prova o que ela depende e que PODE ser
 * verificado isoladamente: que `gravar_transicao_contrato` grava o evento
 * atomicamente e que a trava otimista (`WHERE status = p_status_anterior`) recusa
 * uma segunda transição da mesma origem sem duplicar evento — e que o upload real
 * para o bucket `contratos` (policy escrita na Fase 1, nunca exercida antes) funciona
 * de fato para um usuário autenticado comum.
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

describe("Fase 2 — emissão de contrato: transição atômica + upload real", () => {
  let orgId: string;
  let regiaoId: string;
  let pessoaId: string;
  let contratoId: string;
  let userId: string;
  const email = "rls-teste-emissao@exemplo.invalid";

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
        nome_completo: "Pessoa Teste Emissão",
        cpf: generateValidCpf("22233344"),
        regiao_id: regiaoId,
        apta: true,
      })
      .select("id")
      .single();
    pessoaId = pessoa!.id;

    const { data: contrato } = await admin
      .from("contratos")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        objeto: "Teste de Emissão",
        valor: "1500.00",
        valor_extenso: "um mil e quinhentos reais",
        vigencia_inicio: "2026-09-01",
        vigencia_fim: "2026-10-03",
      })
      .select("id")
      .single();
    contratoId = contrato!.id;

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
    await admin.storage.from("contratos").remove([`${orgId}/${pessoaId}/teste-emissao.pdf`]);
    await admin.from("eventos_contrato").delete().eq("contrato_id", contratoId);
    await admin.from("contratos").delete().eq("id", contratoId);
    await admin.from("pessoas").delete().eq("id", pessoaId);
    await admin.from("usuarios").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }, 30000);

  it("transiciona rascunho -> emitido e grava exatamente um evento", async () => {
    const cliente = createAnonClient();
    await cliente.auth.signInWithPassword({ email, password: SENHA_TESTE });

    const { error } = await cliente.rpc("gravar_transicao_contrato", {
      p_contrato_id: contratoId,
      p_status_anterior: "rascunho",
      p_status_novo: "emitido",
      p_observacao: "Teste automatizado.",
    });
    expect(error).toBeNull();

    const { data: contrato } = await admin
      .from("contratos")
      .select("status, emitido_em")
      .eq("id", contratoId)
      .single();
    expect(contrato?.status).toBe("emitido");
    expect(contrato?.emitido_em).not.toBeNull();

    const { data: eventos } = await admin
      .from("eventos_contrato")
      .select("status_anterior, status_novo")
      .eq("contrato_id", contratoId);
    expect(eventos).toHaveLength(1);
    expect(eventos?.[0]).toMatchObject({ status_anterior: "rascunho", status_novo: "emitido" });
  });

  it("recusa uma segunda transição rascunho->emitido (trava otimista) sem duplicar evento", async () => {
    const cliente = createAnonClient();
    await cliente.auth.signInWithPassword({ email, password: SENHA_TESTE });

    const { error } = await cliente.rpc("gravar_transicao_contrato", {
      p_contrato_id: contratoId,
      p_status_anterior: "rascunho", // já não é mais o status atual (é "emitido")
      p_status_novo: "emitido",
      p_observacao: "Segunda tentativa — não deveria acontecer.",
    });
    expect(error).not.toBeNull();

    const { data: eventos } = await admin
      .from("eventos_contrato")
      .select("id")
      .eq("contrato_id", contratoId);
    expect(eventos).toHaveLength(1); // continua só o evento do teste anterior
  });

  it("upload real para o bucket contratos funciona para usuário autenticado (policy da Fase 1)", async () => {
    const cliente = createAnonClient();
    await cliente.auth.signInWithPassword({ email, password: SENHA_TESTE });

    const conteudo = new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])], { type: "application/pdf" });
    const { error } = await cliente.storage
      .from("contratos")
      .upload(`${orgId}/${pessoaId}/teste-emissao.pdf`, conteudo, { contentType: "application/pdf" });

    expect(error).toBeNull();
  });
});
