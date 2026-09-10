/**
 * E-mail de `contrato_assinado` — Confirmação de formalização e entrega da cópia do contrato assinado.
 * Regra 7: sem CPF/dados bancários no assunto — informa que a assinatura foi concluída com sucesso
 * e disponibiliza o link para conferência e download da via oficial em PDF.
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Text, render } from "react-email";

export interface ContratoAssinadoEmailProps {
  primeiroNome: string;
  objeto: string;
  dataAssinatura: string;
  urlContratoAssinado: string;
  urlDownloadPdf?: string;
  urlContato?: string;
}

export function ContratoAssinadoEmail({
  primeiroNome,
  objeto,
  dataAssinatura,
  urlContratoAssinado,
  urlDownloadPdf,
  urlContato,
}: ContratoAssinadoEmailProps) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>Seu contrato foi assinado com sucesso — Acesse sua via em PDF</Preview>
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

          <Heading as="h2" style={{ fontSize: "19px", color: "#0A0F0D", marginTop: 0 }}>
            Contrato Assinado com Sucesso, {primeiroNome}!
          </Heading>
          <Text style={{ color: "#0A0F0D", lineHeight: "1.5", fontSize: "15px" }}>
            A formalização do seu contrato de prestação de serviços referente à atividade de{" "}
            <strong>{objeto}</strong> foi concluída e arquivada com sucesso em{" "}
            <strong>{dataAssinatura}</strong>.
          </Text>

          <div
            style={{
              backgroundColor: "#F8FAF9",
              border: "1px solid #E2E8F0",
              borderRadius: "6px",
              padding: "16px",
              margin: "20px 0",
            }}
          >
            <Text
              style={{
                fontSize: "12px",
                fontWeight: "bold",
                color: "#1FA871",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                margin: "0 0 8px 0",
              }}
            >
              Comprovante de Formalização
            </Text>
            <Text style={{ fontSize: "14px", color: "#0A0F0D", margin: "4px 0" }}>
              <strong>Objeto:</strong> {objeto}
            </Text>
            <Text style={{ fontSize: "14px", color: "#0A0F0D", margin: "4px 0" }}>
              <strong>Data da Assinatura:</strong> {dataAssinatura}
            </Text>
            <Text style={{ fontSize: "13px", color: "#157F58", margin: "4px 0", fontWeight: "600" }}>
              ✓ Assinatura eletrônica, biometria facial e carimbo de tempo registrados.
            </Text>
          </div>

          <div style={{ margin: "28px 0", textAlign: "center" }}>
            <Link
              href={urlContratoAssinado}
              style={{
                backgroundColor: "#1FA871",
                color: "#ffffff",
                padding: "14px 28px",
                display: "inline-block",
                textDecoration: "none",
                fontWeight: "bold",
                borderRadius: "6px",
                fontSize: "15px",
                boxShadow: "0 2px 4px rgba(31,168,113,0.2)",
              }}
            >
              Visualizar e Baixar Cópia do Contrato (PDF) →
            </Link>
            <Text style={{ fontSize: "12px", color: "#52605B", marginTop: "12px" }}>
              Você pode acessar o documento assinado e fazer o download do PDF a qualquer momento pelo link acima.
            </Text>
            {urlDownloadPdf && (
              <Text style={{ fontSize: "12px", marginTop: "8px" }}>
                <Link href={urlDownloadPdf} style={{ color: "#157F58", textDecoration: "underline" }}>
                  Ou clique aqui para baixar o PDF diretamente
                </Link>
              </Text>
            )}
          </div>

          <div
            style={{
              backgroundColor: "#FFFBEB",
              border: "1px solid #FDE68A",
              borderRadius: "6px",
              padding: "12px",
              margin: "20px 0",
            }}
          >
            <Text style={{ fontSize: "12px", color: "#92400E", margin: 0, lineHeight: "1.4" }}>
              <strong>Guarda do Documento:</strong> Uma cópia deste contrato permanecerá arquivada no comitê para prestação de contas eleitorais. Recomendamos que você baixe e guarde sua via em PDF.
            </Text>
          </div>

          {urlContato && (
            <Text style={{ marginTop: "24px", borderTop: "1px solid #E2E8F0", paddingTop: "16px" }}>
              <Link href={urlContato} style={{ color: "#157F58", fontSize: "13px" }}>
                Acessar portal do Comitê Digital
              </Link>
            </Text>
          )}

          <Text
            style={{
              fontSize: "11px",
              color: "#8C9B94",
              marginTop: "20px",
              borderTop: "1px solid #E2E8F0",
              paddingTop: "14px",
              textAlign: "center",
            }}
          >
            Comitê Digital • Infraestrutura de Gestão Operacional e Eleitoral
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderizarEmailContratoAssinado(params: ContratoAssinadoEmailProps) {
  const elemento = <ContratoAssinadoEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return {
    subject: "Seu contrato foi assinado com sucesso",
    html,
    text,
  };
}
