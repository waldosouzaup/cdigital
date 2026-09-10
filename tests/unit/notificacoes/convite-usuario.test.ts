import { describe, it, expect } from "vitest";
import { renderizarEmailConviteUsuario, obterRotuloPapel } from "@/emails/convite-usuario";

describe("E-mail de Convite de Usuário com Senha Temporária (convite_usuario)", () => {
  it("mapeia corretamente os papéis do sistema para rótulos amigáveis", () => {
    expect(obterRotuloPapel("superadmin")).toBe("Super Administrador");
    expect(obterRotuloPapel("gestor")).toBe("Gestor");
    expect(obterRotuloPapel("coord_comite")).toBe("Coordenador de Comitê");
    expect(obterRotuloPapel("coord_regiao")).toBe("Coordenador Regional");
    expect(obterRotuloPapel("auditor")).toBe("Auditor");
    expect(obterRotuloPapel("contratado")).toBe("Contratado");
    expect(obterRotuloPapel("papel_custom")).toBe("papel_custom");
  });

  it("renderiza o assunto sem expor a senha por razões de segurança e LGPD", async () => {
    const senhaTeste = "kL9#mP2$xY7!";
    const { subject } = await renderizarEmailConviteUsuario({
      nome: "Carlos Eduardo",
      email: "carlos@exemplo.com",
      papel: "coord_comite",
      senhaTemporaria: senhaTeste,
    });

    expect(subject).toBe("Seu acesso ao Comitê Digital foi liberado — Senha temporária");
    expect(subject).not.toContain(senhaTeste);
  });

  it("renderiza o HTML com dados do usuário, senha temporária, alerta de troca imediata e link de login", async () => {
    const urlLogin = "https://campanha2026.com.br/login";
    const senhaTeste = "x8Kq#9LmP2!";
    const { html } = await renderizarEmailConviteUsuario({
      nome: "Mariana Souza",
      email: "mariana.souza@campanha.org",
      papel: "gestor",
      senhaTemporaria: senhaTeste,
      urlLogin,
    });

    expect(html).toContain("Mariana");
    expect(html).toContain("mariana.souza@campanha.org");
    expect(html).toContain("Gestor");
    expect(html).toContain(senhaTeste);
    expect(html).toContain("Senha Temporária — Troca Imediata Obrigatória");
    expect(html).toContain("alterá-la imediatamente após autenticar-se");
    expect(html).toContain(urlLogin);
    expect(html).toContain("COMITÊ");
    expect(html).toContain("DIGITAL");
  });

  it("renderiza a versão em texto puro contendo a senha e instruções de troca", async () => {
    const senhaTeste = "TempPass123!";
    const { text } = await renderizarEmailConviteUsuario({
      nome: "Rafael Oliveira",
      email: "rafael@campanha.org",
      papel: "auditor",
      senhaTemporaria: senhaTeste,
      urlLogin: "https://campanha.org/login",
    });

    expect(text).toContain("RAFAEL");
    expect(text).toContain("rafael@campanha.org");
    expect(text).toContain("Auditor");
    expect(text).toContain(senhaTeste);
    expect(text).toContain("Senha Temporária");
    expect(text).toContain("https://campanha.org/login");
  });
});
