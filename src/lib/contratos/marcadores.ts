/**
 * Substituição de marcadores do template de contrato — Fase 2, item 7:
 * {{nome}}, {{cpf}}, {{endereco}}, {{objeto}}, {{valor}}, {{valor_extenso}},
 * {{vigencia_inicio}}, {{vigencia_fim}}, {{chave_pix}}.
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
  objetoDescricao?: string;
  valor: string;
  valorExtenso: string;
  vigenciaInicio: string;
  vigenciaFim: string;
  chavePix: string;
  email?: string;
  telefone?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
}

const MARCADOR_POR_CAMPO: Record<keyof DadosContrato, string> = {
  nome: "{{nome}}",
  cpf: "{{cpf}}",
  endereco: "{{endereco}}",
  objeto: "{{objeto}}",
  objetoDescricao: "{{objeto_descricao}}",
  valor: "{{valor}}",
  valorExtenso: "{{valor_extenso}}",
  vigenciaInicio: "{{vigencia_inicio}}",
  vigenciaFim: "{{vigencia_fim}}",
  chavePix: "{{chave_pix}}",
  email: "{{email}}",
  telefone: "{{telefone}}",
  banco: "{{banco}}",
  agencia: "{{agencia}}",
  conta: "{{conta}}",
};

export function substituirMarcadores(corpo: string, dados: DadosContrato): string {
  // Uma única passagem: valores do cadastro nunca são interpretados como novos marcadores.
  const valores = Object.fromEntries(
    Object.entries(MARCADOR_POR_CAMPO).map(([campo, marcador]) => [
      marcador,
      dados[campo as keyof DadosContrato] ?? (campo === "objetoDescricao" ? "" : "não informado"),
    ]),
  );
  return corpo.replace(/\{\{[a-z_]+\}\}/g, (marcador) => valores[marcador] ?? marcador);
}
