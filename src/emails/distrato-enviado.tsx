/**
 * E-mail de `distrato_enviado` — rescisão contratual do integrante. Regra 7: sem
 * CPF ou dado bancário; informa a formalização, o período apurado e o valor
 * proporcional nos termos da legislação eleitoral.
 * Moldura institucional em `layout.tsx`.
 */
import * as React from "react";
import { render } from "react-email";
import { BotaoEmail, CORES, CaixaEmail, LayoutEmail, LinhaDado, TextoEmail, TextoMiudo } from "./layout";

export interface DistratoEnviadoEmailProps {
  primeiroNome: string;
  objeto: string;
  dataDistrato: string;
  periodoTrabalhado: string;
  valorProporcional: string;
  motivo?: string;
  /** Link da assinatura eletrônica. Ausente = rescisão conduzida no presencial. */
  urlAssinatura?: string;
  urlContato?: string;
}

export function DistratoEnviadoEmail({
  primeiroNome,
  objeto,
  dataDistrato,
  periodoTrabalhado,
  valorProporcional,
  motivo,
  urlAssinatura,
  urlContato,
}: DistratoEnviadoEmailProps) {
  return (
    <LayoutEmail
      previa={
        urlAssinatura
          ? "Seu termo de distrato está pronto para assinatura"
          : "Formalização do Termo de Distrato Contratual"
      }
      titulo={`Olá, ${primeiroNome}`}
      urlPortal={urlContato}
    >
      <TextoEmail>
        O <strong>Termo de Distrato / Rescisão</strong> do contrato de <strong>{objeto}</strong>{" "}
        foi emitido em <strong>{dataDistrato}</strong>
        {urlAssinatura ? " e está pronto para a sua assinatura." : " e registrado no sistema."}
      </TextoEmail>

      <CaixaEmail titulo="Resumo da rescisão">
        <LinhaDado rotulo="Período apurado" valor={periodoTrabalhado} />
        <LinhaDado
          rotulo="Valor proporcional calculado"
          valor={<strong style={{ color: CORES.primariaEscura }}>{valorProporcional}</strong>}
        />
        {motivo && <LinhaDado rotulo="Motivo informado" valor={motivo} />}
      </CaixaEmail>

      {urlAssinatura ? (
        <>
          <BotaoEmail href={urlAssinatura}>Ler e assinar o termo de distrato</BotaoEmail>

          <CaixaEmail tom="atencao">
            <TextoEmail style={{ margin: 0, fontSize: "13px", color: CORES.atencaoTinta }}>
              A rescisão só é considerada concluída depois da sua assinatura. O link vale por{" "}
              <strong>7 dias</strong> e é de uso pessoal — não repasse.
            </TextoEmail>
          </CaixaEmail>

          <TextoMiudo>
            Se o botão não funcionar, copie e cole este endereço no navegador: {urlAssinatura}
          </TextoMiudo>
        </>
      ) : (
        <TextoEmail style={{ fontSize: "13px", color: CORES.tintaSuave }}>
          O termo formal foi anexado e registrado pela coordenação em conformidade com as exigências
          de prestação de contas. Se precisar de uma cópia assinada ou de esclarecimentos, fale com a
          equipe administrativa.
        </TextoEmail>
      )}
    </LayoutEmail>
  );
}

export async function renderizarEmailDistratoEnviado(params: DistratoEnviadoEmailProps) {
  const elemento = <DistratoEnviadoEmail {...params} />;
  const [html, text] = await Promise.all([
    render(elemento),
    render(elemento, { plainText: true }),
  ]);

  return {
    subject: params.urlAssinatura
      ? "Assine o Termo de Distrato do seu contrato"
      : "Formalização do Termo de Distrato Contratual",
    html,
    text,
  };
}
