/**
 * Validação do registro rápido de atividade de campo — Fase 4, item 1
 * ("registro de atividade em 3 toques"). Função pura: a Server Action
 * `registrarAtividade` chama isto, e só grava em `registros_atividade` se `ok`.
 *
 * `data` é comparada contra um `hoje` recebido por parâmetro (não `new Date()`
 * interno) para o teste ser determinístico e para o servidor poder passar o "hoje"
 * no fuso de Brasília.
 */
export interface EntradaRegistroAtividade {
  pessoaId: string;
  regiaoId?: string;
  tipo: string;
  quantidade: string | number;
  observacao?: string;
  data: string;
  /** Coordenada do navegador (migration 0038). Opcional: sinal ruim é o normal. */
  latitude?: string | number | null;
  longitude?: string | number | null;
  precisaoM?: string | number | null;
}

export interface ValoresRegistroAtividade {
  pessoaId: string;
  regiaoId: string | null;
  tipo: string;
  quantidade: number;
  observacao: string | null;
  data: string;
  latitude: number | null;
  longitude: number | null;
  precisaoM: number | null;
}

export type CampoRegistro = "pessoaId" | "tipo" | "quantidade" | "observacao" | "data";

export type ResultadoValidacao =
  | { ok: true; valores: ValoresRegistroAtividade }
  | { ok: false; erros: Partial<Record<CampoRegistro, string>> };

const MAX_TIPO = 80;
const MAX_OBSERVACAO = 500;

function numeroOuNulo(valor: string | number | null | undefined): number | null {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = typeof valor === "number" ? valor : Number(String(valor).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Coordenada é descartada, nunca vira erro de formulário: uma leitura ruim do
 * GPS não pode impedir o registro da atividade, que é o dado que importa.
 *
 * Meia coordenada é descartada por inteiro — latitude sem longitude não localiza
 * nada e ainda passa a impressão de que localiza. Espelha a restrição
 * `registros_atividade_coordenada_valida` no banco.
 */
function coordenadaValida(
  latBruta: string | number | null | undefined,
  lonBruta: string | number | null | undefined,
): { latitude: number | null; longitude: number | null } {
  const latitude = numeroOuNulo(latBruta);
  const longitude = numeroOuNulo(lonBruta);

  if (latitude === null || longitude === null) return { latitude: null, longitude: null };
  if (latitude < -90 || latitude > 90) return { latitude: null, longitude: null };
  if (longitude < -180 || longitude > 180) return { latitude: null, longitude: null };

  return { latitude, longitude };
}

export function validarRegistroAtividade(
  entrada: EntradaRegistroAtividade,
  hojeIso: string,
): ResultadoValidacao {
  const erros: Partial<Record<CampoRegistro, string>> = {};

  const pessoaId = (entrada.pessoaId ?? "").trim();
  if (!pessoaId) {
    erros.pessoaId = "Escolha a pessoa que executou a atividade.";
  }

  const tipo = (entrada.tipo ?? "").trim();
  if (!tipo) {
    erros.tipo = "Escolha um tipo de atividade.";
  } else if (tipo.length > MAX_TIPO) {
    erros.tipo = `Use no máximo ${MAX_TIPO} caracteres.`;
  }

  const quantidadeBruta =
    typeof entrada.quantidade === "number" ? String(entrada.quantidade) : (entrada.quantidade ?? "").trim();
  const quantidade = Number(quantidadeBruta);
  if (!quantidadeBruta || !Number.isInteger(quantidade) || quantidade < 1) {
    erros.quantidade = "Informe um número inteiro maior que zero.";
  }

  const observacaoBruta = (entrada.observacao ?? "").trim();
  if (observacaoBruta.length > MAX_OBSERVACAO) {
    erros.observacao = `Use no máximo ${MAX_OBSERVACAO} caracteres.`;
  }

  const data = (entrada.data ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    erros.data = "Data inválida.";
  } else if (data > hojeIso) {
    erros.data = "A data não pode ser no futuro.";
  }

  if (Object.keys(erros).length > 0) {
    return { ok: false, erros };
  }

  const { latitude, longitude } = coordenadaValida(entrada.latitude, entrada.longitude);
  const precisaoBruta = numeroOuNulo(entrada.precisaoM);
  // Precisão só acompanha uma coordenada de verdade, e raio negativo não existe.
  const precisaoM =
    latitude !== null && precisaoBruta !== null && precisaoBruta >= 0 ? precisaoBruta : null;

  return {
    ok: true,
    valores: {
      pessoaId,
      regiaoId: (entrada.regiaoId ?? "").trim() || null,
      tipo,
      quantidade,
      observacao: observacaoBruta || null,
      data,
      latitude,
      longitude,
      precisaoM,
    },
  };
}
