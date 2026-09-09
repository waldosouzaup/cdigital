import { randomBytes } from "node:crypto";

/**
 * Senha temporária de uso único, gerada pelo sistema ao criar/reprovisionar um
 * usuário. O membro é obrigado a trocá-la no primeiro login
 * (`app_metadata.must_change_password`). Só roda no servidor (Node crypto).
 */
export function gerarSenhaTemporaria(): string {
  // 12 bytes -> 16 caracteres base64url (letras, números, - e _).
  return randomBytes(12).toString("base64url");
}
