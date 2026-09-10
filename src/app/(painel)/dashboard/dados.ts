/**
 * Leitura consolidada do dashboard — Fase 3. Um único carregamento (Server
 * Component, RLS do usuário) buscando tudo que a tela precisa; a agregação em si
 * (matriz, funil) é feita por funções puras e testadas
 * (`src/lib/dashboard/agregacoes.ts`), não reescrita aqui.
 */
import { createClient } from "@/lib/supabase/server";
import {
  computarFunil,
  computarMatrizObjetoStatus,
  computarResumoRegional,
  type Funil,
  type MatrizObjetoStatus,
} from "@/lib/dashboard/agregacoes";
import { calcularPendencias } from "@/lib/pessoas/pendencias";
import type { ContractStatus } from "@/lib/contratos/maquina-estados";

export interface VisaoRegional {
  regiaoId: string;
  nome: string;
  totalPessoas: number;
  pessoasAptas: number;
  pessoasComContratoAtivo: number;
  pessoasComContratoAssinado: number;
  /** % de pessoas com contrato assinado (conclusão). `null` se a região não tem
   * ninguém — ausência não é zero (Seção 11, caso Taguatinga). */
  conclusaoPct: number | null;
}

export interface PendenciaAgregada {
  codigo: string;
  descricao: string;
  severidade: "critica" | "atencao";
  quantidade: number;
}

export interface NotificacaoFalhada {
  id: string;
  tipo: string;
  destinatario: string;
  erro: string | null;
  criadoEm: string;
}

export interface PessoaResumo {
  id: string;
  nomeCompleto: string;
  cpf: string;
  funcao: string | null;
  regiaoNome: string | null;
  apta: boolean;
  statusContrato: ContractStatus | null;
  objeto: string | null;
  objetos?: string[];
  valor: string | null;
  documentoId: string | null;
  contratoId: string | null;
}

export interface DadosDashboard {
  matriz: MatrizObjetoStatus;
  funil: Funil;
  regioes: VisaoRegional[];
  pendencias: PendenciaAgregada[];
  notificacoesFalhadas: NotificacaoFalhada[];
  pessoas: PessoaResumo[];
}

interface LinhaPessoaBruta {
  id: string;
  nome_completo: string;
  cpf: string;
  funcao: string | null;
  apta: boolean;
  regiao_id: string | null;
  regioes: { nome: string } | null;
  documentos: { id: string; tipo: string; status: "pendente" | "aprovado" | "rejeitado"; versao: number }[] | null;
  contratos: { id: string; status: ContractStatus; objeto: string; valor: string; criado_em: string }[] | null;
}

export async function buscarDadosDashboard(): Promise<DadosDashboard> {
  const supabase = await createClient();

  const [{ data: pessoasBrutas, error: erroPessoas }, { data: regioesBrutas, error: erroRegioes }, { data: notificacoesBrutas, error: erroNotificacoes }] =
    await Promise.all([
      supabase
        .from("pessoas")
        .select(
          "id, nome_completo, cpf, funcao, apta, regiao_id, regioes ( nome ), " +
            "documentos ( id, tipo, status, versao ), contratos ( id, status, objeto, valor, criado_em )",
        )
        .returns<LinhaPessoaBruta[]>(),
      supabase.from("regioes").select("id, nome").order("nome"),
      supabase
        .from("notificacoes")
        .select("id, tipo, destinatario_email, erro, criado_em")
        .eq("status", "falhou")
        .order("criado_em", { ascending: false })
        .limit(50),
    ]);

  if (erroPessoas) {
    console.error("[dashboard] falha ao ler pessoas:", erroPessoas);
    throw new Error("Não foi possível carregar os dados do dashboard (pessoas).");
  }
  if (erroRegioes) {
    console.error("[dashboard] falha ao ler regiões:", erroRegioes);
    throw new Error("Não foi possível carregar os dados do dashboard (regiões).");
  }
  if (erroNotificacoes) {
    console.error("[dashboard] falha ao ler notificações:", erroNotificacoes);
    throw new Error("Não foi possível carregar os dados do dashboard (notificações).");
  }

  const pessoas: PessoaResumo[] = (pessoasBrutas ?? []).map((p) => {
    const contratoMaisRecente = [...(p.contratos ?? [])].sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
    )[0];
    const documentoMaisRecente = [...(p.documentos ?? [])].sort((a, b) => b.versao - a.versao)[0];

    const todosObjetos = Array.from(
      new Set(
        [
          ...(p.contratos ?? []).map((c) => c.objeto),
          p.funcao,
          contratoMaisRecente?.objeto,
        ].filter((o): o is string => Boolean(o && o.trim()))
      )
    );

    return {
      id: p.id,
      nomeCompleto: p.nome_completo,
      cpf: p.cpf,
      funcao: p.funcao,
      regiaoNome: p.regioes?.nome ?? null,
      apta: p.apta,
      statusContrato: contratoMaisRecente?.status ?? null,
      objeto: contratoMaisRecente?.objeto ?? p.funcao ?? null,
      objetos: todosObjetos,
      valor: contratoMaisRecente?.valor ?? null,
      documentoId: documentoMaisRecente?.id ?? null,
      contratoId: contratoMaisRecente?.id ?? null,
    };
  });

  // Matriz — usa todo contrato de toda pessoa, não só o "mais recente" (uma
  // pessoa pode ter mais de um contrato ao longo do tempo — Seção 7).
  const todosContratos = (pessoasBrutas ?? []).flatMap((p) => p.contratos ?? []);
  const matriz = computarMatrizObjetoStatus(todosContratos);

  const funil = computarFunil(pessoas.map((p) => ({ apta: p.apta, statusContrato: p.statusContrato })));

  // Visão regional — conta PESSOAS distintas (pelo contrato mais recente de cada
  // uma), não linhas de contrato. Regra pura e testada em agregacoes.ts.
  const regioes: VisaoRegional[] = (regioesBrutas ?? []).map((r) => {
    const pessoasDaRegiao = pessoas.filter((p) => p.regiaoNome === r.nome);
    const resumo = computarResumoRegional(
      pessoasDaRegiao.map((p) => ({ apta: p.apta, statusContrato: p.statusContrato })),
    );
    return { regiaoId: r.id, nome: r.nome, ...resumo };
  });

  // Central de pendências — agrega por código (mesmo código = mesma causa em
  // pessoas diferentes), ordenada por criticidade e depois por quantidade.
  const contagemPendencias = new Map<string, PendenciaAgregada>();
  for (const p of pessoasBrutas ?? []) {
    const contratoMaisRecente = [...(p.contratos ?? [])].sort(
      (a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime(),
    )[0];
    const pendenciasDaPessoa = calcularPendencias({
      documentos: p.documentos ?? [],
      apta: p.apta,
      contratoStatus: contratoMaisRecente?.status ?? null,
    });
    for (const pend of pendenciasDaPessoa) {
      const existente = contagemPendencias.get(pend.codigo);
      if (existente) existente.quantidade += 1;
      else contagemPendencias.set(pend.codigo, { ...pend, quantidade: 1 });
    }
  }
  const pendencias = [...contagemPendencias.values()].sort((a, b) => {
    if (a.severidade !== b.severidade) return a.severidade === "critica" ? -1 : 1;
    return b.quantidade - a.quantidade;
  });

  const notificacoesFalhadas: NotificacaoFalhada[] = (notificacoesBrutas ?? []).map((n) => ({
    id: n.id,
    tipo: n.tipo,
    destinatario: n.destinatario_email,
    erro: n.erro,
    criadoEm: n.criado_em,
  }));

  return { matriz, funil, regioes, pendencias, notificacoesFalhadas, pessoas };
}
