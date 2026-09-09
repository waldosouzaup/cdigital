import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { gerarTokenColeta } from "@/lib/coleta/token";
import { generateValidCpf } from "@/lib/documentos/cpf";

/**
 * Feature B — autoinscrição pública (migration 0017). As RPCs
 * `dados_inscricao_publica` e `inscrever_candidato` são SECURITY DEFINER,
 * chamadas aqui pelo cliente **anon**, exatamente como a página `/inscricao/[slug]`
 * faz — sem sessão, sem JWT. O token é gerado pela aplicação (mesmo gerador da
 * coleta) e passado à RPC.
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

const SLUG_TESTE = "inscricao-teste-descartavel";

interface DadosInscricao {
  organizacao_id: string;
  organizacao_nome: string;
  regioes: { id: string; nome: string }[];
  funcoes: string[];
}
interface ResultadoInscrever {
  token: string | null;
  ja_existia: boolean;
  erro: string | null;
}

describe("Feature B — autoinscrição pública (SECURITY DEFINER, anon)", () => {
  let orgId: string;
  let slugAnterior: string | null;
  let regiaoId: string;
  let orgBId: string;
  let regiaoBId: string;
  const cpfTeste = generateValidCpf("99887766");
  const tokensCriados: string[] = [];

  beforeAll(async () => {
    const { data: org } = await admin
      .from("organizacoes")
      .select("id, slug")
      .eq("nome", "Comitê Michelle — Eleição 2026")
      .single();
    orgId = org!.id;
    slugAnterior = (org as { slug: string | null }).slug;
    await admin.from("organizacoes").update({ slug: SLUG_TESTE }).eq("id", orgId);

    const { data: regiao } = await admin
      .from("regioes")
      .select("id")
      .eq("organizacao_id", orgId)
      .limit(1)
      .single();
    regiaoId = regiao!.id;

    const { data: orgB } = await admin
      .from("organizacoes")
      .insert({ nome: "Autoinscrição Test Org B — descartável", ativa: true })
      .select("id")
      .single();
    orgBId = orgB!.id;
    const { data: regiaoB } = await admin
      .from("regioes")
      .insert({ organizacao_id: orgBId, nome: "Região B" })
      .select("id")
      .single();
    regiaoBId = regiaoB!.id;
  }, 30000);

  afterAll(async () => {
    await admin.from("links_coleta").delete().in("token", tokensCriados);
    await admin.from("pessoas").delete().eq("organizacao_id", orgId).eq("cpf", cpfTeste);
    await admin.from("organizacoes").update({ slug: slugAnterior }).eq("id", orgId);
    if (orgBId) {
      await admin.from("regioes").delete().eq("organizacao_id", orgBId);
      await admin.from("organizacoes").delete().eq("id", orgBId);
    }
  }, 30000);

  it("dados_inscricao_publica devolve organização + listas para um slug válido", async () => {
    const anon = anonClient();
    const { data, error } = await anon
      .rpc("dados_inscricao_publica", { p_slug: SLUG_TESTE })
      .maybeSingle<DadosInscricao>();

    expect(error).toBeNull();
    expect(data?.organizacao_nome).toBe("Comitê Michelle — Eleição 2026");
    expect(Array.isArray(data?.regioes)).toBe(true);
    expect((data?.regioes ?? []).length).toBeGreaterThan(0);
    expect((data?.funcoes ?? []).length).toBeGreaterThan(0);
  });

  it("dados_inscricao_publica não devolve nada para slug inexistente", async () => {
    const anon = anonClient();
    const { data } = await anon
      .rpc("dados_inscricao_publica", { p_slug: "slug-que-nunca-existiu" })
      .maybeSingle<DadosInscricao>();
    expect(data).toBeNull();
  });

  it("inscrever_candidato cria pessoa (apta=false, origem=autoinscricao) + links_coleta e o token emenda na coleta", async () => {
    const anon = anonClient();
    const token = gerarTokenColeta();
    tokensCriados.push(token);

    const { data, error } = await anon
      .rpc("inscrever_candidato", {
        p_slug: SLUG_TESTE,
        p_nome: "Candidata Autoinscrição Teste",
        p_cpf: cpfTeste,
        p_telefone: "61999990000",
        p_email: "candidata-autoinscricao@exemplo.invalid",
        p_regiao_id: regiaoId,
        p_funcao: "Militância e Mobilização de Rua",
        p_consentimento: true,
        p_token: token,
      })
      .maybeSingle<ResultadoInscrever>();

    expect(error).toBeNull();
    expect(data?.erro).toBeNull();
    expect(data?.ja_existia).toBe(false);
    expect(data?.token).toBe(token);

    const { data: pessoa } = await admin
      .from("pessoas")
      .select("apta, origem, regiao_id")
      .eq("organizacao_id", orgId)
      .eq("cpf", cpfTeste)
      .single();
    expect(pessoa?.apta).toBe(false);
    expect(pessoa?.origem).toBe("autoinscricao");
    expect(pessoa?.regiao_id).toBe(regiaoId);

    const { data: link } = await admin
      .from("links_coleta")
      .select("token")
      .eq("token", token)
      .single();
    expect(link?.token).toBe(token);

    // Prova da emenda: o token recém-criado é aceito pelo fluxo de coleta.
    const { data: validado } = await anon
      .rpc("validar_link_coleta", { p_token: token })
      .maybeSingle<{ primeiro_nome: string }>();
    expect(validado?.primeiro_nome).toBe("Candidata");
  });

  it("CPF já cadastrado: reaproveita a pessoa, gera link novo, sem revelar nada", async () => {
    const anon = anonClient();
    const token = gerarTokenColeta();
    tokensCriados.push(token);

    const { data } = await anon
      .rpc("inscrever_candidato", {
        p_slug: SLUG_TESTE,
        p_nome: "Nome Diferente Que Nao Deve Vazar",
        p_cpf: cpfTeste,
        p_telefone: "61988887777",
        p_email: "outro@exemplo.invalid",
        p_regiao_id: regiaoId,
        p_funcao: "Militância e Mobilização de Rua",
        p_consentimento: true,
        p_token: token,
      })
      .maybeSingle<ResultadoInscrever>();

    expect(data?.erro).toBeNull();
    expect(data?.ja_existia).toBe(true);
    expect(data?.token).toBe(token);
    expect(Object.keys(data ?? {})).toEqual(["token", "ja_existia", "erro"]);
  });

  it("recusa região que não pertence à organização do slug", async () => {
    const anon = anonClient();
    const token = gerarTokenColeta();
    const { data } = await anon
      .rpc("inscrever_candidato", {
        p_slug: SLUG_TESTE,
        p_nome: "Candidato Região Errada",
        p_cpf: generateValidCpf("55443322"),
        p_telefone: "61900000000",
        p_email: "regiao-errada@exemplo.invalid",
        p_regiao_id: regiaoBId,
        p_funcao: "Militância e Mobilização de Rua",
        p_consentimento: true,
        p_token: token,
      })
      .maybeSingle<ResultadoInscrever>();

    expect(data?.erro).toBe("regiao");
    expect(data?.token).toBeNull();
  });

  it("recusa quando o consentimento não foi dado", async () => {
    const anon = anonClient();
    const { data } = await anon
      .rpc("inscrever_candidato", {
        p_slug: SLUG_TESTE,
        p_nome: "Sem Consentimento",
        p_cpf: generateValidCpf("11002200"),
        p_telefone: "61900000000",
        p_email: "sem-consentimento@exemplo.invalid",
        p_regiao_id: regiaoId,
        p_funcao: "Militância e Mobilização de Rua",
        p_consentimento: false,
        p_token: gerarTokenColeta(),
      })
      .maybeSingle<ResultadoInscrever>();

    expect(data?.erro).toBe("consentimento");
    expect(data?.token).toBeNull();
  });
});
