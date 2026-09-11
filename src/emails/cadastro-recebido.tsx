/**
 * E-mail de `cadastro_recebido` — Confirmação de recebimento dos dados cadastrais
 * e envio de documentos com protocolo gerado ao finalizar o cadastro.
 *
 * Em conformidade com a LGPD e a governança cívica:
 * Não expõe dados bancários nem CPF no assunto ou corpo de forma desnecessária.
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Preview, Text, render } from "react-email";

export interface CadastroRecebidoEmailProps {
  primeiroNome: string;
  organizacaoNome: string;
  protocolo: string;
  dataEnvio: string;
  identidadeEnviada: boolean;
  enderecoEnviado: boolean;
}

export function CadastroRecebidoEmail({
  primeiroNome,
  organizacaoNome,
  protocolo,
  dataEnvio,
  identidadeEnviada,
  enderecoEnviado,
}: CadastroRecebidoEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{`Cadastro recebido com sucesso — Protocolo: ${protocolo}`}</Preview>
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
          <div style={{ marginBottom: "20px" }}>
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

          <Heading as="h2" style={{ fontSize: "19px", color: "#0A0F0D", marginTop: 0, marginBottom: "12px" }}>
            Cadastro recebido com sucesso!
          </Heading>

          <Text style={{ color: "#334155", lineHeight: "1.6", fontSize: "15px", margin: "0 0 16px 0" }}>
            Olá, <strong>{primeiroNome}</strong>! Seus dados cadastrais e documentos foram
            recebidos com segurança pela coordenação de <strong>{organizacaoNome}</strong>.
          </Text>

          {/* Box de Comprovante e Protocolo */}
          <div
            style={{
              backgroundColor: "#F8FAF9",
              border: "1px solid #CBD5E1",
              borderRadius: "6px",
              padding: "18px",
              margin: "20px 0",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: "bold",
                color: "#1FA871",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "12px",
              }}
            >
              Comprovante de Envio de Documentos
            </div>

            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 0", color: "#64748B" }}>Protocolo:</td>
                  <td style={{ padding: "4px 0", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", color: "#0A0F0D" }}>
                    {protocolo}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0", color: "#64748B" }}>Data/Hora de Envio:</td>
                  <td style={{ padding: "4px 0", textAlign: "right", color: "#0A0F0D" }}>
                    {dataEnvio}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0", color: "#64748B" }}>Status dos Dados:</td>
                  <td style={{ padding: "4px 0", textAlign: "right", color: "#1FA871", fontWeight: "600" }}>
                    Recebidos com sucesso
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0", color: "#64748B" }}>Documento de Identidade:</td>
                  <td style={{ padding: "4px 0", textAlign: "right", color: identidadeEnviada ? "#1FA871" : "#D97706", fontWeight: "600" }}>
                    {identidadeEnviada ? "✓ Recebido" : "Pendente"}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: "4px 0", color: "#64748B" }}>Comprovante de Residência:</td>
                  <td style={{ padding: "4px 0", textAlign: "right", color: enderecoEnviado ? "#1FA871" : "#64748B", fontWeight: "600" }}>
                    {enderecoEnviado ? "✓ Recebido" : "Não enviado"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Próximos Passos */}
          <div style={{ marginTop: "20px", marginBottom: "20px" }}>
            <Text style={{ fontSize: "14px", fontWeight: "bold", color: "#0A0F0D", marginBottom: "8px" }}>
              Próximos passos:
            </Text>
            <Text style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6", margin: "0 0 8px 0" }}>
              1. <strong>Conferência Técnica:</strong> A coordenação efetuará a triagem dos dados e documentos enviados para validar a regularidade cadastral.
            </Text>
            <Text style={{ fontSize: "13px", color: "#475569", lineHeight: "1.6", margin: "0" }}>
              2. <strong>Emissão do Contrato:</strong> Após a conferência, seu contrato de prestação de serviços será gerado e enviado por e-mail com link exclusivo para assinatura eletrônica.
            </Text>
          </div>

          <Text
            style={{
              fontSize: "12px",
              color: "#94A3B8",
              lineHeight: "1.5",
              borderTop: "1px solid #E2E8F0",
              paddingTop: "16px",
              marginTop: "24px",
            }}
          >
            Guarde este e-mail para seus registros. O protocolo acima comprova o recebimento da sua documentação.
            <br />
            Ambiente Seguro e Auditado · Conforme Resolução TSE nº 23.607 e LGPD.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailCadastroRecebido(params: CadastroRecebidoEmailProps) {
  const elemento = <CadastroRecebidoEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return {
    subject: `Comprovante de Envio — Protocolo: ${params.protocolo} — ${params.organizacaoNome}`,
    html,
    text,
  };
}
