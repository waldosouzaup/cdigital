/**
 * Casca institucional dos e-mails do Comitê Digital.
 *
 * Os doze templates nasceram cada um por conta própria: seis eram texto cru sem
 * nenhuma marca, seis repetiam cabeçalho, botão e rodapé com valores de cor
 * digitados à mão e já divergentes entre si. Tudo que é moldura passou a morar
 * aqui — cada template cuida só do que tem a dizer.
 *
 * A marca é desenhada em HTML/CSS, não em <img>: Gmail, Outlook e Apple Mail
 * bloqueiam imagem remota por padrão, e um logo que some é pior que um logo
 * desenhado. Também dispensa `APP_URL` — que nem sempre está configurada.
 *
 * Tudo é estilo inline porque cliente de e-mail ignora <style> e classe.
 */
import * as React from "react";
import { Body, Container, Head, Heading, Html, Link, Preview, Section, Text } from "react-email";

/** Tokens do DESIGN-SYSTEM.md, na variante clara — e-mail não tem tema escuro. */
export const CORES = {
  tinta: "#0A0F0D",
  tintaSuave: "#52605B",
  tintaTenue: "#8A98A0",
  primaria: "#1FA871",
  primariaEscura: "#157F58",
  primariaClara: "#2FBF83",
  lima: "#C4D830",
  emblema: "#0C1512",
  papel: "#FFFFFF",
  fundo: "#F1F5F3",
  fundoSuave: "#F8FAF9",
  tinta5: "#E9F5EE",
  linha: "#E2E8F0",
  atencaoFundo: "#FFFBEB",
  atencaoBorda: "#FDE68A",
  atencaoTinta: "#92400E",
  erroFundo: "#FEF2F2",
  erroBorda: "#FECACA",
  erroTinta: "#991B1B",
} as const;

const FONTE =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

export type TomCaixa = "neutro" | "positivo" | "atencao" | "critico";

/** Marca oficial: ladrilho escuro com `cd` + ponto lima, e o nome ao lado. */
function Marca() {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ borderCollapse: "collapse" }}>
      <tbody>
        <tr>
          <td style={{ verticalAlign: "middle", paddingRight: "10px" }}>
            <table role="presentation" cellPadding={0} cellSpacing={0}>
              <tbody>
                <tr>
                  <td
                    style={{
                      backgroundColor: CORES.emblema,
                      borderRadius: "9px",
                      height: "38px",
                      width: "38px",
                      textAlign: "center",
                      verticalAlign: "middle",
                      fontFamily: FONTE,
                      fontSize: "16px",
                      fontWeight: 700,
                      color: CORES.papel,
                      letterSpacing: "-0.02em",
                    }}
                  >
                    cd<span style={{ color: CORES.lima }}>.</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
          <td style={{ verticalAlign: "middle" }}>
            <div
              style={{
                fontFamily: FONTE,
                fontSize: "15px",
                fontWeight: 700,
                color: CORES.tinta,
                lineHeight: "1.1",
                letterSpacing: "-0.01em",
              }}
            >
              comitê <span style={{ color: CORES.primaria }}>digital</span>
            </div>
            <div
              style={{
                fontFamily: FONTE,
                fontSize: "9px",
                color: CORES.tintaTenue,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                paddingTop: "3px",
              }}
            >
              Sistema de Gestão
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function LayoutEmail({
  previa,
  titulo,
  children,
  urlPortal,
  rotuloPortal = "Acessar o portal do Comitê Digital",
}: {
  previa: string;
  titulo: string;
  children: React.ReactNode;
  urlPortal?: string;
  rotuloPortal?: string;
}) {
  return (
    <Html lang="pt-BR">
      <Head />
      <Preview>{previa}</Preview>
      <Body
        style={{
          fontFamily: FONTE,
          backgroundColor: CORES.fundo,
          margin: 0,
          padding: "28px 16px",
        }}
      >
        <Container
          style={{
            backgroundColor: CORES.papel,
            maxWidth: "560px",
            margin: "0 auto",
            borderRadius: "12px",
            border: `1px solid ${CORES.linha}`,
            overflow: "hidden",
          }}
        >
          {/* Fio superior verde: assinatura visual da marca no topo de todo aviso. */}
          <div style={{ height: "4px", backgroundColor: CORES.primaria, lineHeight: "4px" }}>
            &nbsp;
          </div>

          <Section style={{ padding: "24px 28px 0 28px" }}>
            <Marca />
          </Section>

          <Section style={{ padding: "20px 28px 4px 28px" }}>
            <Heading
              as="h1"
              style={{
                fontSize: "20px",
                lineHeight: "1.3",
                color: CORES.tinta,
                fontWeight: 700,
                margin: 0,
                letterSpacing: "-0.01em",
              }}
            >
              {titulo}
            </Heading>
          </Section>

          <Section style={{ padding: "0 28px 24px 28px" }}>{children}</Section>

          <Section
            style={{
              padding: "18px 28px 22px 28px",
              backgroundColor: CORES.fundoSuave,
              borderTop: `1px solid ${CORES.linha}`,
            }}
          >
            {urlPortal && (
              <Text style={{ margin: "0 0 10px 0", fontSize: "13px" }}>
                <Link
                  href={urlPortal}
                  style={{ color: CORES.primariaEscura, fontWeight: 600, textDecoration: "none" }}
                >
                  {rotuloPortal} →
                </Link>
              </Text>
            )}
            <Text
              style={{
                margin: 0,
                fontSize: "11px",
                lineHeight: "1.6",
                color: CORES.tintaTenue,
              }}
            >
              <strong style={{ color: CORES.tintaSuave }}>Comitê Digital</strong> · Infraestrutura
              de gestão operacional e eleitoral.
              <br />
              Mensagem automática — não responda a este endereço.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** Parágrafo padrão do corpo. */
export function TextoEmail({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <Text
      style={{
        fontSize: "15px",
        lineHeight: "1.6",
        color: CORES.tinta,
        margin: "0 0 14px 0",
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

/** Observação secundária, menor e em cinza. */
export function TextoMiudo({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: "12px", lineHeight: "1.6", color: CORES.tintaSuave, margin: "0 0 10px 0" }}>
      {children}
    </Text>
  );
}

/** Chamada principal. Tabela em vez de <a> estilizado por causa do Outlook. */
export function BotaoEmail({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <table role="presentation" cellPadding={0} cellSpacing={0} style={{ margin: "20px 0" }}>
      <tbody>
        <tr>
          <td
            style={{
              backgroundColor: CORES.primaria,
              borderRadius: "8px",
              textAlign: "center",
            }}
          >
            <Link
              href={href}
              style={{
                display: "inline-block",
                padding: "13px 26px",
                fontFamily: FONTE,
                fontSize: "15px",
                fontWeight: 700,
                color: CORES.papel,
                textDecoration: "none",
              }}
            >
              {children}
            </Link>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const TONS: Record<TomCaixa, { fundo: string; borda: string; tinta: string }> = {
  neutro: { fundo: CORES.fundoSuave, borda: CORES.linha, tinta: CORES.tinta },
  positivo: { fundo: CORES.tinta5, borda: "#BFE8D0", tinta: CORES.primariaEscura },
  atencao: { fundo: CORES.atencaoFundo, borda: CORES.atencaoBorda, tinta: CORES.atencaoTinta },
  critico: { fundo: CORES.erroFundo, borda: CORES.erroBorda, tinta: CORES.erroTinta },
};

/** Bloco destacado: resumo de dados, alerta de prazo, aviso de guarda. */
export function CaixaEmail({
  titulo,
  tom = "neutro",
  children,
}: {
  titulo?: string;
  tom?: TomCaixa;
  children: React.ReactNode;
}) {
  const cores = TONS[tom];
  return (
    <Section
      style={{
        backgroundColor: cores.fundo,
        border: `1px solid ${cores.borda}`,
        borderRadius: "8px",
        padding: "14px 16px",
        margin: "16px 0",
      }}
    >
      {titulo && (
        <Text
          style={{
            fontSize: "11px",
            fontWeight: 700,
            color: cores.tinta,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            margin: "0 0 8px 0",
          }}
        >
          {titulo}
        </Text>
      )}
      {children}
    </Section>
  );
}

/** Par rótulo/valor dentro de uma CaixaEmail. */
export function LinhaDado({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  return (
    <Text style={{ fontSize: "14px", color: CORES.tinta, margin: "3px 0", lineHeight: "1.5" }}>
      <strong style={{ color: CORES.tintaSuave, fontWeight: 600 }}>{rotulo}:</strong> {valor}
    </Text>
  );
}
