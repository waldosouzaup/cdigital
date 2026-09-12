/**
 * Vocabulário por vertical de atuação (migration 0039).
 *
 * O sistema nasceu num comitê de campanha, mas o motor — pessoas, documentos,
 * contratos por prazo, regiões, prestação de contas — não sabe que existe
 * eleição: nenhuma tabela, coluna ou enum nomeia campanha. O que prendia o
 * produto ao domínio eleitoral era vocabulário de interface.
 *
 * Este dicionário troca só o que a pessoa lê. Nada aqui altera schema, regra de
 * negócio ou permissão, e `papel_usuario` continua com `coord_comite` e
 * `coord_regiao` no banco: migrar enum em Postgres é caro e o rótulo exibido já
 * vem daqui.
 *
 * Função pura, sem dependência de banco ou de React — serve servidor e cliente.
 */

export type Vertical = "campanha" | "evento" | "obra" | "varejo";

export interface TermosVertical {
  /** A entidade que contrata. Ex.: comitê, produção, obra, rede. */
  organizacao: string;
  /** O empreendimento com começo e fim. Ex.: campanha, evento, obra, ciclo. */
  projeto: string;
  /** O recorte territorial das equipes. */
  regiao: string;
  /** Plural de `regiao`, porque nem toda tradução pluraliza com "s". */
  regioes: string;
  /** Quem executa o trabalho em campo. */
  colaborador: string;
  colaboradores: string;
  /** Quem coordena um recorte territorial. */
  coordenador: string;
  /** O registro diário de trabalho executado. */
  atividade: string;
  /** O ato de trazer alguém para a operação. */
  contratacao: string;
}

const CAMPANHA: TermosVertical = {
  organizacao: "comitê",
  projeto: "campanha",
  regiao: "região",
  regioes: "regiões",
  colaborador: "militante",
  colaboradores: "militantes",
  coordenador: "coordenador de região",
  atividade: "atividade de rua",
  contratacao: "contratação",
};

const EVENTO: TermosVertical = {
  organizacao: "produção",
  projeto: "evento",
  regiao: "setor",
  regioes: "setores",
  colaborador: "credenciado",
  colaboradores: "credenciados",
  coordenador: "líder de setor",
  atividade: "turno de trabalho",
  contratacao: "credenciamento",
};

const OBRA: TermosVertical = {
  organizacao: "construtora",
  projeto: "obra",
  regiao: "frente de obra",
  regioes: "frentes de obra",
  colaborador: "prestador",
  colaboradores: "prestadores",
  coordenador: "encarregado",
  atividade: "diário de obra",
  contratacao: "contratação",
};

const VAREJO: TermosVertical = {
  organizacao: "rede",
  projeto: "ciclo",
  regiao: "praça",
  regioes: "praças",
  colaborador: "promotor",
  colaboradores: "promotores",
  coordenador: "supervisor de praça",
  atividade: "visita a loja",
  contratacao: "contratação",
};

const DICIONARIO: Record<Vertical, TermosVertical> = {
  campanha: CAMPANHA,
  evento: EVENTO,
  obra: OBRA,
  varejo: VAREJO,
};

/** Ordem e textos usados na tela que escolhe a vertical. */
export const VERTICAIS: ReadonlyArray<{
  id: Vertical;
  rotulo: string;
  descricao: string;
}> = [
  {
    id: "campanha",
    rotulo: "Campanha eleitoral",
    descricao: "Comitê, regiões, militância e prestação de contas eleitoral.",
  },
  {
    id: "evento",
    rotulo: "Eventos e festivais",
    descricao: "Produção, setores, credenciamento e equipes de apoio por turno.",
  },
  {
    id: "obra",
    rotulo: "Construção civil",
    descricao: "Construtora, frentes de obra, prestadores e controle documental.",
  },
  {
    id: "varejo",
    rotulo: "Trade marketing e varejo",
    descricao: "Rede, praças, promotores e registro de visita em campo.",
  },
];

export function ehVertical(valor: unknown): valor is Vertical {
  return typeof valor === "string" && valor in DICIONARIO;
}

/**
 * Vocabulário da vertical. Valor desconhecido cai em `campanha` em vez de
 * quebrar a tela: o rótulo errado é um incômodo, a tela em branco é um defeito.
 */
export function termos(vertical: unknown): TermosVertical {
  return ehVertical(vertical) ? DICIONARIO[vertical] : CAMPANHA;
}

/** Primeira letra maiúscula — os termos vivem em minúscula no dicionário. */
export function capitalizar(termo: string): string {
  return termo.charAt(0).toUpperCase() + termo.slice(1);
}
