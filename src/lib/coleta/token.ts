/**
 * Token do link público de coleta — Fase 2, item 2. É a única credencial de quem
 * preenche o formulário (não há login), então precisa ser criptograficamente
 * aleatório e longo o bastante para não ser adivinhado por tentativa e erro.
 */
import { randomBytes } from "node:crypto";

const BYTES_DE_ENTROPIA = 24; // -> 32 caracteres em base64url

export function gerarTokenColeta(): string {
  return randomBytes(BYTES_DE_ENTROPIA).toString("base64url");
}
