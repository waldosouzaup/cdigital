/**
 * Modelo do termo de distrato — editável pelo administrador em
 * `/configuracoes?aba=modelos`.
 *
 * Antes o texto da rescisão era fixo dentro de `montarTextoTermoDistrato`: a
 * coordenação não tinha como ajustar cláusula, foro ou qualificação da
 * contratante sem deploy. Aqui ele vira um corpo com marcadores, do mesmo feitio
 * dos modelos de minuta (`marcadores.ts`), mais os campos que só a rescisão tem
 * — motivo, data do distrato e o proporcional calculado.
 *
 * `TEMPLATE_DISTRATO_PADRAO` reproduz o termo oficial palavra por palavra: é o
 * que roda quando o comitê ainda não salvou um modelo próprio, de modo que a
 * funcionalidade nova não muda nenhum documento já em uso.
 */
import type { DadosCalculoDistrato } from "./distrato";

/** Nome fixo da linha de `templates_contrato` que guarda o termo de rescisão. */
export const NOME_TEMPLATE_DISTRATO = "Termo de Distrato — Rescisão Contratual";

export interface DadosDistrato {
  /** Qualificação integral da CONTRATANTE (migration 0037). */
  contratante: string;
  nome: string;
  cpf: string;
  endereco: string;
  objeto: string;
  motivo: string;
  dataDistrato: string;
  dataDistratoExtenso: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  valor: string;
  valorExtenso: string;
  valorProporcional: string;
  valorProporcionalExtenso: string;
  diasTrabalhados: string;
  diasTrabalhadosExtenso: string;
  diasTotais: string;
  diasTotaisExtenso: string;
}

/** Ordem e rótulos usados para desenhar as fichas de marcador na tela de modelos. */
export const MARCADORES_DISTRATO: ReadonlyArray<{
  marcador: string;
  campo: keyof DadosDistrato;
  rotulo: string;
}> = [
  { marcador: "{{contratante}}", campo: "contratante", rotulo: "Qualificação da contratante" },
  { marcador: "{{nome}}", campo: "nome", rotulo: "Nome do contratado" },
  { marcador: "{{cpf}}", campo: "cpf", rotulo: "CPF do contratado" },
  { marcador: "{{endereco}}", campo: "endereco", rotulo: "Endereço do contratado" },
  { marcador: "{{objeto}}", campo: "objeto", rotulo: "Objeto do contrato" },
  { marcador: "{{motivo}}", campo: "motivo", rotulo: "Motivo da rescisão" },
  { marcador: "{{data_distrato}}", campo: "dataDistrato", rotulo: "Data do distrato" },
  {
    marcador: "{{data_distrato_extenso}}",
    campo: "dataDistratoExtenso",
    rotulo: "Data do distrato por extenso",
  },
  { marcador: "{{vigencia_inicio}}", campo: "vigenciaInicio", rotulo: "Início da vigência" },
  { marcador: "{{vigencia_fim}}", campo: "vigenciaFim", rotulo: "Fim da vigência" },
  { marcador: "{{valor}}", campo: "valor", rotulo: "Valor original do contrato" },
  { marcador: "{{valor_extenso}}", campo: "valorExtenso", rotulo: "Valor original por extenso" },
  {
    marcador: "{{valor_proporcional}}",
    campo: "valorProporcional",
    rotulo: "Valor proporcional devido",
  },
  {
    marcador: "{{valor_proporcional_extenso}}",
    campo: "valorProporcionalExtenso",
    rotulo: "Valor proporcional por extenso",
  },
  { marcador: "{{dias_trabalhados}}", campo: "diasTrabalhados", rotulo: "Dias trabalhados" },
  {
    marcador: "{{dias_trabalhados_extenso}}",
    campo: "diasTrabalhadosExtenso",
    rotulo: "Dias trabalhados por extenso",
  },
  { marcador: "{{dias_totais}}", campo: "diasTotais", rotulo: "Dias do período contratual" },
  {
    marcador: "{{dias_totais_extenso}}",
    campo: "diasTotaisExtenso",
    rotulo: "Dias do período por extenso",
  },
];

function formatarValorBRL(valor: number): string {
  return `R$ ${valor.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function montarDadosDistrato(params: {
  contratante: string;
  contratadoNome: string;
  contratadoCpf: string;
  contratadoEndereco?: string | null;
  objeto?: string | null;
  motivo: string;
  calculo: DadosCalculoDistrato;
}): DadosDistrato {
  const { calculo } = params;

  return {
    contratante: params.contratante,
    nome: params.contratadoNome,
    cpf: params.contratadoCpf,
    endereco: params.contratadoEndereco?.trim() || "não informado",
    objeto: params.objeto?.trim() || "não informado",
    // Mesmo texto de fallback que o termo fixo usava, para não mudar o documento.
    motivo: params.motivo.trim() || "desacordo",
    dataDistrato: calculo.dataDistratoFormatada,
    dataDistratoExtenso: calculo.dataDistratoExtenso,
    vigenciaInicio: calculo.vigenciaInicioFormatada,
    vigenciaFim: calculo.vigenciaFimFormatada,
    valor: formatarValorBRL(calculo.valorOriginal),
    valorExtenso: calculo.valorProporcionalExtenso,
    valorProporcional: formatarValorBRL(calculo.valorProporcional),
    valorProporcionalExtenso: calculo.valorProporcionalExtenso,
    diasTrabalhados: String(calculo.diasTrabalhados),
    diasTrabalhadosExtenso: calculo.diasTrabalhadosExtenso,
    diasTotais: String(calculo.diasTotais),
    diasTotaisExtenso: calculo.diasTotaisExtenso,
  };
}

export function substituirMarcadoresDistrato(corpo: string, dados: DadosDistrato): string {
  // Passagem única, como em `substituirMarcadores`: um valor vindo do cadastro
  // que por acaso contenha `{{...}}` não vira marcador.
  const valores = Object.fromEntries(
    MARCADORES_DISTRATO.map(({ marcador, campo }) => [marcador, dados[campo] ?? "não informado"]),
  );
  return corpo.replace(/\{\{[a-z_]+\}\}/g, (marcador) => valores[marcador] ?? marcador);
}

/**
 * Termo oficial vigente, marcador a marcador. Qualquer mudança aqui muda o
 * documento de todo comitê que ainda não salvou modelo próprio.
 */
export const TEMPLATE_DISTRATO_PADRAO = [
  "{{contratante}}",
  "CONTRATADO(A): {{nome}}, inscrito(a) no CPF nº {{cpf}}, com endereço em {{endereco}}.",
  "Pelo presente instrumento particular de Termo de Distrato de Contrato de Prestação de Serviços, têm entre si justo e contratado o seguinte, que mutuamente convencionam, outorgam e aceitam:",
  "Cláusula 1. Por este instrumento particular, consignam as partes, em razão de {{motivo}}, distratam, na data {{data_distrato}}, os termos do contrato assinado em {{vigencia_inicio}}, sem qualquer pagamento de multa ou qualquer outra penalidade.",
  "Cláusula 2. – O(A) CONTRATADO(A) declara que recebeu o valor de {{valor_proporcional}} ({{valor_proporcional_extenso}}), proporcional aos {{dias_trabalhados}} ({{dias_trabalhados_extenso}}) dias efetivamente trabalhados no período de {{vigencia_inicio}} a {{data_distrato}}, com base no valor mensal dividido pelos {{dias_totais}} ({{dias_totais_extenso}}) dias corridos do período contratual ({{vigencia_inicio}} a {{vigencia_fim}}), não tendo mais nada a reclamar.",
  "Cláusula 3. – A CONTRATANTE declara que recebeu todos os serviços referentes ao contrato entabulado, não tendo nada a reclamar.",
  "Cláusula 4. – Fica eleito o Foro da cidade de BRASÍLIA/DF, para resolver qualquer questão decorrente do presente contrato, que não comporte a solução amigável.",
  "E, por estarem assim justos e contratados, depois de lido e achado conforme, assinam as partes o presente instrumento, em duas vias de igual teor e forma, para uma só finalidade, na presença das testemunhas abaixo:\n\nBRASÍLIA, {{data_distrato_extenso}}.\n\n______________________________          ______________________________\nCONTRATANTE                             CONTRATADO(A)\n\nTestemunha 1:                           Testemunha 2:\n______________________________          ______________________________\nNOME:                                   NOME:\nCPF:                                    CPF:",
].join("\n\n");
