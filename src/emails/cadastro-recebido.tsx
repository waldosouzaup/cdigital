/**
 * E-mail de `cadastro_recebido` — comprovante de envio da autoinscrição pública.
 * É o único aviso que a pessoa recebe antes da triagem, então carrega protocolo,
 * o que foi recebido e o que vem a seguir.
 * Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { CORES, CaixaEmail, LayoutEmail, LinhaDado, TextoEmail, TextoMiudo } from "./layout";

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
    <LayoutEmail
      previa={`Cadastro recebido com sucesso — Protocolo: ${protocolo}`}
      titulo="Cadastro recebido com sucesso!"
    >
      <TextoEmail>
        Olá, <strong>{primeiroNome}</strong>! Seus dados cadastrais e documentos foram recebidos
        com segurança pela coordenação de <strong>{organizacaoNome}</strong>.
      </TextoEmail>

      <CaixaEmail tom="positivo" titulo="Comprovante de envio de documentos">
        <LinhaDado
          rotulo="Protocolo"
          valor={
            <strong style={{ fontFamily: "monospace", letterSpacing: "0.02em" }}>{protocolo}</strong>
          }
        />
        <LinhaDado rotulo="Data e hora do envio" valor={dataEnvio} />
        <LinhaDado
          rotulo="Documento de identidade"
          valor={
            <strong style={{ color: identidadeEnviada ? CORES.primariaEscura : CORES.atencaoTinta }}>
              {identidadeEnviada ? "✓ Recebido" : "Pendente"}
            </strong>
          }
        />
        <LinhaDado
          rotulo="Comprovante de residência"
          valor={
            <strong style={{ color: enderecoEnviado ? CORES.primariaEscura : CORES.tintaSuave }}>
              {enderecoEnviado ? "✓ Recebido" : "Não enviado"}
            </strong>
          }
        />
      </CaixaEmail>

      <TextoEmail style={{ fontWeight: 700, fontSize: "14px", margin: "18px 0 8px 0" }}>
        Próximos passos
      </TextoEmail>
      <TextoEmail style={{ fontSize: "13px", color: CORES.tintaSuave, margin: "0 0 8px 0" }}>
        <strong style={{ color: CORES.tinta }}>1. Conferência técnica.</strong> A coordenação faz a
        triagem dos dados e documentos para validar a regularidade cadastral.
      </TextoEmail>
      <TextoEmail style={{ fontSize: "13px", color: CORES.tintaSuave, margin: 0 }}>
        <strong style={{ color: CORES.tinta }}>2. Emissão do contrato.</strong> Depois da
        conferência, seu contrato é gerado e enviado por e-mail com link exclusivo para assinatura
        eletrônica.
      </TextoEmail>

      <TextoMiudo>
        Guarde este e-mail: o protocolo acima comprova o recebimento da sua documentação. Ambiente
        seguro e auditado, conforme a Resolução TSE nº 23.607 e a LGPD.
      </TextoMiudo>
    </LayoutEmail>
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
