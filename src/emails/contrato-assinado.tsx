/**
 * E-mail de `contrato_assinado` — confirmação da formalização e entrega da cópia.
 * Regra 7: sem CPF/dados bancários no assunto ou no corpo — informa que a
 * assinatura foi concluída e dá o link para conferência e download da via oficial.
 * Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import {
  BotaoEmail,
  CORES,
  CaixaEmail,
  LayoutEmail,
  LinhaDado,
  TextoEmail,
  TextoMiudo,
} from "./layout";
import { Link } from "react-email";

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
    <LayoutEmail
      previa="Seu contrato foi assinado com sucesso — acesse sua via em PDF"
      titulo={`Contrato assinado com sucesso, ${primeiroNome}!`}
      urlPortal={urlContato}
    >
      <TextoEmail>
        A formalização do seu contrato de prestação de serviços foi concluída e arquivada.
      </TextoEmail>

      <CaixaEmail tom="positivo" titulo="Comprovante de formalização">
        <LinhaDado rotulo="Objeto" valor={<strong>{objeto}</strong>} />
        <LinhaDado rotulo="Data da assinatura" valor={<strong>{dataAssinatura}</strong>} />
        <TextoEmail
          style={{ margin: "8px 0 0 0", fontSize: "13px", color: CORES.primariaEscura, fontWeight: 600 }}
        >
          ✓ Assinatura eletrônica, biometria facial e carimbo de tempo registrados.
        </TextoEmail>
      </CaixaEmail>

      <BotaoEmail href={urlContratoAssinado}>Visualizar e baixar o contrato (PDF)</BotaoEmail>

      {urlDownloadPdf && (
        <TextoMiudo>
          <Link href={urlDownloadPdf} style={{ color: CORES.primariaEscura, fontWeight: 600 }}>
            Ou baixe o PDF diretamente
          </Link>
        </TextoMiudo>
      )}

      <CaixaEmail tom="atencao" titulo="Guarda do documento">
        <TextoEmail style={{ margin: 0, fontSize: "13px", color: CORES.atencaoTinta }}>
          Uma cópia permanece arquivada no comitê para prestação de contas eleitorais.
          Recomendamos que você baixe e guarde a sua via em PDF.
        </TextoEmail>
      </CaixaEmail>
    </LayoutEmail>
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
