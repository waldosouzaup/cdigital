/**
 * Validação de nova senha — usada pela página `/definir-senha` e pelo Route
 * Handler `/api/conta/senha`. Função pura.
 */
export const SENHA_MIN = 8;

export type ResultadoNovaSenha =
  | { ok: true; senha: string }
  | { ok: false; erro: string };

export function validarNovaSenha(senha: string, confirmacao: string): ResultadoNovaSenha {
  const s = senha ?? "";
  if (s.length < SENHA_MIN) {
    return { ok: false, erro: `A senha precisa de pelo menos ${SENHA_MIN} caracteres.` };
  }
  if (s !== (confirmacao ?? "")) {
    return { ok: false, erro: "As senhas não coincidem." };
  }
  return { ok: true, senha: s };
}
