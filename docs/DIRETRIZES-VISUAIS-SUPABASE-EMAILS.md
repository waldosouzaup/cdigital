# Diretrizes Visuais de E-mails no Supabase & Diagnóstico de Transmissões (Resend)

Este documento estabelece as diretrizes operacionais e visuais para garantir a estabilidade das transmissões de e-mail e a padronização estética de todas as mensagens emitidas pela infraestrutura do **Comitê Digital**, abrangendo:
1. **E-mails Transacionais da Aplicação via Resend API** (Acordos/Contratos, Rescisões/Distratos, Links de Coleta, Alertas);
2. **E-mails de Autenticação do Supabase Auth** (Convites de Equipe, Confirmação de Cadastro, Recuperação de Senha, Magic Links);
3. **Configuração de Custom SMTP no Supabase** utilizando o serviço Resend.

---

## 1. Diagnóstico de Estabilidade das Transmissões (Resend API)

### 1.1. Status da Conexão
- **Chave de API (`RESEND_API_KEY`)**: Configurada e validada com sucesso contra os servidores do Resend.
- **Domínio Remetente**:
  - Em ambientes de produção, o remetente configurado em `RESEND_FROM` **deve pertencer a um domínio devidamente registrado e verificado no Resend**.
  - **Causa raiz de falhas anteriores**: Quando o endereço de envio utiliza um domínio não verificado (ex.: `nao-responda@seudominio.com.br`), o Resend recusa o envio com status HTTP 403 (`validation_error: The ... domain is not verified`).
  - Para testes em desenvolvimento/homologação com a conta `apt.uplinux@gmail.com`, o Resend autoriza envios a partir de `onboarding@resend.dev` exclusivamente para o e-mail cadastrado da conta.

### 1.2. Procedimento para Verificação de Domínio no Resend
Para liberar o envio irrestrito para qualquer colaborador e integrante:
1. Acesse o painel do Resend em [resend.com/domains](https://resend.com/domains).
2. Clique em **Add Domain** e informe o domínio oficial da campanha (ex.: `comitedigital.org.br` ou `campanha.com.br`).
3. Adicione os seguintes registros DNS na zona do domínio (Cloudflare, Registro.br, etc.):
   - **DKIM**: Registro `CNAME` com nome `resend._domainkey` apontando para o valor indicado pelo Resend.
   - **SPF**: Registro `TXT` com nome `@` e valor `v=spf1 include:amazonses.com ~all`.
   - **DMARC**: Registro `TXT` com nome `_dmarc` e valor `v=DMARC1; p=none;`.
4. Após o status mudar para **Verified**, configure no arquivo `.env.local` e no painel de hospedagem:
   ```env
   RESEND_FROM="Comitê Digital <nao-responda@comitedigital.org.br>"
   ```

---

## 2. Configuração do Custom SMTP do Resend no Supabase

Por padrão, o Supabase utiliza um servidor SMTP compartilhado com limite rígido de 30 e-mails por hora e alto risco de entrega na pasta de Spam. Para garantir estabilidade e continuidade operacional:

1. Acesse o console do projeto no [Supabase Dashboard](https://supabase.com/dashboard/project/qedypaqsmmrhnpgnkrxq).
2. No menu lateral, navegue até **Project Settings** -> **Authentication**.
3. Role até a seção **SMTP Settings** e ative **Enable Custom SMTP**:
   - **Sender email**: `nao-responda@comitedigital.org.br` (ou o domínio verificado no Resend).
   - **Sender name**: `Comitê Digital`
   - **Host**: `smtp.resend.com`
   - **Port**: `465`
   - **Encryption**: `SSL` *(ou Port `587` com `TLS`)*
   - **User**: `resend`
   - **Password**: `[SUA_RESEND_API_KEY]` *(a mesma utilizada no `.env.local`)*
4. Clique em **Save Changes**.

---

## 3. Diretrizes Visuais dos Templates do Supabase Auth

Para garantir que os e-mails de autenticação mantenham a identidade cívica moderna e de alta confiabilidade do Comitê Digital, utilize os templates HTML responsivos abaixo.

### 3.1. Design System dos E-mails
- **Cor Primária (Verde Cívico)**: `#1FA871` (hover `#157F58`)
- **Fundo da Página**: `#F8FAF9`
- **Container do E-mail**: `#FFFFFF` com borda sólida de `1px solid #E2E8F0` e raio `8px`
- **Tipografia**: `Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- **Cor do Título**: `#0A0F0D` (preto carvão de alta legibilidade)
- **Texto Secundário / Apoio**: `#52605B`
- **Botão de Ação (CTA)**: Background `#1FA871`, texto `#FFFFFF`, padding `14px 28px`, bordas arredondadas `6px`, negrito.
- **Rodapé Institucional**: Informações de segurança, identificação da campanha e aviso de privacidade/LGPD.

---

### 3.2. Template 1: Convite de Integrante da Equipe (*Invite User*)

> **Caminho no Supabase**: `Authentication` -> `Email Templates` -> `Invite user`
> **Assunto sugerido**: `Você foi convidado para a equipe do Comitê Digital`

```html
<!DOCTYPE html>
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
          <!-- Cabeçalho / Marca -->
          <tr>
            <td style="padding-bottom: 24px; border-bottom: 1px solid #E2E8F0;">
              <div style="display: inline-block; background-color: #0A0F0D; border-radius: 6px; padding: 6px 12px;">
                <span style="color: #ffffff; font-weight: bold; font-size: 14px; letter-spacing: -0.02em;">COMITÊ<span style="color: #1FA871;">DIGITAL</span></span>
              </div>
            </td>
          </tr>
          <!-- Conteúdo -->
          <tr>
            <td style="padding-top: 24px;">
              <h2 style="font-size: 19px; color: #0A0F0D; margin: 0 0 12px 0; font-weight: 700;">Você foi convidado para a equipe</h2>
              <p style="color: #0A0F0D; font-size: 15px; line-height: 1.6; margin: 0 0 20px 0;">
                A coordenação do <strong>Comitê Digital</strong> concedeu acesso para você integrar a equipe operacional da campanha.
              </p>
              <p style="color: #52605B; font-size: 14px; line-height: 1.5; margin: 0 0 28px 0;">
                Clique no botão abaixo para aceitar o convite, definir sua senha de acesso e iniciar suas atividades no painel de gestão.
              </p>
              <!-- Botão CTA -->
              <div style="text-align: center; margin: 28px 0;">
                <a href="{{ .ConfirmationURL }}" style="background-color: #1FA871; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(31,168,113,0.2);">
                  Aceitar Convite e Acessar Painel →
                </a>
              </div>
              <p style="color: #8C9B94; font-size: 12px; line-height: 1.4; margin: 20px 0 0 0; text-align: center;">
                Este convite é individual e intransferível. Se o botão não funcionar, copie e cole o link no seu navegador:<br>
                <a href="{{ .ConfirmationURL }}" style="color: #157F58; word-break: break-all; font-size: 11px;">{{ .ConfirmationURL }}</a>
              </p>
            </td>
          </tr>
          <!-- Rodapé -->
          <tr>
            <td style="padding-top: 28px; border-top: 1px solid #E2E8F0; margin-top: 28px;">
              <p style="color: #8C9B94; font-size: 11px; line-height: 1.5; margin: 0; text-align: center;">
                Comitê Digital • Infraestrutura de Gestão Operacional e Eleitoral<br>
                Ambiente seguro em conformidade com as normas do TSE e a Lei Geral de Proteção de Dados (LGPD).
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

---

### 3.3. Template 2: Confirmação de Cadastro (*Confirm Signup*)

> **Caminho no Supabase**: `Authentication` -> `Email Templates` -> `Confirm signup`
> **Assunto sugerido**: `Confirme seu cadastro no Comitê Digital`

```html
<!DOCTYPE html>
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
                Obrigado por registrar sua conta no <strong>Comitê Digital</strong>. Para garantir a segurança e ativar seu acesso operacional, confirme seu e-mail.
              </p>
              <div style="text-align: center; margin: 28px 0;">
                <a href="{{ .ConfirmationURL }}" style="background-color: #1FA871; color: #ffffff; padding: 14px 28px; text-decoration: none; font-weight: bold; border-radius: 6px; font-size: 15px; display: inline-block;">
                  Confirmar E-mail e Ativar Conta →
                </a>
              </div>
              <p style="color: #8C9B94; font-size: 12px; line-height: 1.4; margin: 20px 0 0 0; text-align: center;">
                Se você não solicitou este cadastro, desconsidere esta mensagem.
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
</html>
```

---

### 3.4. Template 3: Recuperação de Senha (*Reset Password*)

> **Caminho no Supabase**: `Authentication` -> `Email Templates` -> `Reset password`
> **Assunto sugerido**: `Redefinição de senha de acesso - Comitê Digital`

```html
<!DOCTYPE html>
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
                  <strong>Aviso de Segurança:</strong> Este link é válido por tempo limitado. Se você não realizou esta solicitação, nenhuma ação é necessária e sua senha atual permanecerá inalterada.
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
</html>
```

---

### 3.5. Template 4: Link Mágico de Acesso (*Magic Link*)

> **Caminho no Supabase**: `Authentication` -> `Email Templates` -> `Magic link`
> **Assunto sugerido**: `Seu link de acesso direto - Comitê Digital`

```html
<!DOCTYPE html>
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
                Este link expira automaticamente após o primeiro uso ou por limite de tempo.
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
</html>
```

---

### 3.6. Template 5: Confirmação de Alteração de E-mail (*Change Email*)

> **Caminho no Supabase**: `Authentication` -> `Email Templates` -> `Change email address`
> **Assunto sugerido**: `Confirmação de novo endereço de e-mail - Comitê Digital`

```html
<!DOCTYPE html>
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
                Se você não solicitou esta alteração, entre em contato imediatamente com o administrador da sua organização.
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
</html>
```

---

## 4. Monitoramento e Reprocessamento de Mensagens

1. **Tabela `notificacoes`**: Todas as transmissões (contratos, distratos, avisos) registram status (`enfileirada`, `enviada`, `falhou`), destinatário, código de erro normalizado e chave de idempotência.
2. **Reprocessamento Automático**: Falhas transitórias são reprocessadas automaticamente a cada 15 minutos via endpoint cron `/api/cron/reprocessar-notificacoes` (até 3 tentativas).
3. **Painel de Controle em `/configuracoes?aba=comunicacoes`**: O administrador pode consultar o status em tempo real, testar transmissões imediatas e disparar o reprocessamento manual de qualquer notificação pendente.
