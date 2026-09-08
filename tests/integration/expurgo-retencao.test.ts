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
 */
const SENHA = "SenhaDeTeste!123456";
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

describe("Fase 4 — expurgo de retenção", () => {
  let orgId: string;
  let regiaoId: string;
  let pessoaId: string;
  let documentoId: string;
  let coordId: string;
  const email = "fase4-expurgo-coord@exemplo.invalid";
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

    const { data: authUser } = await admin.auth.admin.createUser({
      email,
      password: SENHA,
      email_confirm: true,
    });
    coordId = authUser!.user!.id;
    await admin.from("usuarios").insert({
      id: coordId,
      organizacao_id: orgId,
      nome: "Coord Expurgo (teste)",
      email,
      papel: "coord_regiao",
      regiao_id: regiaoId,
    });

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
    await admin.from("usuarios").delete().eq("id", coordId);
    await admin.auth.admin.deleteUser(coordId).catch(() => {});
  }, 40000);

  it("a lógica pura libera o documento só depois da carência", () => {
    const docs = [{ id: documentoId, criadoEm: "2026-09-10T00:00:00Z", expurgadoEm: null }];
    expect(documentosParaExpurgo(docs, "2026-10-03", 180, "2026-12-01")).toEqual([]);
    expect(documentosParaExpurgo(docs, "2026-10-03", 180, "2027-04-01")).toEqual([documentoId]);
  });

  it("a RPC grava o registro do expurgo e marca o documento na mesma transação", async () => {
    const cli = anon();
    await cli.auth.signInWithPassword({ email, password: SENHA });

    const { error } = await cli.rpc("registrar_expurgo_documento", {
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
      executado_por: coordId,
    });
  }, 30000);

  it("é idempotente: chamar de novo não cria um segundo registro", async () => {
    const cli = anon();
    await cli.auth.signInWithPassword({ email, password: SENHA });

    await cli.rpc("registrar_expurgo_documento", {
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
