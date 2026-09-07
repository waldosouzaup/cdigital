# Acesso ao projeto — guia passo a passo

> Duas coisas diferentes, não confundir:
>
> 1. **Acesso ao painel do Supabase** — para quem administra/configura a infraestrutura
>    (você, ou quem for ajudar a destravar o hook agora).
> 2. **Acesso ao sistema Comitê Digital** — para gestor, coordenador de comitê,
>    coordenador de região (a aplicação em si, quando estiver no ar).
>
> Agora mesmo, o que está travando o trabalho é o **item 1**. O item 2 ainda não existe
> de verdade (ver a seção no final).

---

## 1. Acesso ao painel do Supabase (supabase.com/dashboard)

### Dados deste projeto

| Campo                    | Valor                                                         |
| ------------------------ | ------------------------------------------------------------- |
| Nome do projeto          | (o que você deu ao criar — verifique no dashboard)            |
| Referência (project ref) | `qedypaqsmmrhnpgnkrxq`                                        |
| URL da API               | `https://qedypaqsmmrhnpgnkrxq.supabase.co`                    |
| Link direto do painel    | `https://supabase.com/dashboard/project/qedypaqsmmrhnpgnkrxq` |

### Passo a passo para entrar

1. Acesse **https://supabase.com/dashboard**.
2. Se você já tem conta: faça login com o e-mail e senha (ou "Continue with GitHub",
   se foi assim que a conta foi criada). Se esqueceu a senha, use "Forgot your
   password?" na própria tela de login.
3. Se você **não tem conta ainda** e precisa de acesso: peça para quem criou o
   projeto (o "Owner" da organização no Supabase) te convidar — ver a seção
   "Convidar outra pessoa" abaixo. Você não consegue entrar num projeto que não é
   seu e para o qual não foi convidado.
4. Depois de logado, você cai na lista de organizações/projetos. Clique no projeto
   com a referência `qedypaqsmmrhnpgnkrxq` (ou entre direto pelo link acima).

### Convidar outra pessoa para o projeto

Quem já é **Owner** ou **Administrator** da organização no Supabase pode convidar:

1. No painel, vá em **Organization Settings** (ícone de engrenagem, ou o nome da
   organização no canto superior esquerdo → Settings) → **Team**.
2. Clique em **Invite a member**, digite o e-mail da pessoa.
3. Escolha o papel:
   - **Administrator** — para quem vai mexer em configuração (é o que precisamos
     agora, para habilitar o hook).
   - **Developer** — para quem só vai olhar dados/logs, sem mexer em configuração
     sensível.
   - **Read Only** — só visualização.
4. O convite chega por e-mail e vale por 24 horas. A pessoa convidada precisa ter
   (ou criar) uma conta no Supabase com aquele e-mail para aceitar.

### O que fazer assim que estiver logado — os 3 passos que faltam

Estes são os passos que destravam o restante do gate da Fase 1 (ver `PROGRESSO.md`):

**a) Habilitar o Custom Access Token Hook (o essencial, sem isso nada de RLS funciona
de verdade):**

1. No projeto, vá em **Authentication** (menu lateral) → **Hooks** (ou "Auth Hooks",
   dependendo da versão do painel).
2. Ative **Custom Access Token**.
3. Tipo: **Postgres Function**.
4. Schema: `public`.
5. Função: `custom_access_token_hook`.
6. Salve.

**b) Confirmar MFA por TOTP habilitado:**

1. **Authentication** → **MFA** (ou **Providers** → seção de MFA, dependendo da
   versão).
2. Confirme que **Authenticator App (TOTP)** está habilitado. Normalmente já vem
   habilitado por padrão — só confira.

**c) SMTP apontando para o Resend (pode ficar para depois, não bloqueia o gate):**

1. **Authentication** → **Emails** → **SMTP Settings**.
2. Host: `smtp.resend.com` · Porta: `587` · Usuário: `resend` · Senha: sua
   `RESEND_API_KEY` (a mesma que está no `.env.local`).

Depois de fazer o passo **(a)**, me avise — eu rodo os testes de isolamento (RLS) de
verdade e fechamos o gate da Fase 1.

### Se der erro ao entrar

- **"Invalid login credentials"** → confira o e-mail exato e resete a senha.
- **"You don't have access to this project"** → você não foi convidado ainda para
  esta organização; peça o convite (seção acima).
- **Convite expirado** → convites valem 24h; peça um novo.
- **Autenticação de dois fatores da sua própria conta Supabase** (diferente do TOTP
  do Comitê Digital) → é a segurança da SUA conta pessoal no Supabase, configurada
  em **Account Settings** de quem é dono daquela conta. Se você perdeu o segundo
  fator, use o link de recuperação que o Supabase oferece na tela de login.

---

## 2. Acesso ao sistema Comitê Digital (usuários finais)

**Isto ainda não está disponível.** Faltam, nesta ordem:

1. Fechar o gate da Fase 1 (este documento existe justamente para destravar o passo
   que falta: o hook).
2. Fase 2 construir o cadastro de pessoas/contratos.
3. Um lugar para a aplicação rodar publicamente (hoje ela só roda localmente, com
   `npm run dev`, na sua própria máquina de desenvolvimento) — isso é decisão de
   deploy, ainda não tomada, e não faz parte do PROMPT original.
4. Cada usuário (gestor, coord_comite, coord_regiao) precisar ser criado de fato —
   hoje não existe nenhum usuário real cadastrado, só os dados de teste do seed
   (Seção 11), que são pessoas e contratos fictícios, não contas de login.

Quando isso existir, o fluxo de acesso será (já construído no código, Tarefa 8):

1. Acessar a URL da aplicação → tela **Entrar**.
2. Digitar o e-mail cadastrado → clicar em **Enviar link de acesso**.
3. Abrir o e-mail recebido e clicar no link (login sem senha, "link mágico").
4. Se for a primeira vez de um **gestor** ou **coordenador de comitê**: tela de
   cadastro de verificação em duas etapas — escanear o QR code com um app
   autenticador (Google Authenticator, Authy) e digitar o código de 6 dígitos.
   Nas próximas vezes, só digitar o código.
5. Cair no painel, já dentro da própria organização — RLS garante que ninguém vê
   dado de outro comitê nem, no caso de coordenador de região, de outra região.
