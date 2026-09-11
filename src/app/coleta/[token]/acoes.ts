/**
 * Server Action do lado de quem RECEBE o link — sem sessão, sem organizacao_id no
 * JWT. Por isso não faz nenhuma leitura/escrita direta em tabela: chama a função
 * SECURITY DEFINER `enviar_dados_coleta` (migration 0005/0030), que revalida o token por
 * conta própria (não confia em nada que já foi checado na tela) antes de gravar.
 *
 * Ao concluir com sucesso, dispara notificação de confirmação e protocolo por e-mail.
 */
"use server";

import { createClient } from "@/lib/supabase/server";
import { criarClienteAdmin } from "@/lib/supabase/admin";
import { extrairMetadadosAuditoria } from "@/lib/auditoria/metadados-requisicao";
import { renderizarEmailCadastroRecebido } from "@/emails/cadastro-recebido";
import { sendNotification } from "@/lib/notificacoes/enviar";
import { idempotencyKey } from "@/lib/notificacoes/chave-idempotencia";
import { transporteEmailPadrao } from "@/lib/notificacoes/transporte-padrao";
import type { EstadoEnviarDadosColeta } from "./estado";

function campoOuNulo(formData: FormData, nome: string): string | null {
  const valor = formData.get(nome);
  return typeof valor === "string" && valor.trim() !== "" ? valor.trim() : null;
}

interface LinkColetaInfo {
  pessoa_id: string;
  organizacao_id: string;
  primeiro_nome: string;
  pessoa_email: string | null;
  organizacao_nome: string;
  expira_em: string;
}

export async function enviarDadosColeta(
  token: string,
  _estadoAnterior: EstadoEnviarDadosColeta,
  formData: FormData,
): Promise<EstadoEnviarDadosColeta> {
  const supabase = await createClient();
  const { ip, userAgent } = await extrairMetadadosAuditoria();

  // Obtém os dados do link e do colaborador antes de marcar como usado
  const { data: linkInfo } = await supabase
    .rpc("validar_link_coleta", { p_token: token })
    .maybeSingle<LinkColetaInfo>();

  const geoRaw = campoOuNulo(formData, "geolocalizacao");
  let geolocalizacao = null;
  if (geoRaw) {
    try {
      geolocalizacao = JSON.parse(geoRaw);
    } catch {
      // Ignora erro de parse
    }
  }

  const emailInformado = campoOuNulo(formData, "email");
  const emailFinal = emailInformado ?? linkInfo?.pessoa_email ?? null;

  const telefoneInformado = campoOuNulo(formData, "telefone");
  const bancoInformado = campoOuNulo(formData, "banco");
  const agenciaInformada = campoOuNulo(formData, "agencia");
  const contaInformada = campoOuNulo(formData, "conta");
  const chavePixInformada = campoOuNulo(formData, "chavePix");

  const { data, error } = await supabase.rpc("enviar_dados_coleta", {
    p_token: token,
    p_telefone: telefoneInformado,
    p_endereco: campoOuNulo(formData, "endereco"),
    p_cep: campoOuNulo(formData, "cep"),
    p_rg: campoOuNulo(formData, "rg"),
    p_data_nascimento: campoOuNulo(formData, "dataNascimento"),
    p_chave_pix: chavePixInformada,
    p_email: emailFinal,
    p_ip: ip,
    p_geolocalizacao: geolocalizacao,
    p_user_agent: userAgent,
    p_banco: bancoInformado,
    p_agencia: agenciaInformada,
    p_conta: contaInformada,
  });

  if (error) {
    // Regra 7: nada de stack trace/SQL cru para quem não tem login nem treinamento.
    return { status: "erro", mensagem: "Não foi possível enviar seus dados. Tente novamente." };
  }

  if (data !== true) {
    return {
      status: "erro",
      mensagem: "Este link já foi usado ou expirou. Peça um novo link à coordenação.",
    };
  }

  // Garante a gravação dos dados complementares de contato e bancários no cadastro
  if (linkInfo?.pessoa_id) {
    try {
      const admin = criarClienteAdmin();
      await admin
        .from("pessoas")
        .update({
          telefone: telefoneInformado ?? undefined,
          email: emailFinal ?? undefined,
          banco: bancoInformado ?? undefined,
          agencia: agenciaInformada ?? undefined,
          conta: contaInformada ?? undefined,
          chave_pix: chavePixInformada ?? undefined,
        })
        .eq("id", linkInfo.pessoa_id);
    } catch {
      // Prossegue para envio do e-mail de protocolo
    }
  }

  const protocolo = `REC-${token.slice(0, 8).toUpperCase()}`;

  // Dispara a notificação de confirmação por e-mail com protocolo
  if (linkInfo && emailFinal) {
    try {
      const admin = criarClienteAdmin();
      const { data: docs } = await admin
        .from("documentos")
        .select("tipo, expurgado_em")
        .eq("pessoa_id", linkInfo.pessoa_id)
        .is("expurgado_em", null);

      const identidadeEnviada = docs?.some((d) => d.tipo === "documento_identidade") ?? false;
      const enderecoEnviado = docs?.some((d) => d.tipo === "comprovante_endereco") ?? false;

      const dataEnvioFormatada = new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      }).format(new Date());

      const { subject, html, text } = await renderizarEmailCadastroRecebido({
        primeiroNome: linkInfo.primeiro_nome,
        organizacaoNome: linkInfo.organizacao_nome,
        protocolo,
        dataEnvio: dataEnvioFormatada,
        identidadeEnviada,
        enderecoEnviado,
      });

      await sendNotification({
        supabase: admin,
        transport: transporteEmailPadrao(),
        organizationId: linkInfo.organizacao_id,
        type: "cadastro_recebido",
        recipientEmail: emailFinal,
        entity: "pessoas",
        entityId: linkInfo.pessoa_id,
        idempotencyKey: idempotencyKey("cadastro_recebido", linkInfo.pessoa_id, token),
        subject,
        html,
        text,
      });
    } catch {
      // Falha no envio de notificação não impede a conclusão do cadastro
    }
  }

  return {
    status: "sucesso",
    emailEnviado: emailFinal ?? undefined,
    protocolo,
  };
}
