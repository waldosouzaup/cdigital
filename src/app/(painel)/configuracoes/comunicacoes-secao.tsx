"use client";

import { useState } from "react";
import type { MetricasComunicacao } from "./dados";
import { testarTransmissaoEmail, reprocessarFalhasTransmissao } from "./acoes";

const TEMPLATES_SUPABASE = [
  {
    id: "invite",
    nome: "Convite de Integrante",
    subtitulo: "Disparado ao cadastrar um novo usuário na equipe administrativa",
    caminhoSupabase: "Authentication -> Email Templates -> Invite user",
    assunto: "Você foi convidado para a equipe do Comitê Digital",
    codigo: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Convite para o Comitê Digital</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAF9; margin: 0; padding: 32px 16px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 8px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #E2E8F0;">
              <div style="display: inline-block; background-color: #0A0F0D; border-radius: 6px; padding: 6px 12px;">
                <span style="color: #ffffff; font-weight: bold; font-size: 14px; letter-spacing: -0.02em;">COMITÊ<span style="color: #1FA871;">DIGITAL</span></span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px;">
              <h2 style="font-size: 19px; color: #0A0F0D; margin: 0 0 12px 0; font-weight: 700;">Você foi convidado para a equipe</h2>
              <p style="color: #0A0F0D; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                A coordenação do <strong>Comitê Digital</strong> concedeu acesso para você integrar a equipe operacional da campanha.
              </p>
              <p style="color: #52605B; font-size: 14px; line-height: 1.5; margin: 0 0 28px 0;">
                Clique no botão abaixo para aceitar o convite, definir sua senha de acesso e iniciar suas atividades no painel de gestão.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="{{ .ConfirmationURL }}" style="background-color: #1FA871; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(31,168,113,0.2);">
                  Aceitar Convite e Acessar Painel →
                </a>
              </div>
              <p style="color: #8C9B94; font-size: 12px; line-height: 1.4; margin: 20px 0 0 0; text-align: center;">
                Este convite é individual e intransferível. Se o botão não funcionar, copie e cole o link:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #157F58; word-break: break-all; font-size: 11px;">{{ .ConfirmationURL }}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 28px; border-top: 1px solid #E2E8F0; margin-top: 28px;">
              <p style="color: #8C9B94; font-size: 11px; line-height: 1.5; margin: 0; text-align: center;">
                Comitê Digital • Infraestrutura de Gestão Operacional e Eleitoral<br>
                Em conformidade com as normas do TSE e a Lei Geral de Proteção de Dados (LGPD).
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    id: "signup",
    nome: "Confirmação de Cadastro",
    subtitulo: "Enviado para confirmação de e-mail ao criar uma conta no sistema",
    caminhoSupabase: "Authentication -> Email Templates -> Confirm signup",
    assunto: "Confirme seu cadastro no Comitê Digital",
    codigo: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirmação de Cadastro</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAF9; margin: 0; padding: 32px 16px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 8px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #E2E8F0;">
              <div style="display: inline-block; background-color: #0A0F0D; border-radius: 6px; padding: 6px 12px;">
                <span style="color: #ffffff; font-weight: bold; font-size: 14px; letter-spacing: -0.02em;">COMITÊ<span style="color: #1FA871;">DIGITAL</span></span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px;">
              <h2 style="font-size: 19px; color: #0A0F0D; margin: 0 0 12px 0; font-weight: 700;">Confirme seu endereço de e-mail</h2>
              <p style="color: #0A0F0D; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Obrigado por registrar sua conta no <strong>Comitê Digital</strong>. Para ativar seu acesso com segurança, confirme seu e-mail.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="{{ .ConfirmationURL }}" style="background-color: #1FA871; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 15px; display: inline-block;">
                  Confirmar E-mail e Ativar Conta →
                </a>
              </div>
              <p style="color: #8C9B94; font-size: 12px; line-height: 1.4; margin: 20px 0 0 0; text-align: center;">
                Se você não solicitou este cadastro, por gentileza desconsidere esta mensagem.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 28px; border-top: 1px solid #E2E8F0; margin-top: 28px;">
              <p style="color: #8C9B94; font-size: 11px; line-height: 1.5; margin: 0; text-align: center;">
                Comitê Digital • Sistema de Gestão Eleitoral e Mobilização
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    id: "recovery",
    nome: "Recuperação de Senha",
    subtitulo: "Enviado quando o usuário solicita redefinição de sua senha",
    caminhoSupabase: "Authentication -> Email Templates -> Reset password",
    assunto: "Redefinição de senha de acesso - Comitê Digital",
    codigo: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Redefinição de Senha</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAF9; margin: 0; padding: 32px 16px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 8px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #E2E8F0;">
              <div style="display: inline-block; background-color: #0A0F0D; border-radius: 6px; padding: 6px 12px;">
                <span style="color: #ffffff; font-weight: bold; font-size: 14px; letter-spacing: -0.02em;">COMITÊ<span style="color: #1FA871;">DIGITAL</span></span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px;">
              <h2 style="font-size: 19px; color: #0A0F0D; margin: 0 0 12px 0; font-weight: 700;">Solicitação de Redefinição de Senha</h2>
              <p style="color: #0A0F0D; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Recebemos uma solicitação para redefinir a sua senha de acesso ao painel do <strong>Comitê Digital</strong>.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="{{ .ConfirmationURL }}" style="background-color: #1FA871; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 15px; display: inline-block;">
                  Redefinir Minha Senha →
                </a>
              </div>
              <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 6px; padding: 12px; margin-top: 20px;">
                <p style="color: #92400E; font-size: 12px; line-height: 1.4; margin: 0;">
                  <strong>Aviso de Segurança:</strong> Este link é válido por tempo limitado. Se você não realizou este pedido, sua senha atual permanecerá inalterada.
                </p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 28px; border-top: 1px solid #E2E8F0; margin-top: 28px;">
              <p style="color: #8C9B94; font-size: 11px; line-height: 1.5; margin: 0; text-align: center;">
                Comitê Digital • Segurança e Controle de Acessos
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    id: "magic_link",
    nome: "Link Mágico de Acesso",
    subtitulo: "Enviado para login sem senha através de link direto temporário",
    caminhoSupabase: "Authentication -> Email Templates -> Magic link",
    assunto: "Seu link de acesso direto - Comitê Digital",
    codigo: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acesso Direto</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAF9; margin: 0; padding: 32px 16px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 8px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #E2E8F0;">
              <div style="display: inline-block; background-color: #0A0F0D; border-radius: 6px; padding: 6px 12px;">
                <span style="color: #ffffff; font-weight: bold; font-size: 14px; letter-spacing: -0.02em;">COMITÊ<span style="color: #1FA871;">DIGITAL</span></span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px;">
              <h2 style="font-size: 19px; color: #0A0F0D; margin: 0 0 12px 0; font-weight: 700;">Acesso Rápido ao Painel</h2>
              <p style="color: #0A0F0D; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Utilize o botão abaixo para entrar diretamente no sistema sem necessidade de digitar senha.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="{{ .ConfirmationURL }}" style="background-color: #1FA871; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 15px; display: inline-block;">
                  Entrar no Comitê Digital →
                </a>
              </div>
              <p style="color: #8C9B94; font-size: 12px; line-height: 1.4; margin: 20px 0 0 0; text-align: center;">
                Este link expira automaticamente após o primeiro uso ou por tempo limite.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 28px; border-top: 1px solid #E2E8F0; margin-top: 28px;">
              <p style="color: #8C9B94; font-size: 11px; line-height: 1.5; margin: 0; text-align: center;">
                Comitê Digital • Infraestrutura de Gestão Eleitoral
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    id: "change_email",
    nome: "Alteração de E-mail",
    subtitulo: "Enviado para validar o novo endereço ao alterar e-mail de acesso",
    caminhoSupabase: "Authentication -> Email Templates -> Change email address",
    assunto: "Confirmação de novo endereço de e-mail - Comitê Digital",
    codigo: `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alteração de E-mail</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAF9; margin: 0; padding: 32px 16px;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border-radius: 8px; border: 1px solid #E2E8F0; padding: 32px; box-shadow: 0 1px 3px rgba(0,0,0,0.04);">
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #E2E8F0;">
              <div style="display: inline-block; background-color: #0A0F0D; border-radius: 6px; padding: 6px 12px;">
                <span style="color: #ffffff; font-weight: bold; font-size: 14px; letter-spacing: -0.02em;">COMITÊ<span style="color: #1FA871;">DIGITAL</span></span>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 24px;">
              <h2 style="font-size: 19px; color: #0A0F0D; margin: 0 0 12px 0; font-weight: 700;">Confirmação de Alteração de E-mail</h2>
              <p style="color: #0A0F0D; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                Uma alteração de endereço de e-mail foi solicitada para sua conta no <strong>Comitê Digital</strong>.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="{{ .ConfirmationURL }}" style="background-color: #1FA871; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 15px; display: inline-block;">
                  Confirmar Novo E-mail →
                </a>
              </div>
              <p style="color: #8C9B94; font-size: 12px; line-height: 1.4; margin: 20px 0 0 0; text-align: center;">
                Se você não solicitou esta alteração, entre em contato imediatamente com a coordenação.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top: 28px; border-top: 1px solid #E2E8F0; margin-top: 28px;">
              <p style="color: #8C9B94; font-size: 11px; line-height: 1.5; margin: 0; text-align: center;">
                Comitê Digital • Segurança e Conformidade
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
];

export function ComunicacoesSecao({
  metricas,
}: {
  metricas: MetricasComunicacao;
}) {
  const [templateAtivo, setTemplateAtivo] = useState(TEMPLATES_SUPABASE[0].id);
  const [copiado, setCopiado] = useState(false);

  // Estados de teste e reprocessamento
  const [emailTeste, setEmailTeste] = useState("");
  const [enviandoTeste, setEnviandoTeste] = useState(false);
  const [resultadoTeste, setResultadoTeste] = useState<{
    ok: boolean;
    mensagem: string;
  } | null>(null);

  const [reprocessando, setReprocessando] = useState(false);
  const [resultadoReprocessamento, setResultadoReprocessamento] = useState<{
    ok: boolean;
    mensagem: string;
  } | null>(null);

  const templateAtual =
    TEMPLATES_SUPABASE.find((t) => t.id === templateAtivo) ??
    TEMPLATES_SUPABASE[0];

  async function handleCopiarCodigo() {
    try {
      await navigator.clipboard.writeText(templateAtual.codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      alert("Não foi possível copiar para a área de transferência.");
    }
  }

  async function handleTestarEnvio(e: React.FormEvent) {
    e.preventDefault();
    if (!emailTeste.trim()) return;

    setEnviandoTeste(true);
    setResultadoTeste(null);

    const res = await testarTransmissaoEmail(emailTeste);
    setResultadoTeste({
      ok: res.ok,
      mensagem: res.mensagem,
    });
    setEnviandoTeste(false);
  }

  async function handleReprocessar() {
    setReprocessando(true);
    setResultadoReprocessamento(null);

    const res = await reprocessarFalhasTransmissao();
    setResultadoReprocessamento({
      ok: res.ok,
      mensagem: res.mensagem,
    });
    setReprocessando(false);
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho da Seção */}
      <div className="flex flex-col gap-1 border-b border-border pb-4">
        <h2 className="text-xl font-bold text-ink">
          Comunicações, Transmissões e Diretrizes Visuais
        </h2>
        <p className="text-sm text-ink-muted">
          Gerencie a estabilidade das transmissões automatizadas via API Resend
          (formalização de contratos, rescisões e avisos) e estruture as diretrizes visuais dos e-mails no Supabase Auth.
        </p>
      </div>

      {/* Grid: Status da Integração & Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Status da API */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
                API Resend
              </span>
              {metricas.apiKeyConfigurada ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Operacional
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600">
                  Não configurada
                </span>
              )}
            </div>
            <h3 className="mt-3 text-lg font-bold text-ink truncate">
              {metricas.remetenteConfigurado}
            </h3>
            <p className="mt-1 text-xs text-ink-muted">
              Endereço remetente configurado para mensagens de formalização.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-border/60 text-xs text-ink-muted flex items-center justify-between">
            <span>APP_URL:</span>
            <code className="text-ink font-mono text-[11px]">
              {metricas.appUrl}
            </code>
          </div>
        </div>

        {/* Card 2: Contadores de Transmissão */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Transmissões Registradas
            </span>
            <span className="text-xs text-ink-muted">Banco de Dados</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-lg bg-emerald-500/10 p-3 text-center">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {metricas.totalEnviadas}
              </div>
              <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
                Enviadas
              </div>
            </div>
            <div className="rounded-lg bg-red-500/10 p-3 text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {metricas.totalFalhas}
              </div>
              <div className="text-[11px] font-medium text-red-700 dark:text-red-300">
                Falhas
              </div>
            </div>
            <div className="rounded-lg bg-blue-500/10 p-3 text-center">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {metricas.totalEnfileiradas}
              </div>
              <div className="text-[11px] font-medium text-blue-700 dark:text-blue-300">
                Fila
              </div>
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-border/60 text-xs text-ink-muted">
            Reprocessamento automático ativo via cron a cada 15 min.
          </div>
        </div>

        {/* Card 3: Ações Rápidas de Contingência */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs flex flex-col justify-between">
          <div>
            <span className="text-xs font-semibold text-ink-muted uppercase tracking-wider">
              Contingência &amp; Retentativa
            </span>
            <h4 className="mt-2 text-sm font-bold text-ink">
              Reprocessamento Manual
            </h4>
            <p className="mt-1 text-xs text-ink-muted">
              Dispara o reprocessamento imediato de todas as mensagens em estado de falha (até 3 tentativas).
            </p>
          </div>
          <div className="mt-4">
            <button
              onClick={handleReprocessar}
              disabled={reprocessando || metricas.totalFalhas === 0}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reprocessando ? (
                <>
                  <span className="size-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Reprocessando...
                </>
              ) : (
                <>
                  <span>🔄</span>
                  Reprocessar Falhas Pendentes
                </>
              )}
            </button>
            {resultadoReprocessamento && (
              <p
                className={`mt-2 text-[11px] font-medium ${resultadoReprocessamento.ok ? "text-emerald-600" : "text-red-600"}`}
              >
                {resultadoReprocessamento.mensagem}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Alerta Operacional: Requisito de Verificação de Domínio no Resend */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 text-ink-muted text-xs leading-relaxed">
        <div className="flex items-center gap-2 text-ink font-semibold text-sm mb-1">
          <span>🛡️</span>
          <span>Diretriz Crítica de Transmissão: Verificação de Domínio no Resend</span>
        </div>
        <p>
          O serviço Resend exige que o domínio do remetente (ex.: <code className="text-ink font-mono">@comitedigital.org.br</code>) seja verificado via DNS (registros DKIM, SPF e DMARC) no painel do{" "}
          <a
            href="https://resend.com/domains"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-bold hover:underline"
          >
            resend.com/domains
          </a>.
          Se o remetente utilizar um domínio não verificado, as transmissões para destinatários externos serão bloqueadas com status HTTP 403 (<code className="text-ink font-mono">domain_not_verified</code>).
        </p>
      </div>

      {/* Card de Teste de Transmissão em Tempo Real */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
        <h3 className="text-base font-bold text-ink">
          Validar Estabilidade da Transmissão (Disparo de Teste)
        </h3>
        <p className="mt-1 text-xs text-ink-muted">
          Envie um e-mail transacional de teste através da API do Resend para certificar a conectividade e entrega.
        </p>

        <form onSubmit={handleTestarEnvio} className="mt-4 flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            value={emailTeste}
            onChange={(e) => setEmailTeste(e.target.value)}
            placeholder="Digite o e-mail de destino para o teste..."
            required
            className="flex-1 rounded-lg border border-border bg-canvas px-3.5 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            disabled={enviandoTeste || !emailTeste.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enviandoTeste ? (
              <>
                <span className="size-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Disparando teste...
              </>
            ) : (
              <>
                <span>✉️</span>
                Enviar E-mail de Teste
              </>
            )}
          </button>
        </form>

        {resultadoTeste && (
          <div
            className={`mt-4 rounded-lg p-3.5 text-xs font-medium border ${
              resultadoTeste.ok
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                : "bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-300"
            }`}
          >
            {resultadoTeste.mensagem}
          </div>
        )}
      </div>

      {/* Card: Histórico Recente de Transmissões */}
      {metricas.ultimasNotificacoes.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-ink">
              Últimas Notificações Registradas
            </h3>
            <span className="text-xs text-ink-muted">
              Histórico com Idempotência
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-ink">
              <thead>
                <tr className="border-b border-border text-ink-muted">
                  <th className="py-2.5 px-3 font-semibold">Tipo</th>
                  <th className="py-2.5 px-3 font-semibold">Destinatário</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold">Tentativas</th>
                  <th className="py-2.5 px-3 font-semibold">Data</th>
                  <th className="py-2.5 px-3 font-semibold">Detalhe do Erro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {metricas.ultimasNotificacoes.map((n) => (
                  <tr key={n.id} className="hover:bg-canvas/50">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-ink">
                      {n.tipo}
                    </td>
                    <td className="py-2.5 px-3 font-medium truncate max-w-[200px]">
                      {n.destinatarioEmail}
                    </td>
                    <td className="py-2.5 px-3">
                      {n.status === "enviada" ? (
                        <span className="inline-flex rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Enviada
                        </span>
                      ) : n.status === "falhou" ? (
                        <span className="inline-flex rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                          Falhou
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                          {n.status}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-center text-ink-muted">
                      {n.tentativas}
                    </td>
                    <td className="py-2.5 px-3 text-ink-muted whitespace-nowrap">
                      {new Date(n.criadoEm).toLocaleString("pt-BR", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </td>
                    <td className="py-2.5 px-3 text-ink-muted text-[11px] truncate max-w-[250px]" title={n.erro ?? ""}>
                      {n.erro ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Card Principal: Diretrizes Visuais no Supabase (Auth Email Templates) */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center size-6 rounded-md bg-primary/10 text-primary text-xs font-bold">
              🎨
            </span>
            <h3 className="text-lg font-bold text-ink">
              Diretrizes Visuais no Supabase (Auth Email Templates)
            </h3>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Configure os modelos de e-mail de autenticação no painel do Supabase com o layout cívico oficial do Comitê Digital.
          </p>
        </div>

        {/* Guia Custom SMTP */}
        <div className="rounded-lg border border-border bg-canvas p-4 text-xs space-y-2">
          <div className="font-semibold text-ink flex items-center gap-1.5">
            <span>⚙️</span>
            <span>Como Configurar Custom SMTP no Supabase Dashboard:</span>
          </div>
          <ol className="list-decimal list-inside space-y-1 text-ink-muted">
            <li>Acesse o Supabase Dashboard em <strong>Project Settings</strong> &rarr; <strong>Authentication</strong>.</li>
            <li>Localize a seção <strong>SMTP Settings</strong> e ative <strong>Enable Custom SMTP</strong>.</li>
            <li>Preencha: Host: <code className="text-ink font-mono">smtp.resend.com</code>, Port: <code className="text-ink font-mono">465</code> (SSL), User: <code className="text-ink font-mono">resend</code>, Password: <code className="text-ink font-mono">[Sua API Key Resend]</code>.</li>
            <li>Sender Email: o mesmo remetente verificado do Comitê Digital.</li>
          </ol>
        </div>

        {/* Sub-abas dos Templates */}
        <div>
          <div className="flex flex-wrap gap-2 border-b border-border pb-2">
            {TEMPLATES_SUPABASE.map((t) => (
              <button
                key={t.id}
                onClick={() => setTemplateAtivo(t.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  templateAtivo === t.id
                    ? "bg-primary text-white shadow-xs"
                    : "bg-canvas text-ink-muted hover:bg-border/60 hover:text-ink"
                }`}
              >
                {t.nome}
              </button>
            ))}
          </div>

          {/* Área do Template Selecionado */}
          <div className="mt-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-ink">
                  {templateAtual.nome}
                </h4>
                <p className="text-xs text-ink-muted">
                  {templateAtual.subtitulo}
                </p>
                <p className="text-[11px] text-primary font-medium mt-0.5">
                  Local no Supabase: {templateAtual.caminhoSupabase}
                </p>
              </div>

              <button
                onClick={handleCopiarCodigo}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-hover shadow-xs"
              >
                {copiado ? (
                  <>
                    <span>✓</span>
                    <span>Copiado com sucesso!</span>
                  </>
                ) : (
                  <>
                    <span>📋</span>
                    <span>Copiar Código HTML</span>
                  </>
                )}
              </button>
            </div>

            {/* Assunto Recomendado */}
            <div className="rounded-lg border border-border bg-canvas p-3 text-xs flex items-center justify-between">
              <div>
                <span className="text-ink-muted font-medium">Assunto recomendado: </span>
                <span className="font-semibold text-ink">{templateAtual.assunto}</span>
              </div>
            </div>

            {/* Código HTML */}
            <div className="relative">
              <pre className="max-h-72 overflow-y-auto rounded-lg border border-border bg-slate-950 p-4 text-[11px] font-mono text-emerald-400 leading-relaxed select-all">
                {templateAtual.codigo}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
