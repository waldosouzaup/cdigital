import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { gerarTokenColeta } from "@/lib/coleta/token";
import { generateValidCpf } from "@/lib/documentos/cpf";

/**
 * Fase 2, item 3: upload de documento pelo link público — mesma exigência do teste
 * de links_coleta: chamado pelo cliente **anon**, sem sessão, como a página real faz.
 *
 * Cobre os dois itens do gate que dependem do banco/Storage (a rejeição por
 * dimensão já é testada em unidade, contra `sharp`, sem precisar do banco):
 * - "Upload do mesmo arquivo duas vezes é recusado na segunda, apontando o existente."
 * - "Nenhum arquivo no Storage tem nome escolhido por humano" — aqui provado
 *   indiretamente: o próprio upload físico só é aceito no caminho que o RPC gerou.
 */
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

interface RegistroDocumento {
  documento_id: string;
  caminho: string | null;
  duplicado: boolean;
  existente_tipo: string | null;
  existente_criado_em: string | null;
}

describe("Fase 2 — upload de documento via link de coleta (acesso público)", () => {
  let orgId: string;
  let pessoaId: string;
  let token: string;
  let caminhoGerado: string | null = null;

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

    const { data: pessoa } = await admin
      .from("pessoas")
      .insert({
        organizacao_id: orgId,
        nome_completo: "Teste Upload Coleta",
        cpf: generateValidCpf("55566677"),
        regiao_id: regiao!.id,
      })
      .select("id")
      .single();
    pessoaId = pessoa!.id;

    token = gerarTokenColeta();
    await admin.from("links_coleta").insert({
      organizacao_id: orgId,
      pessoa_id: pessoaId,
      token,
      expira_em: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }, 30000);

  afterAll(async () => {
    if (caminhoGerado) await admin.storage.from("documentos").remove([caminhoGerado]);
    await admin.from("documentos").delete().eq("pessoa_id", pessoaId);
    await admin.from("links_coleta").delete().eq("token", token);
    if (pessoaId) await admin.from("pessoas").delete().eq("id", pessoaId);
  }, 30000);

  it("registra o documento e devolve um caminho gerado pelo sistema (org/coleta/token/...)", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .rpc("registrar_documento_coleta", {
        p_token: token,
        p_tipo: "documento_identidade",
        p_nome_original: "foto do rg.jpg",
        p_hash: "hash-de-teste-0001",
        p_largura: 1200,
        p_altura: 1600,
        p_bytes: 50000,
        p_ext: "jpg",
      })
      .maybeSingle<RegistroDocumento>();

    expect(error).toBeNull();
    expect(data?.duplicado).toBe(false);
    expect(data?.documento_id).toBeTruthy();
    expect(data?.caminho).toBe(`${orgId}/coleta/${token}/documento_identidade_${pessoaId}_v1.jpg`);
    caminhoGerado = data!.caminho;
  });

  it("o caminho gerado aceita upload de verdade pelo cliente anon (policy de Storage)", async () => {
    const anon = anonClient();
    const conteudo = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/jpeg" });
    const { error } = await anon.storage
      .from("documentos")
      .upload(caminhoGerado!, conteudo, { contentType: "image/jpeg" });

    expect(error).toBeNull();
  });

  it("um caminho fora do padrão org/coleta/token é recusado pela policy de Storage", async () => {
    const anon = anonClient();
    const conteudo = new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/jpeg" });
    const { error } = await anon.storage
      .from("documentos")
      .upload(`${orgId}/tentativa-direta.jpg`, conteudo, { contentType: "image/jpeg" });

    expect(error).not.toBeNull();
  });

  it("recusa o mesmo hash de novo, apontando o documento existente", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .rpc("registrar_documento_coleta", {
        p_token: token,
        p_tipo: "documento_identidade",
        p_nome_original: "outra foto.jpg",
        p_hash: "hash-de-teste-0001",
        p_largura: 1200,
        p_altura: 1600,
        p_bytes: 50000,
        p_ext: "jpg",
      })
      .maybeSingle<RegistroDocumento>();

    expect(error).toBeNull();
    expect(data?.duplicado).toBe(true);
    expect(data?.existente_tipo).toBe("documento_identidade");
    expect(data?.caminho).toBeNull();
  });

  it("um reenvio com hash diferente cria a versão 2, preservando a versão 1", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .rpc("registrar_documento_coleta", {
        p_token: token,
        p_tipo: "documento_identidade",
        p_nome_original: "foto nova do rg.jpg",
        p_hash: "hash-de-teste-0002",
        p_largura: 1300,
        p_altura: 1700,
        p_bytes: 60000,
        p_ext: "jpg",
      })
      .maybeSingle<RegistroDocumento>();

    expect(error).toBeNull();
    expect(data?.duplicado).toBe(false);
    expect(data?.caminho).toBe(`${orgId}/coleta/${token}/documento_identidade_${pessoaId}_v2.jpg`);

    const { data: documentos } = await admin
      .from("documentos")
      .select("versao")
      .eq("pessoa_id", pessoaId)
      .order("versao");
    expect(documentos?.map((d) => d.versao)).toEqual([1, 2]);
  });
});
