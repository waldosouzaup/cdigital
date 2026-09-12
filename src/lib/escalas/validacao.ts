/**
 * Validação de turno de escala (migration 0043) — lógica pura.
 *
 * Escala é compromisso futuro; `registros_atividade` guarda o que já foi feito.
 * Sem este conceito, um evento que contrata a mesma pessoa para três dias em
 * horários diferentes virava três contratos ou nenhum controle.
 *
 * Espelha as duas restrições do banco — `escalas_intervalo_valido` e
 * `escalas_sem_sobreposicao`. O banco continua sendo a garantia (importação em
 * lote e duas telas abertas escapam de qualquer checagem na aplicação); isto
 * existe para devolver português no formulário em vez de deixar vazar 23P01.
 */

export interface EntradaEscala {
  pessoaId: string;
  regiaoId?: string | null;
  contratoId?: string | null;
  /** Datas em qualquer formato que `Date` entenda — o input HTML manda `YYYY-MM-DDTHH:mm`. */
  inicio: string;
  fim: string;
  funcao?: string | null;
  local?: string | null;
  observacao?: string | null;
}

export interface ValoresEscala {
  pessoaId: string;
  regiaoId: string | null;
  contratoId: string | null;
  /** ISO em UTC, pronto para o banco. */
  inicio: string;
  fim: string;
  funcao: string | null;
  local: string | null;
  observacao: string | null;
}

export interface TurnoExistente {
  inicio: string;
  fim: string;
}

export type CampoEscala = "pessoaId" | "inicio" | "fim" | "funcao" | "local" | "observacao";

export type ResultadoEscala =
  | { ok: true; valores: ValoresEscala }
  | { ok: false; erros: Partial<Record<CampoEscala, string>> };

/**
 * Teto de duração de um turno. Não é regra trabalhista — é filtro de digitação:
 * trocar o dia no campo de fim é o erro mais comum ao escalar, e sem teto ele
 * passa como um turno de semanas.
 */
const MAX_HORAS_TURNO = 24;
const MAX_TEXTO = 200;
const MAX_OBSERVACAO = 500;

function limpoOuNulo(valor: string | null | undefined, max: number): string | null {
  const texto = (valor ?? "").trim();
  if (!texto) return null;
  return texto.slice(0, max);
}

function instante(valor: string): number | null {
  const t = Date.parse((valor ?? "").trim());
  return Number.isFinite(t) ? t : null;
}

export function validarEscala(
  entrada: EntradaEscala,
  turnosExistentes: TurnoExistente[] = [],
): ResultadoEscala {
  const erros: Partial<Record<CampoEscala, string>> = {};

  const pessoaId = (entrada.pessoaId ?? "").trim();
  if (!pessoaId) erros.pessoaId = "Escolha quem vai cumprir o turno.";

  const inicio = instante(entrada.inicio);
  const fim = instante(entrada.fim);

  if (inicio === null) erros.inicio = "Informe o início do turno.";
  if (fim === null) erros.fim = "Informe o fim do turno.";

  if (inicio !== null && fim !== null) {
    if (fim <= inicio) {
      erros.fim = "O fim do turno precisa ser depois do início.";
    } else if (fim - inicio > MAX_HORAS_TURNO * 3600 * 1000) {
      erros.fim = `Um turno não pode passar de ${MAX_HORAS_TURNO} horas. Confira a data do fim.`;
    }
  }

  // Só checa sobreposição depois que o intervalo em si é válido — acusar
  // conflito de um intervalo invertido confundiria mais que ajudaria.
  if (inicio !== null && fim !== null && fim > inicio && !erros.fim) {
    const conflita = turnosExistentes.some((turno) => {
      const outroInicio = instante(turno.inicio);
      const outroFim = instante(turno.fim);
      if (outroInicio === null || outroFim === null) return false;
      // Intervalo semiaberto `[inicio, fim)`, igual ao `tstzrange` do banco:
      // turno que termina exatamente quando o outro começa não se sobrepõe.
      return inicio < outroFim && outroInicio < fim;
    });
    if (conflita) {
      erros.inicio = "Esta pessoa já está escalada em outro turno neste horário.";
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros };

  return {
    ok: true,
    valores: {
      pessoaId,
      regiaoId: (entrada.regiaoId ?? "").trim() || null,
      contratoId: (entrada.contratoId ?? "").trim() || null,
      inicio: new Date(inicio!).toISOString(),
      fim: new Date(fim!).toISOString(),
      funcao: limpoOuNulo(entrada.funcao, MAX_TEXTO),
      local: limpoOuNulo(entrada.local, MAX_TEXTO),
      observacao: limpoOuNulo(entrada.observacao, MAX_OBSERVACAO),
    },
  };
}
