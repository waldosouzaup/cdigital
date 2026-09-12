/**
 * Ações de auditoria que os formulários públicos podem registrar.
 *
 * As rotas `/api/coleta/[token]/auditoria` e `/api/inscricao/[slug]/auditoria`
 * não exigem sessão — é por design, quem preenche não tem conta. Elas aceitavam
 * qualquer string vinda do corpo da requisição como `acao`, o que deixa um log
 * destinado a valer como prova jurídica aberto a poluição por quem chamar a API
 * na mão. A lista fechada é a fronteira.
 */
export const ACOES_AUDITORIA_PUBLICA = [
  /** Página aberta. Só IP, hora, user agent e geo por IP — nunca GPS. */
  "acesso_pagina",
  /** Primeiro toque em um campo do formulário; é aqui que o GPS é pedido. */
  "inicio_preenchimento",
] as const;

export type AcaoAuditoriaPublica = (typeof ACOES_AUDITORIA_PUBLICA)[number];

export function ehAcaoAuditoriaPublica(valor: unknown): valor is AcaoAuditoriaPublica {
  return (
    typeof valor === "string" &&
    (ACOES_AUDITORIA_PUBLICA as readonly string[]).includes(valor)
  );
}

/**
 * Normaliza a ação recebida do cliente. Valor desconhecido não vira erro 400 —
 * a auditoria nunca deve competir com o preenchimento do formulário —, cai para
 * `acesso_pagina`, que é o evento menos específico.
 */
export function normalizarAcaoAuditoria(valor: unknown): AcaoAuditoriaPublica {
  return ehAcaoAuditoriaPublica(valor) ? valor : "acesso_pagina";
}
