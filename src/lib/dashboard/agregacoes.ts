/**
 * Agregações do dashboard — Fase 3, item 1 (matriz objeto × status) e a parte de
 * contagem do funil (item 5). Funções puras: recebem linhas já buscadas do banco
 * e só somam — a mesma lógica usada para montar a tela é a que o gate compara
 * contra "SELECT direto no banco".
 */
import { ACTIVE_BOARD_STATUSES, type ContractStatus } from "@/lib/contratos/maquina-estados";

export interface ContratoParaMatriz {
  objeto: string;
  status: ContractStatus;
  valor: string | number;
}

export interface LinhaMatriz {
  objeto: string;
  porStatus: Partial<Record<ContractStatus, number>>;
  total: number;
  valorTotal: number;
}

export interface MatrizObjetoStatus {
  linhas: LinhaMatriz[];
  totalGeral: number;
  totalPorStatus: Partial<Record<ContractStatus, number>>;
  valorTotalGeral: number;
}

// "Quadro ativo" (Seção 7) — os únicos status que entram na matriz operacional.
// rascunho é transitório (emissão já transiciona pra emitido na mesma operação),
// e distrato/cancelado têm visão própria, nunca entram no total ativo.
const STATUS_DA_MATRIZ = new Set<ContractStatus>(ACTIVE_BOARD_STATUSES);

export function computarMatrizObjetoStatus(contratos: ContratoParaMatriz[]): MatrizObjetoStatus {
  const porObjeto = new Map<string, LinhaMatriz>();
  const totalPorStatus: Partial<Record<ContractStatus, number>> = {};
  let totalGeral = 0;
  let valorTotalGeral = 0;

  for (const contrato of contratos) {
    if (!STATUS_DA_MATRIZ.has(contrato.status)) continue;

    const valor = Number(contrato.valor);

    let linha = porObjeto.get(contrato.objeto);
    if (!linha) {
      linha = { objeto: contrato.objeto, porStatus: {}, total: 0, valorTotal: 0 };
      porObjeto.set(contrato.objeto, linha);
    }

    linha.porStatus[contrato.status] = (linha.porStatus[contrato.status] ?? 0) + 1;
    linha.total += 1;
    linha.valorTotal += valor;

    totalPorStatus[contrato.status] = (totalPorStatus[contrato.status] ?? 0) + 1;
    totalGeral += 1;
    valorTotalGeral += valor;
  }

  return {
    linhas: [...porObjeto.values()].sort((a, b) => a.objeto.localeCompare(b.objeto, "pt-BR")),
    totalGeral,
    totalPorStatus,
    valorTotalGeral,
  };
}

// ---------------------------------------------------------------------------
// Funil — Fase 3, item 5: cadastrado → apto → emitido → enviado → assinado.
// ---------------------------------------------------------------------------

export interface PessoaParaFunil {
  apta: boolean;
  statusContrato: ContractStatus | null;
}

export interface Funil {
  cadastrado: number;
  apto: number;
  emitido: number;
  enviado: number;
  assinado: number;
}

// Posição no caminho principal (Seção 7: rascunho→emitido→enviado→assinado); um
// contrato distratado ou com distrato assinado necessariamente passou por
// "assinado" antes (a cadeia nunca pula esse passo), então conta como tendo
// alcançado o estágio. `cancelado` pode ter saído de qualquer ponto anterior —
// sem o histórico de eventos não dá pra saber de qual, então conservadoramente
// não soma a nenhum estágio além de "apto" (evita inflar o funil).
const POSICAO_NO_CAMINHO: Partial<Record<ContractStatus, number>> = {
  rascunho: 0,
  emitido: 1,
  enviado: 2,
  assinado: 3,
  distratado: 3,
  distrato_assinado: 3,
};

/** Exportada para o drill-down do dashboard reaproveitar exatamente o mesmo
 * critério usado para contar o funil, em vez de duplicar a regra na tela. */
export function posicaoAlcancada(status: ContractStatus | null): number {
  if (!status) return -1;
  return POSICAO_NO_CAMINHO[status] ?? -1;
}

export function computarFunil(pessoas: PessoaParaFunil[]): Funil {
  return {
    cadastrado: pessoas.length,
    apto: pessoas.filter((p) => p.apta).length,
    emitido: pessoas.filter((p) => posicaoAlcancada(p.statusContrato) >= 1).length,
    enviado: pessoas.filter((p) => posicaoAlcancada(p.statusContrato) >= 2).length,
    assinado: pessoas.filter((p) => posicaoAlcancada(p.statusContrato) >= 3).length,
  };
}

// ---------------------------------------------------------------------------
// Resumo por região — o card "Cobertura por Região" do dashboard. Conta PESSOAS
// distintas (não linhas de contrato: uma pessoa recontratada após distrato tem
// mais de um contrato). `statusContrato` é o do contrato MAIS RECENTE da pessoa.
// ---------------------------------------------------------------------------

const STATUS_CONTRATO_ATIVO = new Set<ContractStatus>(ACTIVE_BOARD_STATUSES);

export interface PessoaParaRegiao {
  apta: boolean;
  statusContrato: ContractStatus | null;
}

export interface ResumoRegional {
  totalPessoas: number;
  pessoasAptas: number;
  pessoasComContratoAtivo: number;
  pessoasComContratoAssinado: number;
  /** % de pessoas com contrato assinado. `null` (não 0) quando a região não tem
   * ninguém — ausência não é zero (mesmo cuidado da Seção 11 com Taguatinga). */
  conclusaoPct: number | null;
}

export function computarResumoRegional(pessoas: PessoaParaRegiao[]): ResumoRegional {
  const total = pessoas.length;
  const assinadas = pessoas.filter((p) => p.statusContrato === "assinado").length;

  return {
    totalPessoas: total,
    pessoasAptas: pessoas.filter((p) => p.apta).length,
    pessoasComContratoAtivo: pessoas.filter(
      (p) => p.statusContrato !== null && STATUS_CONTRATO_ATIVO.has(p.statusContrato),
    ).length,
    pessoasComContratoAssinado: assinadas,
    conclusaoPct: total === 0 ? null : Math.round((assinadas / total) * 100),
  };
}
