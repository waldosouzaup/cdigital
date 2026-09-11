/**
 * Nome padronizado e profissional para contratos gerados, assinados e distratos.
 * Permite ao administrador e ao usuário baixar o arquivo e identificá-lo
 * imediatamente com o nome do colaborador/usuário.
 *
 * Exemplos:
 * - Contrato - Guilherme Ribeiro.pdf
 * - Contrato - Guilherme Ribeiro (Assinado).pdf
 * - Distrato - Guilherme Ribeiro.pdf
 */
export function nomeArquivoContrato(
  nome: string | null | undefined,
  _contratoId?: string,
  versao: "gerado" | "assinado" | "distrato" = "gerado",
): string {
  // Limpa caracteres inválidos para sistemas de arquivos preservando legibilidade e espaços
  const nomeLimpo = (nome ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove acentos para compatibilidade universal de SO
    .replace(/[/\\?%*:|"<>]/g, "") // remove caracteres reservados de filesystem
    .replace(/\s+/g, " ")
    .trim();

  const pessoa = nomeLimpo.slice(0, 80).trim() || "Colaborador";

  if (versao === "distrato") {
    return `Distrato - ${pessoa}.pdf`;
  }
  if (versao === "assinado") {
    return `Contrato - ${pessoa} (Assinado).pdf`;
  }
  return `Contrato - ${pessoa}.pdf`;
}
