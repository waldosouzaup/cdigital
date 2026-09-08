import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient as createAdminClient, createClient } from "@supabase/supabase-js";
import { generateValidCpf } from "@/lib/documentos/cpf";
import { pessoaEstaApta } from "@/lib/pessoas/aptidao";

/**
 * Fase 2, item 6: "Documentação completa e aprovada marca a pessoa como apta."
 *
 * A Server Action (`(painel)/documentos/acoes.ts`) não dá para chamar direto do
 * Vitest — usa `cookies()` do Next.js, que só existe dentro de uma requisição real
 * (mesma limitação já registrada para `criarPessoa`, Fase 2 item 1). Este teste prova
 * a parte que a Server Action depende e que PODE ser verificada isoladamente: que a
 * policy de RLS de `documentos` (Fase 1, `organizationAndRegionPolicy`, `for: "all"`)
 * realmente permite `UPDATE` por um usuário autenticado comum — não só `SELECT`/
 * `INSERT` como os testes anteriores já cobriam — e que a regra pura
 * (`pessoaEstaApta`) bate com o que a Server Action faria com esse dado real.
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

describe("Fase 2 — mesa de triagem: aprovação de documento marca pessoa apta", () => {
  let orgId: string;
  let regiaoId: string;
  let pessoaId: string;
  let documentoId: string;
  let userId: string;
  const email = "rls-teste-triagem@exemplo.invalid";

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
        nome_completo: "Pessoa Teste Triagem",
        cpf: generateValidCpf("77788899"),
        regiao_id: regiaoId,
        apta: false,
      })
      .select("id")
      .single();
    pessoaId = pessoa!.id;

    const { data: documento } = await admin
      .from("documentos")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        tipo: "documento_identidade",
        caminho_storage: `${orgId}/teste/documento_identidade_${pessoaId}_v1.jpg`,
        nome_original: "teste.jpg",
        hash_sha256: "hash-teste-triagem-0001",
        largura_px: 1200,
        altura_px: 1600,
        bytes: 50000,
        versao: 1,
        status: "pendente",
      })
      .select("id")
      .single();
    documentoId = documento!.id;

    // "auditor" de propósito — sem restrição de MFA/região (mesma justificativa do
    // rls-isolamento.test.ts), porque o que este teste isola é a permissão de UPDATE
    // em `documentos`, não a política de MFA nem a de região.
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
    await admin.from("documentos").delete().eq("id", documentoId);
    await admin.from("pessoas").delete().eq("id", pessoaId);
    await admin.from("usuarios").delete().eq("id", userId);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }, 30000);

  it("usuário autenticado consegue aprovar o documento (RLS permite UPDATE, não só SELECT/INSERT)", async () => {
    const cliente = createAnonClient();
    const { error: erroLogin } = await cliente.auth.signInWithPassword({ email, password: SENHA_TESTE });
    expect(erroLogin).toBeNull();

    const { data, error } = await cliente
      .from("documentos")
      .update({ status: "aprovado", motivo_rejeicao: null })
      .eq("id", documentoId)
      .select("id, status")
      .single();

    expect(error).toBeNull();
    expect(data?.status).toBe("aprovado");
  });

  it("pessoaEstaApta, aplicada ao dado real pós-aprovação, decide apta", async () => {
    const { data: documentos } = await admin
      .from("documentos")
      .select("tipo, status, versao")
      .eq("pessoa_id", pessoaId);

    expect(pessoaEstaApta(documentos ?? [])).toBe(true);
  });

  it("usuário autenticado consegue marcar a pessoa como apta (RLS de pessoas também permite UPDATE)", async () => {
    const cliente = createAnonClient();
    await cliente.auth.signInWithPassword({ email, password: SENHA_TESTE });

    const { data, error } = await cliente
      .from("pessoas")
      .update({ apta: true })
      .eq("id", pessoaId)
      .select("id, apta")
      .single();

    expect(error).toBeNull();
    expect(data?.apta).toBe(true);
  });

  it("rejeitar o mesmo documento depois reverte pessoaEstaApta para false", async () => {
    const cliente = createAnonClient();
    await cliente.auth.signInWithPassword({ email, password: SENHA_TESTE });

    await cliente
      .from("documentos")
      .update({ status: "rejeitado", motivo_rejeicao: "Teste de revogação de aptidão" })
      .eq("id", documentoId);

    const { data: documentos } = await admin
      .from("documentos")
      .select("tipo, status, versao")
      .eq("pessoa_id", pessoaId);

    expect(pessoaEstaApta(documentos ?? [])).toBe(false);
  });
});
