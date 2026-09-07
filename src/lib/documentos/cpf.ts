/**
 * Validação de CPF por dígito verificador — Seção 12 do PROMPT-Comite-Digital.md.
 *
 * O CPF único por organização é garantido pelo índice do banco (Seção 5); esta função
 * só valida o formato e o dígito verificador antes de a linha chegar ao banco.
 */

export function limparCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

function calcularDigito(base: string, pesoInicial: number): number {
  let soma = 0;
  for (let i = 0; i < base.length; i++) {
    soma += Number(base[i]) * (pesoInicial - i);
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

export function cpfValido(cpf: string): boolean {
  const digitos = limparCpf(cpf);

  if (digitos.length !== 11) return false;

  // Todos os dígitos iguais passam na matemática do DV mas não são CPF válido.
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const primeiroDv = calcularDigito(digitos.slice(0, 9), 10);
  const segundoDv = calcularDigito(digitos.slice(0, 9) + primeiroDv, 11);

  return digitos === digitos.slice(0, 9) + String(primeiroDv) + String(segundoDv);
}
