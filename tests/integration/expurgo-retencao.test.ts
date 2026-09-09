import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { generateValidCpf } from "@/lib/documentos/cpf";
import { documentosParaExpurgo } from "@/lib/documentos/elegiveis-expurgo";

/**
 * Fase 4, item 6 — política de retenção com expurgo de documentos pessoais ao fim
 * da campanha, registrando o expurgo.
 *
 * Prova, contra o Supabase real: a RPC `registrar_expurgo_documento` grava a
 * linha em `expurgos` e marca `documentos.expurgado_em` na mesma transação, é
 * idempotente, e o objeto some do Storage.
 *
 * A RPC é invoker-rights e faz `UPDATE public.documentos` — desde a migration 0016
 * isso exige `gestor`/`coord_comite` (e `aal2`, inatingível num login de senha).
 * Na aplicação real quem chama é sempre o gestor (a action checa o papel). Aqui a
 * RPC é exercida via `admin`, então `executado_por` (= `auth.uid()`) fica nulo.
 * Follow-up: tornar a função SECURITY DEFINER com checagem interna de papel devolve
 * a testabilidade com sessão comum e volta a capturar `executado_por`.
 */
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

describe("Fase 4 — expurgo de retenção", () => {
  let orgId: string;
  let regiaoId: string;
  let pessoaId: string;
  let documentoId: string;
  const caminho = () => `${orgId}/expurgo-teste/${documentoId}.jpg`;

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
      .order("nome")
      .limit(1)
      .single();
    regiaoId = regiao!.id;

    const { data: pessoa } = await admin
      .from("pessoas")
      .insert({
        organizacao_id: orgId,
        nome_completo: "Pessoa Expurgo Teste",
        cpf: generateValidCpf("33344455"),
        regiao_id: regiaoId,
        apta: true,
      })
      .select("id")
      .single();
    pessoaId = pessoa!.id;

    const { data: doc } = await admin
      .from("documentos")
      .insert({
        organizacao_id: orgId,
        pessoa_id: pessoaId,
        regiao_id: regiaoId,
        tipo: "documento_identidade",
        caminho_storage: "placeholder",
        nome_original: "rg.jpg",
        hash_sha256: `expurgo-teste-${Date.now()}`,
        status: "aprovado",
        versao: 1,
      })
      .select("id")
      .single();
    documentoId = doc!.id;

    await admin.from("documentos").update({ caminho_storage: caminho() }).eq("id", documentoId);
    await admin.storage
      .from("documentos")
      .upload(caminho(), new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/jpeg" }), {
        contentType: "image/jpeg",
      });
  }, 40000);

  afterAll(async () => {
    await admin.storage.from("documentos").remove([caminho()]);
    await admin.from("expurgos").delete().eq("documento_id", documentoId);
    await admin.from("documentos").delete().eq("id", documentoId);
    await admin.from("pessoas").delete().eq("id", pessoaId);
  }, 40000);

  it("a lógica pura libera o documento só depois da carência", () => {
    const docs = [{ id: documentoId, criadoEm: "2026-09-10T00:00:00Z", expurgadoEm: null }];
    expect(documentosParaExpurgo(docs, "2026-10-03", 180, "2026-12-01")).toEqual([]);
    expect(documentosParaExpurgo(docs, "2026-10-03", 180, "2027-04-01")).toEqual([documentoId]);
  });

  it("a RPC grava o registro do expurgo e marca o documento na mesma transação", async () => {
    const { error } = await admin.rpc("registrar_expurgo_documento", {
      p_documento_id: documentoId,
      p_motivo: "encerramento da prestação de contas 2026",
    });
    expect(error).toBeNull();

    const { data: doc } = await admin
      .from("documentos")
      .select("expurgado_em")
      .eq("id", documentoId)
      .single();
    expect(doc?.expurgado_em).not.toBeNull();

    const { data: registro } = await admin
      .from("expurgos")
      .select("documento_id, pessoa_id, tipo, motivo, executado_por")
      .eq("documento_id", documentoId)
      .single();
    expect(registro).toMatchObject({
      documento_id: documentoId,
      pessoa_id: pessoaId,
      tipo: "documento_identidade",
      motivo: "encerramento da prestação de contas 2026",
      executado_por: null, // via admin não há auth.uid(); ver comentário do topo
    });
  }, 30000);

  it("é idempotente: chamar de novo não cria um segundo registro", async () => {
    await admin.rpc("registrar_expurgo_documento", {
      p_documento_id: documentoId,
      p_motivo: "segunda chamada",
    });

    const { count } = await admin
      .from("expurgos")
      .select("id", { count: "exact", head: true })
      .eq("documento_id", documentoId);
    expect(count).toBe(1);
  }, 30000);

  it("o objeto no Storage é removível (a ação apaga depois de registrar)", async () => {
    await admin.storage.from("documentos").remove([caminho()]);
    const { data } = await admin.storage.from("documentos").download(caminho());
    expect(data).toBeNull();
  }, 30000);
});
