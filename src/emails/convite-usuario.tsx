/**
 * E-mail de `convite_usuario` — liberação de acesso ao painel com senha
 * temporária. É o único template que carrega credencial, então o aviso de troca
 * obrigatória fica em destaque próprio.
 * Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { BotaoEmail, CORES, CaixaEmail, LayoutEmail, TextoEmail, TextoMiudo } from "./layout";

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

/** Rótulo miúdo em caixa alta de um campo de credencial. */
function RotuloCredencial({ children }: { children: React.ReactNode }) {
  return (
    <TextoEmail
      style={{
        margin: "0 0 3px 0",
        fontSize: "11px",
        fontWeight: 700,
        color: CORES.tintaSuave,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </TextoEmail>
  );
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
    <LayoutEmail
      previa="Seu acesso ao Comitê Digital foi liberado — senha temporária de primeiro acesso"
      titulo={`Bem-vindo(a) à equipe, ${primeiroNome}!`}
    >
      <TextoEmail>
        Seu acesso ao sistema de gestão e governança da campanha foi criado. Você atuará com a
        função de <strong>{cargoFormatado}</strong>.
      </TextoEmail>

      <CaixaEmail titulo="Credenciais de primeiro acesso">
        <RotuloCredencial>E-mail de acesso</RotuloCredencial>
        <TextoEmail
          style={{
            margin: "0 0 14px 0",
            fontFamily: "monospace",
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {email}
        </TextoEmail>

        <RotuloCredencial>Senha temporária</RotuloCredencial>
        <TextoEmail style={{ margin: 0 }}>
          <span
            style={{
              display: "inline-block",
              fontFamily: "monospace",
              fontSize: "16px",
              fontWeight: 700,
              color: CORES.primariaEscura,
              backgroundColor: CORES.tinta5,
              border: "1px solid #BFE8D0",
              borderRadius: "4px",
              padding: "5px 10px",
              letterSpacing: "0.04em",
            }}
          >
            {senhaTemporaria}
          </span>
        </TextoEmail>
      </CaixaEmail>

      <CaixaEmail tom="atencao" titulo="⚠️ Troca imediata obrigatória">
        <TextoEmail style={{ margin: 0, fontSize: "13px", color: CORES.atencaoTinta }}>
          Por política de segurança e governança de dados, esta credencial provisória serve apenas
          ao primeiro acesso.{" "}
          <strong>Altere-a assim que entrar na plataforma.</strong>
        </TextoEmail>
      </CaixaEmail>

      <BotaoEmail href={urlLogin}>Acessar o painel do Comitê Digital</BotaoEmail>

      <TextoMiudo>
        Se você não esperava este convite, fale com a coordenação de campanha. Nunca compartilhe sua
        senha.
      </TextoMiudo>
    </LayoutEmail>
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
