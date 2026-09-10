import { describe, it, expect } from "vitest";

/**
 * Testes unitários para as regras de negócio e salvaguardas de exclusão/edição de membros (CRUD)
 * e do papel de SuperAdmin.
 */

interface Membro {
  id: string;
  nome: string;
  email: string;
  papel: "superadmin" | "gestor" | "coord_comite" | "coord_regiao" | "contratado" | "auditor";
  ativo: boolean;
  organizacaoId: string;
}

function validarRegraExclusaoMembro({
  membroAlvo,
  usuarioLogadoId,
  totalGestoresAtivosNaOrg,
}: {
  membroAlvo: Membro;
  usuarioLogadoId: string;
  totalGestoresAtivosNaOrg: number;
}): { permitido: boolean; motivoRecusa?: string } {
  // Trava 1: Não pode autoexcluir-se
  if (membroAlvo.id === usuarioLogadoId) {
    return {
      permitido: false,
      motivoRecusa: "Você não pode excluir seu próprio acesso.",
    };
  }

  // Trava 2: Não pode excluir o único gestor ativo
  if (membroAlvo.papel === "gestor" && membroAlvo.ativo && totalGestoresAtivosNaOrg <= 1) {
    return {
      permitido: false,
      motivoRecusa: "Não é possível excluir o único gestor ativo da organização.",
    };
  }

  return { permitido: true };
}

function gerarSnapshotAuditoriaDadosExcluidos({
  membroAlvo,
  usuarioLogadoId,
  usuarioLogadoNome,
  usuarioLogadoEmail,
  motivo,
}: {
  membroAlvo: Membro;
  usuarioLogadoId: string;
  usuarioLogadoNome: string;
  usuarioLogadoEmail: string;
  motivo?: string;
}) {
  return {
    organizacao_id: membroAlvo.organizacaoId,
    tipo_registro: "membro",
    registro_id: membroAlvo.id,
    dados: { ...membroAlvo },
    usuario_id: usuarioLogadoId,
    usuario_nome: usuarioLogadoNome,
    usuario_login: usuarioLogadoEmail,
    motivo: motivo || "Exclusão de membro da equipe pelo painel administrativo",
  };
}

describe("Regras e salvaguardas de exclusão de membros da equipe", () => {
  const gestorPrincipal: Membro = {
    id: "usr-gestor-1",
    nome: "Gestor Primário",
    email: "gestor@org.com",
    papel: "gestor",
    ativo: true,
    organizacaoId: "org-1",
  };

  const gestorSecundario: Membro = {
    id: "usr-gestor-2",
    nome: "Segundo Gestor",
    email: "gestor2@org.com",
    papel: "gestor",
    ativo: true,
    organizacaoId: "org-1",
  };

  const coordenador: Membro = {
    id: "usr-coord-1",
    nome: "Coordenador Regional",
    email: "coord@org.com",
    papel: "coord_regiao",
    ativo: true,
    organizacaoId: "org-1",
  };

  it("impede que o usuário exclua a sua própria conta (bloqueio de autoexclusão)", () => {
    const res = validarRegraExclusaoMembro({
      membroAlvo: gestorPrincipal,
      usuarioLogadoId: "usr-gestor-1",
      totalGestoresAtivosNaOrg: 2,
    });
    expect(res.permitido).toBe(false);
    expect(res.motivoRecusa).toBe("Você não pode excluir seu próprio acesso.");
  });

  it("impede a exclusão do único gestor ativo da organização (bloqueio de orfandade)", () => {
    const res = validarRegraExclusaoMembro({
      membroAlvo: gestorPrincipal,
      usuarioLogadoId: "outro-usuario",
      totalGestoresAtivosNaOrg: 1,
    });
    expect(res.permitido).toBe(false);
    expect(res.motivoRecusa).toBe("Não é possível excluir o único gestor ativo da organização.");
  });

  it("permite a exclusão de um gestor quando há outro gestor ativo na organização", () => {
    const res = validarRegraExclusaoMembro({
      membroAlvo: gestorSecundario,
      usuarioLogadoId: "usr-gestor-1",
      totalGestoresAtivosNaOrg: 2,
    });
    expect(res.permitido).toBe(true);
    expect(res.motivoRecusa).toBeUndefined();
  });

  it("permite a exclusão de outros papéis (coordenadores, contratados, auditores)", () => {
    const res = validarRegraExclusaoMembro({
      membroAlvo: coordenador,
      usuarioLogadoId: "usr-gestor-1",
      totalGestoresAtivosNaOrg: 1,
    });
    expect(res.permitido).toBe(true);
  });

  it("gera snapshot completo de auditoria para a tabela DadosExcluidos", () => {
    const snapshot = gerarSnapshotAuditoriaDadosExcluidos({
      membroAlvo: coordenador,
      usuarioLogadoId: "usr-gestor-1",
      usuarioLogadoNome: "Gestor Primário",
      usuarioLogadoEmail: "gestor@org.com",
      motivo: "Desligamento por solicitação do comitê",
    });

    expect(snapshot.tipo_registro).toBe("membro");
    expect(snapshot.registro_id).toBe("usr-coord-1");
    expect(snapshot.organizacao_id).toBe("org-1");
    expect(snapshot.usuario_id).toBe("usr-gestor-1");
    expect(snapshot.usuario_nome).toBe("Gestor Primário");
    expect(snapshot.usuario_login).toBe("gestor@org.com");
    expect(snapshot.motivo).toBe("Desligamento por solicitação do comitê");
    expect(snapshot.dados.email).toBe("coord@org.com");
  });
});
