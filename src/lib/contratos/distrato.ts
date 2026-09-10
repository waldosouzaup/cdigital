import extenso from "extenso";
import { amountInWords } from "./valor-extenso";

export interface DadosCalculoDistrato {
  diasTotais: number;
  diasTotaisExtenso: string;
  diasTrabalhados: number;
  diasTrabalhadosExtenso: string;
  valorOriginal: number;
  valorDiario: number;
  valorProporcional: number;
  valorProporcionalExtenso: string;
  vigenciaInicioFormatada: string;
  vigenciaFimFormatada: string;
  dataDistratoFormatada: string;
  dataDistratoExtenso: string;
}

/**
 * Calcula a quantidade de dias corridos entre duas datas no formato YYYY-MM-DD,
 * de forma inclusiva (se início e fim forem iguais, conta 1 dia).
 */
export function calcularDiasCorridosInclusivos(inicioIso: string, fimIso: string): number {
  const [anoI, mesI, diaI] = inicioIso.split("-").map(Number);
  const [anoF, mesF, diaF] = fimIso.split("-").map(Number);
  const dInicioUtc = Date.UTC(anoI, mesI - 1, diaI);
  const dFimUtc = Date.UTC(anoF, mesF - 1, diaF);
  const msPorDia = 24 * 60 * 60 * 1000;
  const diffDias = Math.round((dFimUtc - dInicioUtc) / msPorDia);
  return Math.max(1, diffDias + 1);
}

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export function formatarDataPorExtenso(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  const mesIndex = Number(mes) - 1;
  const mesNome = MESES[mesIndex] ?? "";
  return `${dia.padStart(2, "0")} de ${mesNome} de ${ano}`;
}

export function formatarDataBR(isoDate: string): string {
  const [ano, mes, dia] = isoDate.split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * Realiza o cálculo proporcional do valor do distrato:
 * diasTotais = vigenciaInicio até vigenciaFim (inclusivo)
 * diasTrabalhados = vigenciaInicio até dataDistrato (inclusivo)
 * valorProporcional = (valorOriginal * diasTrabalhados) / diasTotais
 */
export function calcularProporcionalDistrato(params: {
  vigenciaInicio: string;
  vigenciaFim: string;
  dataDistrato: string;
  valor: number;
}): DadosCalculoDistrato {
  const { vigenciaInicio, vigenciaFim, dataDistrato, valor } = params;

  const diasTotais = calcularDiasCorridosInclusivos(vigenciaInicio, vigenciaFim);
  // Garante que dias trabalhados fique limitado ao período contratual
  const diasBrutos = calcularDiasCorridosInclusivos(vigenciaInicio, dataDistrato);
  const diasTrabalhados = Math.min(diasTotais, Math.max(1, diasBrutos));

  const valorDiario = diasTotais > 0 ? valor / diasTotais : valor;
  const valorProporcional = Math.round(((valor * diasTrabalhados) / diasTotais) * 100) / 100;

  return {
    diasTotais,
    diasTotaisExtenso: extenso(diasTotais),
    diasTrabalhados,
    diasTrabalhadosExtenso: extenso(diasTrabalhados),
    valorOriginal: valor,
    valorDiario: Math.round(valorDiario * 100) / 100,
    valorProporcional,
    valorProporcionalExtenso: amountInWords(valorProporcional),
    vigenciaInicioFormatada: formatarDataBR(vigenciaInicio),
    vigenciaFimFormatada: formatarDataBR(vigenciaFim),
    dataDistratoFormatada: formatarDataBR(dataDistrato),
    dataDistratoExtenso: formatarDataPorExtenso(dataDistrato),
  };
}

/**
 * Monta o texto completo do termo de rescisão de contrato de prestação de serviços
 * em exata conformidade com o modelo oficial anexado.
 */
export function montarTextoTermoDistrato(params: {
  contratanteTexto?: string;
  contratadoNome: string;
  contratadoCpf: string;
  contratadoEndereco?: string | null;
  motivo: string;
  calculo: DadosCalculoDistrato;
}): string {
  const {
    contratanteTexto = "CONTRATANTE: ELEIÇÃO 2026 MICHELLE DE PAULA FIRMO REINALDO BOLSONARO, candidata ao cargo de SENADOR, pelo PARTIDO LIBERAL – PL, com endereço na Rua Q – SHIS – QI-15 – Conjunto 7, Casa 23, inscrito no CNPJ sob o nº 68.608.523/0001-59.",
    contratadoNome,
    contratadoCpf,
    contratadoEndereco,
    motivo,
    calculo,
  } = params;

  const enderecoParte = contratadoEndereco ? `, com endereço em ${contratadoEndereco}` : "";
  const contratadoTexto = `CONTRATADO(A): ${contratadoNome}, inscrito(a) no CPF nº ${contratadoCpf}${enderecoParte}.`;

  const motivoLimpo = motivo.trim() || "desacordo";

  const clausula1 = `Cláusula 1. Por este instrumento particular, consignam as partes, em razão de ${motivoLimpo}, distratam, na data ${calculo.dataDistratoFormatada}, os termos do contrato assinado em ${calculo.vigenciaInicioFormatada}, sem qualquer pagamento de multa ou qualquer outra penalidade.`;

  const valorFormatado = `R$ ${calculo.valorProporcional.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  const clausula2 = `Cláusula 2. – O(A) CONTRATADO(A) declara que recebeu o valor de ${valorFormatado} (${calculo.valorProporcionalExtenso}), proporcional aos ${calculo.diasTrabalhados} (${calculo.diasTrabalhadosExtenso}) dias efetivamente trabalhados no período de ${calculo.vigenciaInicioFormatada} a ${calculo.dataDistratoFormatada}, com base no valor mensal dividido pelos ${calculo.diasTotais} (${calculo.diasTotaisExtenso}) dias corridos do período contratual (${calculo.vigenciaInicioFormatada} a ${calculo.vigenciaFimFormatada}), não tendo mais nada a reclamar.`;

  const clausula3 = `Cláusula 3. – A CONTRATANTE declara que recebeu todos os serviços referentes ao contrato entabulado, não tendo nada a reclamar.`;

  const clausula4 = `Cláusula 4. – Fica eleito o Foro da cidade de BRASÍLIA/DF, para resolver qualquer questão decorrente do presente contrato, que não comporte a solução amigável.`;

  const fechamento = `E, por estarem assim justos e contratados, depois de lido e achado conforme, assinam as partes o presente instrumento, em duas vias de igual teor e forma, para uma só finalidade, na presença das testemunhas abaixo:\n\nBRASÍLIA, ${calculo.dataDistratoExtenso}.\n\n______________________________          ______________________________\nCONTRATANTE                             CONTRATADO(A)\n\nTestemunha 1:                           Testemunha 2:\n______________________________          ______________________________\nNOME:                                   NOME:\nCPF:                                    CPF:`;

  return [
    contratanteTexto,
    contratadoTexto,
    "Pelo presente instrumento particular de Termo de Distrato de Contrato de Prestação de Serviços, têm entre si justo e contratado o seguinte, que mutuamente convencionam, outorgam e aceitam:",
    clausula1,
    clausula2,
    clausula3,
    clausula4,
    fechamento,
  ].join("\n\n");
}
