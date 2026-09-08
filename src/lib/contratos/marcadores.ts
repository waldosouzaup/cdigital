/**
 * Substituição de marcadores do template de contrato — Fase 2, item 7:
 * {{nome}}, {{cpf}}, {{endereco}}, {{objeto}}, {{valor}}, {{valor_extenso}},
 * {{vigencia_inicio}}, {{vigencia_fim}}.
 *
 * Função pura: recebe o corpo já como string (HTML ou texto — não importa aqui,
 * a conversão para PDF acontece em gerar-pdf.ts) e os dados já formatados (quem
 * chama decide formato de data/moeda, não esta função).
 */

export interface DadosContrato {
  nome: string;
  cpf: string;
  endereco: string;
  objeto: string;
  valor: string;
  valorExtenso: string;
  vigenciaInicio: string;
  vigenciaFim: string;
}

const MARCADOR_POR_CAMPO: Record<keyof DadosContrato, string> = {
  nome: "{{nome}}",
  cpf: "{{cpf}}",
  endereco: "{{endereco}}",
  objeto: "{{objeto}}",
  valor: "{{valor}}",
  valorExtenso: "{{valor_extenso}}",
  vigenciaInicio: "{{vigencia_inicio}}",
  vigenciaFim: "{{vigencia_fim}}",
};

export function substituirMarcadores(corpo: string, dados: DadosContrato): string {
  return (Object.keys(MARCADOR_POR_CAMPO) as (keyof DadosContrato)[]).reduce(
    (texto, campo) => texto.split(MARCADOR_POR_CAMPO[campo]).join(dados[campo]),
    corpo,
  );
}
