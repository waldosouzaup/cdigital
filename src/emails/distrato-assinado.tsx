/**
 * E-mail de `distrato_assinado` — confirma a rescisão concluída e entrega a via
 * assinada.
 *
 * Fecha o par de `distrato_enviado`: aquele pede a assinatura, este comprova que
 * ela aconteceu. Mesma função que `contrato_assinado` cumpre na entrada — quem
 * assina precisa sair com o documento na mão, não só com um aviso.
 *
 * Regra 7: sem CPF nem dado bancário. Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { Link, render } from "react-email";
import {
  BotaoEmail,
  CORES,
  CaixaEmail,
  LayoutEmail,
  LinhaDado,
  TextoEmail,
  TextoMiudo,
} from "./layout";

export interface DistratoAssinadoEmailProps {
  primeiroNome: string;
  objeto: string;
  dataAssinatura: string;
  periodoTrabalhado: string;
  valorProporcional: string;
  urlTermoAssinado: string;
  urlDownloadPdf?: string;
  urlContato?: string;
}

export function DistratoAssinadoEmail({
  primeiroNome,
  objeto,
  dataAssinatura,
  periodoTrabalhado,
  valorProporcional,
  urlTermoAssinado,
  urlDownloadPdf,
  urlContato,
}: DistratoAssinadoEmailProps) {
  return (
    <LayoutEmail
      previa="Distrato assinado — acesse sua via em PDF"
      titulo={`Distrato concluído, ${primeiroNome}`}
      urlPortal={urlContato}
    >
      <TextoEmail>
        Sua assinatura foi registrada e a rescisão do contrato de <strong>{objeto}</strong> está
        formalizada. Nada mais é necessário da sua parte.
      </TextoEmail>

      <CaixaEmail tom="positivo" titulo="Comprovante da rescisão">
        <LinhaDado rotulo="Objeto" valor={<strong>{objeto}</strong>} />
        <LinhaDado rotulo="Data da assinatura" valor={<strong>{dataAssinatura}</strong>} />
        <LinhaDado rotulo="Período apurado" valor={periodoTrabalhado} />
        <LinhaDado
          rotulo="Valor proporcional"
          valor={<strong style={{ color: CORES.primariaEscura }}>{valorProporcional}</strong>}
        />
        <TextoEmail
          style={{
            margin: "8px 0 0 0",
            fontSize: "13px",
            color: CORES.primariaEscura,
            fontWeight: 600,
          }}
        >
          ✓ Assinatura eletrônica, foto de identificação e carimbo de tempo registrados.
        </TextoEmail>
      </CaixaEmail>

      <BotaoEmail href={urlTermoAssinado}>Visualizar e baixar o termo assinado (PDF)</BotaoEmail>

      {urlDownloadPdf && (
        <TextoMiudo>
          <Link href={urlDownloadPdf} style={{ color: CORES.primariaEscura, fontWeight: 600 }}>
            Ou baixe o PDF diretamente
          </Link>
        </TextoMiudo>
      )}

      <CaixaEmail tom="atencao" titulo="Guarda do documento">
        <TextoEmail style={{ margin: 0, fontSize: "13px", color: CORES.atencaoTinta }}>
          Uma cópia permanece arquivada para prestação de contas. Recomendamos que você baixe e
          guarde a sua via — o link acima deixa de valer quando o prazo do documento expira.
        </TextoEmail>
      </CaixaEmail>
    </LayoutEmail>
  );
}

export async function renderizarEmailDistratoAssinado(params: DistratoAssinadoEmailProps) {
  const elemento = <DistratoAssinadoEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return {
    subject: "Distrato assinado — sua via em PDF",
    html,
    text,
  };
}
