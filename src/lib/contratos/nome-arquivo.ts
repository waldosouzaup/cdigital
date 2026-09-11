/** Nome legível e seguro para cabeçalhos HTTP, Storage e downloads locais. */
export function nomeArquivoContrato(
  nome: string | null | undefined,
  contratoId: string,
  versao: "gerado" | "assinado" | "distrato" = "gerado",
): string {
  const limpar = (valor: string) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const pessoa = limpar(nome ?? "").slice(0, 90).replace(/-+$/, "") || "colaborador";
  const id = limpar(contratoId).slice(0, 36) || "documento";
  const prefixo = versao === "distrato" ? "distrato" : versao === "assinado" ? "contrato-assinado" : "contrato";
  return `${prefixo}-${pessoa}-${id}.pdf`;
}
