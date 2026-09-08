/**
 * Validação de CNPJ por dígito verificador — usada na edição da identidade do
 * comitê (item 4 do feedback do coordenador). Mesmo padrão de
 * `src/lib/documentos/cpf.ts`.
 */
export function stripCnpj(cnpj: string): string {
  return (cnpj ?? "").replace(/\D/g, "");
}

export function formatCnpj(cnpj: string): string {
  const d = stripCnpj(cnpj);
  if (d.length !== 14) return cnpj;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function digitoVerificador(base: string): number {
  // Pesos do CNPJ: 5,4,3,2,9,8,7,6,5,4,3,2 (12 posições) e depois com um 6 à frente.
  const pesos =
    base.length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function isValidCnpj(cnpj: string): boolean {
  const d = stripCnpj(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const dv1 = digitoVerificador(d.slice(0, 12));
  const dv2 = digitoVerificador(d.slice(0, 12) + String(dv1));
  return d === d.slice(0, 12) + String(dv1) + String(dv2);
}
