/**
 * E-mail de `convite_usuario` — Notificação de criação de novo usuário na equipe com senha temporária.
 * Comunica o cargo/papel atribuído, fornece as credenciais e alerta expressamente que a senha
 * é temporária e deve ser alterada imediatamente no primeiro login.
 *
 * Em conformidade com a LGPD e a governança cívica: nenhuma senha é exposta no assunto do e-mail.
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

export interface ConviteUsuarioEmailProps {
  nome: string;
  email: string;
  papel: string;
  senhaTemporaria: string;
  urlLogin?: string;
}

const ROTULOS_PAPEL: Record<string, string> = {
  superadmin: "Super Administrador",
  gestor: "Gestor",
  coord_comite: "Coordenador de Comitê",
  coord_regiao: "Coordenador Regional",
  auditor: "Auditor",
  contratado: "Contratado",
};

export function obterRotuloPapel(papel: string): string {
  return ROTULOS_PAPEL[papel] ?? papel;
}

export function ConviteUsuarioEmail({
  nome,
  email,
  papel,
  senhaTemporaria,
  urlLogin = "http://localhost:3000/login",
}: ConviteUsuarioEmailProps) {
  const primeiroNome = nome.trim().split(" ")[0] || "Membro";
  const cargoFormatado = obterRotuloPapel(papel);

  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Seu acesso ao Comitê Digital foi liberado — Senha temporária de primeiro acesso</Preview>
      <Body
        style={{
          fontFamily:
            "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          backgroundColor: "#F8FAF9",
          padding: "24px",
        }}
      >
        <Container
          style={{
            backgroundColor: "#ffffff",
            padding: "28px",
            maxWidth: "520px",
            borderRadius: "8px",
            border: "1px solid #E2E8F0",
          }}
        >
          {/* Logo / Header Cívico */}
          <div style={{ marginBottom: "24px" }}>
            <div
              style={{
                display: "inline-block",
                backgroundColor: "#0A0F0D",
                borderRadius: "6px",
                padding: "6px 12px",
              }}
            >
              <span style={{ color: "#ffffff", fontWeight: "bold", fontSize: "14px" }}>
                COMITÊ<span style={{ color: "#1FA871" }}>DIGITAL</span>
              </span>
            </div>
          </div>

          <Heading as="h2" style={{ fontSize: "20px", color: "#0A0F0D", marginTop: 0, marginBottom: "12px" }}>
            Bem-vindo(a) à equipe, {primeiroNome}!
          </Heading>

          <Text style={{ color: "#334155", lineHeight: "1.6", fontSize: "15px", margin: "0 0 16px 0" }}>
            Seu acesso ao sistema de gestão e governança da campanha <strong>Comitê Digital</strong> foi
            criado com sucesso. Você atuará com a função de <strong>{cargoFormatado}</strong>.
          </Text>

          {/* Card de Credenciais */}
          <div
            style={{
              backgroundColor: "#F8FAF9",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              padding: "16px",
              margin: "20px 0 16px 0",
            }}
          >
            <div style={{ marginBottom: "12px" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "4px",
                }}
              >
                E-mail de Acesso
              </span>
              <span
                style={{
                  display: "block",
                  fontFamily: "monospace",
                  fontSize: "14px",
                  color: "#0A0F0D",
                  fontWeight: "600",
                }}
              >
                {email}
              </span>
            </div>

            <div>
              <span
                style={{
                  display: "block",
                  fontSize: "11px",
                  fontWeight: "bold",
                  color: "#64748B",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "4px",
                }}
              >
                Senha Temporária
              </span>
              <span
                style={{
                  display: "inline-block",
                  fontFamily: "monospace",
                  fontSize: "16px",
                  color: "#0F766E",
                  fontWeight: "bold",
                  backgroundColor: "#E6FFFA",
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid #99F6E4",
                  letterSpacing: "0.04em",
                }}
              >
                {senhaTemporaria}
              </span>
            </div>
          </div>

          {/* Banner de Atenção / Troca Imediata */}
          <div
            style={{
              backgroundColor: "#FFFBEB",
              border: "1px solid #FCD34D",
              borderLeft: "4px solid #D97706",
              borderRadius: "6px",
              padding: "14px 16px",
              margin: "16px 0 24px 0",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontSize: "13px",
                fontWeight: "bold",
                color: "#92400E",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
              }}
            >
              ⚠️ Senha Temporária — Troca Imediata Obrigatória
            </Text>
            <Text
              style={{
                margin: "6px 0 0 0",
                fontSize: "13px",
                color: "#78350F",
                lineHeight: "1.5",
              }}
            >
              Por políticas de segurança cívica e governança de dados, esta credencial provisória é de uso restrito
              ao primeiro acesso. <strong>Você deve alterá-la imediatamente após autenticar-se na plataforma.</strong>
            </Text>
          </div>

          {/* Botão de Ação */}
          <div style={{ textAlign: "center", margin: "24px 0" }}>
            <Link
              href={urlLogin}
              style={{
                backgroundColor: "#1FA871",
                color: "#ffffff",
                padding: "12px 24px",
                borderRadius: "6px",
                fontWeight: "600",
                fontSize: "14px",
                textDecoration: "none",
                display: "inline-block",
              }}
            >
              Acessar o Painel do Comitê Digital →
            </Link>
          </div>

          <Text
            style={{
              fontSize: "12px",
              color: "#64748B",
              lineHeight: "1.5",
              margin: "24px 0 0 0",
              borderTop: "1px solid #E2E8F0",
              paddingTop: "16px",
            }}
          >
            Se você não esperava por este convite ou acredita que este e-mail foi enviado por engano,
            entre em contato com a coordenação de campanha do Comitê Digital. Nunca compartilhe sua senha.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailConviteUsuario(params: ConviteUsuarioEmailProps) {
  const elemento = <ConviteUsuarioEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return {
    subject: "Seu acesso ao Comitê Digital foi liberado — Senha temporária",
    html,
    text,
  };
}
