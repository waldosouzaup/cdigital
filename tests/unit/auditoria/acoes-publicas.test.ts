import { describe, it, expect } from "vitest";
import {
  ACOES_AUDITORIA_PUBLICA,
  ehAcaoAuditoriaPublica,
  normalizarAcaoAuditoria,
} from "@/lib/auditoria/acoes-publicas";

/**
 * As rotas de auditoria são públicas por design. Antes elas gravavam em
 * `log_auditoria` qualquer string que viesse no corpo como `acao` — um log que
 * serve de prova para prestação de contas não pode aceitar rótulo arbitrário de
 * fora.
 */
describe("normalizarAcaoAuditoria", () => {
  it("aceita as ações previstas", () => {
    for (const acao of ACOES_AUDITORIA_PUBLICA) {
      expect(normalizarAcaoAuditoria(acao)).toBe(acao);
    }
  });

  it("descarta rótulo arbitrário vindo do cliente", () => {
    expect(normalizarAcaoAuditoria("exclusao_contrato")).toBe("acesso_pagina");
    expect(normalizarAcaoAuditoria("<script>alert(1)</script>")).toBe("acesso_pagina");
    expect(normalizarAcaoAuditoria("")).toBe("acesso_pagina");
  });

  it("descarta valor que nem é string", () => {
    expect(normalizarAcaoAuditoria(undefined)).toBe("acesso_pagina");
    expect(normalizarAcaoAuditoria({ acao: "acesso_pagina" })).toBe("acesso_pagina");
    expect(normalizarAcaoAuditoria(42)).toBe("acesso_pagina");
  });

  it("ehAcaoAuditoriaPublica distingue previsto de arbitrário", () => {
    expect(ehAcaoAuditoriaPublica("inicio_preenchimento")).toBe(true);
    expect(ehAcaoAuditoriaPublica("qualquer_coisa")).toBe(false);
  });
});
