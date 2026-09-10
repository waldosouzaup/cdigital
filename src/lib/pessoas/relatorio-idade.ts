/**
 * Agregação e estatísticas demográficas de colaboradores — Média de Idade por
 * Função e Região. Função pura e desacoplada, permitindo testes unitários
 * completos e reutilização em visualizações analíticas.
 */

export interface ItemPessoaIdade {
  id?: string;
  nomeCompleto?: string;
  funcao: string | null;
  regiaoNome: string | null;
  dataNascimento?: string | null;
  idade?: number | null;
}

export interface FaixaEtariaContagem {
  ate25: number;
  de26a40: number;
  de41a55: number;
  acima55: number;
}

export interface LinhaRelatorioIdade {
  funcao: string;
  regiaoNome: string;
  totalTrabalhadores: number;
  totalComIdade: number;
  mediaIdade: number | null;
  idadeMinima: number | null;
  idadeMaxima: number | null;
  faixas: FaixaEtariaContagem;
}

export interface ResumoRelatorioIdade {
  linhas: LinhaRelatorioIdade[];
  totalGeralTrabalhadores: number;
  totalGeralComIdade: number;
  mediaGeralIdade: number | null;
  idadeMinimaGeral: number | null;
  idadeMaximaGeral: number | null;
  faixasGerais: FaixaEtariaContagem;
  funcoesDisponiveis: string[];
  regioesDisponiveis: string[];
}

/**
 * Calcula a idade em anos completos a partir de uma data de nascimento.
 * Trata formatos "YYYY-MM-DD" e ISO timestamps sem desvios de fuso horário.
 */
export function calcularIdade(dataNascimento: string | null | undefined): number | null {
  if (!dataNascimento) return null;
  const texto = dataNascimento.trim();
  if (!texto) return null;

  // Trata formato YYYY-MM-DD
  const partes = texto.split("T")[0].split("-");
  if (partes.length === 3) {
    const ano = parseInt(partes[0], 10);
    const mes = parseInt(partes[1], 10) - 1;
    const dia = parseInt(partes[2], 10);
    if (!isNaN(ano) && !isNaN(mes) && !isNaN(dia)) {
      const hoje = new Date();
      let idade = hoje.getFullYear() - ano;
      const m = hoje.getMonth() - mes;
      if (m < 0 || (m === 0 && hoje.getDate() < dia)) {
        idade--;
      }
      return idade >= 0 && idade <= 120 ? idade : null;
    }
  }

  const d = new Date(texto);
  if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) {
    idade--;
  }
  return idade >= 0 && idade <= 120 ? idade : null;
}

function inicializarFaixas(): FaixaEtariaContagem {
  return { ate25: 0, de26a40: 0, de41a55: 0, acima55: 0 };
}

function contabilizarFaixa(faixas: FaixaEtariaContagem, idade: number) {
  if (idade <= 25) {
    faixas.ate25++;
  } else if (idade <= 40) {
    faixas.de26a40++;
  } else if (idade <= 55) {
    faixas.de41a55++;
  } else {
    faixas.acima55++;
  }
}

/**
 * Computa o relatório agrupado da média de idade por Função e Região.
 */
export function computarRelatorioIdade(
  pessoas: ItemPessoaIdade[],
  filtros?: {
    funcao?: string;
    regiao?: string;
  },
): ResumoRelatorioIdade {
  // Extrai lista única de funções e regiões existentes em todo o conjunto
  const todasFuncoes = Array.from(
    new Set(pessoas.map((p) => p.funcao?.trim()).filter((f): f is string => Boolean(f))),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const todasRegioes = Array.from(
    new Set(pessoas.map((p) => p.regiaoNome?.trim()).filter((r): r is string => Boolean(r))),
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const filtroFuncao = filtros?.funcao && filtros.funcao !== "todas" ? filtros.funcao.trim() : null;
  const filtroRegiao = filtros?.regiao && filtros.regiao !== "todas" ? filtros.regiao.trim() : null;

  // Filtra as pessoas segundo os filtros selecionados
  const pessoasFiltradas = pessoas.filter((p) => {
    if (filtroFuncao && (p.funcao?.trim() ?? "Não informada") !== filtroFuncao) {
      return false;
    }
    if (filtroRegiao && (p.regiaoNome?.trim() ?? "Sem região") !== filtroRegiao) {
      return false;
    }
    return true;
  });

  // Agrupa por (Função × Região)
  const grupos = new Map<
    string,
    {
      funcao: string;
      regiaoNome: string;
      totalTrabalhadores: number;
      idades: number[];
      faixas: FaixaEtariaContagem;
    }
  >();

  const todasIdadesGeral: number[] = [];
  const faixasGerais = inicializarFaixas();

  for (const p of pessoasFiltradas) {
    const funcaoNome = p.funcao?.trim() || "Não informada";
    const regiaoNome = p.regiaoNome?.trim() || "Sem região";
    const chave = `${funcaoNome}__${regiaoNome}`;

    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = {
        funcao: funcaoNome,
        regiaoNome,
        totalTrabalhadores: 0,
        idades: [],
        faixas: inicializarFaixas(),
      };
      grupos.set(chave, grupo);
    }

    grupo.totalTrabalhadores++;

    const idade = typeof p.idade === "number" ? p.idade : calcularIdade(p.dataNascimento);
    if (idade !== null && !isNaN(idade)) {
      grupo.idades.push(idade);
      contabilizarFaixa(grupo.faixas, idade);

      todasIdadesGeral.push(idade);
      contabilizarFaixa(faixasGerais, idade);
    }
  }

  // Monta as linhas formatadas e ordenadas
  const linhas: LinhaRelatorioIdade[] = Array.from(grupos.values()).map((g) => {
    const totalComIdade = g.idades.length;
    let mediaIdade: number | null = null;
    let idadeMinima: number | null = null;
    let idadeMaxima: number | null = null;

    if (totalComIdade > 0) {
      const soma = g.idades.reduce((acc, curr) => acc + curr, 0);
      mediaIdade = Math.round((soma / totalComIdade) * 10) / 10;
      idadeMinima = Math.min(...g.idades);
      idadeMaxima = Math.max(...g.idades);
    }

    return {
      funcao: g.funcao,
      regiaoNome: g.regiaoNome,
      totalTrabalhadores: g.totalTrabalhadores,
      totalComIdade,
      mediaIdade,
      idadeMinima,
      idadeMaxima,
      faixas: g.faixas,
    };
  });

  // Ordena por Função e depois por Região
  linhas.sort((a, b) => {
    const compFuncao = a.funcao.localeCompare(b.funcao, "pt-BR");
    if (compFuncao !== 0) return compFuncao;
    return a.regiaoNome.localeCompare(b.regiaoNome, "pt-BR");
  });

  // Totais gerais
  const totalGeralTrabalhadores = pessoasFiltradas.length;
  const totalGeralComIdade = todasIdadesGeral.length;
  let mediaGeralIdade: number | null = null;
  let idadeMinimaGeral: number | null = null;
  let idadeMaximaGeral: number | null = null;

  if (totalGeralComIdade > 0) {
    const somaGeral = todasIdadesGeral.reduce((acc, curr) => acc + curr, 0);
    mediaGeralIdade = Math.round((somaGeral / totalGeralComIdade) * 10) / 10;
    idadeMinimaGeral = Math.min(...todasIdadesGeral);
    idadeMaximaGeral = Math.max(...todasIdadesGeral);
  }

  return {
    linhas,
    totalGeralTrabalhadores,
    totalGeralComIdade,
    mediaGeralIdade,
    idadeMinimaGeral,
    idadeMaximaGeral,
    faixasGerais,
    funcoesDisponiveis: todasFuncoes,
    regioesDisponiveis: todasRegioes,
  };
}
