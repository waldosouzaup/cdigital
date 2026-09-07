/**
 * Validação de CPF por dígito verificador — Seção 12 do PROMPT-Comite-Digital.md.
 *
 * O CPF único por organização é garantido pelo índice do banco (Seção 5); esta função
 * só valida o formato e o dígito verificador antes de a linha chegar ao banco.
 */

export function stripCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

function calculateCheckDigit(base: string, startWeight: number): number {
  let sum = 0;
  for (let i = 0; i < base.length; i++) {
    sum += Number(base[i]) * (startWeight - i);
  }
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCpf(cpf: string): boolean {
  const digits = stripCpf(cpf);

  if (digits.length !== 11) return false;

  // Todos os dígitos iguais passam na matemática do DV mas não são CPF válido.
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const firstCheckDigit = calculateCheckDigit(digits.slice(0, 9), 10);
  const secondCheckDigit = calculateCheckDigit(digits.slice(0, 9) + firstCheckDigit, 11);

  return digits === digits.slice(0, 9) + String(firstCheckDigit) + String(secondCheckDigit);
}
