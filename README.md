# Comitê Digital

> **Plataforma SaaS Multi-organização para Gestão de Equipes Temporárias, Governança Contratual, Prestação de Contas em Tempo Real e Administração Centralizada de Campanhas.**

---

## Sumário

1. [Identificação do Problema](#1-identificação-do-problema)
2. [Panorama Geral da Solução](#2-panorama-geral-da-solução)
3. [Aplicabilidade e Cenários](#3-aplicabilidade-e-cenários)
4. [A Estrutura da Solução](#4-a-estrutura-da-solução)
5. [Abordagem Estratégica e Governança](#5-abordagem-estratégica-e-governança)
6. [Impacto e Resultados Esperados](#6-impacto-e-resultados-esperados)
7. [Evolução e Roadmap Entregue](#7-evolução-e-roadmap-entregue)
8. [Pilares Tecnológicos e Conceituais](#8-pilares-tecnológicos-e-conceituais)
9. [Guia Rápido de Instalação e Execução](#9-guia-rápido-de-instalação-e-execução)

---

## 1. Identificação do Problema

A gestão de equipes contratadas por período determinado — em ambientes de alta volatilidade, dispersão geográfica e prazos regulatórios improrrogáveis — historicamente opera sob um ecossistema caótico e fragmentado. O modelo usual apoia-se em pastas compartilhadas na nuvem (Google Drive, Dropbox, OneDrive), planilhas estáticas preenchidas manualmente, trocas de mensagens via WhatsApp e documentos em Word editados de forma avulsa.

Esse arranjo improvisado gera um conjunto crítico de falhas operacionais, financeiras e jurídicas:

### Diagnóstico Operacional: Falhas Observadas vs. Causas-Raiz

| Falha Observada no Mundo Real | Causa-Raiz Técnica / Processual |
|---|---|
| **Consolidação de relatórios demandando abrir 40+ PDFs em 9 subpastas distintas** | Ausência de modelo de dados estruturado; o documento é tratado como repositório primário da informação em vez de anexo de uma entidade relacional. |
| **Impossibilidade de rastrear o status de tramitação ("contrato enviado?", "quem assinou?")** | O estado intermediário da operação não é capturado; não há máquina de estados formal nem trilha auditável de eventos. |
| **Inconsistência cadastral grave (ex.: arquivo `Eduardo_assinado.pdf` contendo o contrato de *Ricardo Ribeiro*)** | Nomenclatura manual dependente de intervenção humana, sem validação sistêmica de vínculo com a pessoa correspondente. |
| **Documentos dispersos nomeados aleatoriamente por UUIDs ou nomes crípticos** | Upload direto e desestruturado, sem catalogação padronizada por tipo de documento, pessoa e versão. |
| **Proliferação de duplicatas não detectadas (`Rg.pdf`, `Rg(1).pdf`)** | Falta de controle de integridade por soma criptográfica (hash SHA-256) na recepção de arquivos. |
| **Documentos pessoais ilegíveis (fotos com resolução de 72×72 pixels)** | Inexistência de inspeção e validação síncrona de dimensões e qualidade mínima no momento do upload. |
| **Erros tipográficos e financeiros em contratos (ex.: `R$ 3.553,00,00` ou divergências no valor por extenso)** | Elaboração artesanal de contratos em editores de texto sem automação de templates ou tradução algorítmica de numerais monetários para texto por extenso. |
| **Cálculo impreciso e litigioso em rescisões antecipadas (distratos)** | Falta de cálculo proporcional automático de dias trabalhados e ausência de emissão de termo de rescisão padronizado. |
| **Perda de histórico ao remover colaboradores ou contratos cancelados** | Exclusões destrutivas no banco sem snapshot de auditoria (`DadosExcluidos`), gerando insegurança contábil e jurídica. |
| **Vazamento e exposição de dados sensíveis (CPF, RG, CNH, Chave PIX) sem controle** | Armazenamento em diretórios públicos ou compartilhados sem segregação de privilégios, sem criptografia de acesso e sem registro de acessos (não conformidade com a LGPD). |
| **Descontrole na criação e inicialização de comitês eleitorais e projetos** | Falta de um perfil de governança de topo (**SuperAdmin**) capaz de instanciar campanhas e provisionar comitês e seus primeiros gestores de forma segura. |

Em suma, **a localização física ou lógica de um arquivo nunca deve representar o estado de um negócio**. A dependência de conferência visual humana sobre coleções desordenadas de arquivos torna auditorias impraticáveis e impõe riscos severos de glosas eleitorais, autuações trabalhistas e prejuízos financeiros.

---

## 2. Panorama Geral da Solução

O **Comitê Digital** é uma plataforma SaaS (*Software as a Service*) multi-organização projetada para centralizar, automatizar e blindar a gestão de equipes temporárias, a emissão e coleta de contratos por período determinado, a formalização de distratos com cálculo proporcional e a prestação de contas operacional em tempo real.

O sistema substitui pastas estáticas por uma arquitetura viva orientada a eventos, estruturando todo o fluxo desde a captação de dados em campo até a visualização executiva consolidada:

```
┌──────────────────┐       ┌────────────────────────┐       ┌──────────────────┐
│ Inscrição/Coleta │ ────► │  Motor de Validação &  │ ────► │  Painel Gestor   │
│   Pública PWA    │       │   Máquina de Estados   │       │   & SuperAdmin   │
│ (Sem login/Token)│       │ (Hash, OCR, Extenso)   │       │ (Auditoria/RLS)  │
└──────────────────┘       └────────────────────────┘       └──────────────────┘
         │                            │                              │
         ▼                            ▼                              ▼
  Coleta Rápida             Integridade Garantida          Conformidade Plena
 (360px / Celular)       (Storage Privado / Eventos)        (TSE / MTE / LGPD)
```

### O Princípio Central da Arquitetura

O Comitê Digital fundamenta-se em um axioma técnico que elimina as falhas convencionais:

> **O estado nunca é representado pela localização de um arquivo.**  
> O estado é uma coluna em tabela relacional, com transições rígidas, validadas e registradas em trilha de auditoria append-only. O arquivo é um anexo estritamente subordinado a uma entidade de negócio, nomeado deterministicamente pelo sistema e armazenado sob buckets 100% privados acessíveis unicamente por URLs assinadas de curta duração.

### Proposta de Valor Integrada

1. **Alimentação Descentralizada e sem Fricção:** O contratado submete seus documentos e assina termos através de links seguros (`/coleta/[token]`, `/inscricao/[slug]` e `/assinar/[token]`), com suporte a PWA e formulários responsivos.
2. **Triagem Técnica e Qualificação Automática:** Cada anexo recebido passa por validação imediata de dimensões de imagem, formato MIME e cálculo instantâneo de **hash SHA-256** para bloquear duplicatas.
3. **Formalização Automatizada & Modelos Dinâmicos:** Criação e edição de minutas contratuais personalizáveis com interpolação de marcadores dinâmicos (`{{nome}}`, `{{cpf}}`, `{{valor}}`, etc.) e geração de valores por extenso algorítmica.
4. **Rescisões e Distratos com Cálculo Proporcional:** Ao distratar, o gestor define o período de vigência efetivo; o sistema calcula os dias trabalhados, divide o valor do contrato proporcionalmente e gera o PDF de distrato oficial.
5. **Governança de Exclusão com DadosExcluidos:** Exclusões de contratos e membros limpam a visão operacional do painel, mas gravam automaticamente um snapshot integral imutável na tabela `DadosExcluidos` (`dados_excluidos`), preservando o nome e login do executor.
6. **Visibilidade Executiva Térmica e Drill-down:** Dashboard com escala térmica contextual em "Conclusão por Região" (cores de calor dinâmicas baseadas na porcentagem de conclusão), funil de conversão vibrante e detalhamento nominal direto ao clicar em qualquer "Objeto Contratual".
7. **Gestão de Acessos & Função SuperAdmin:** CRUD completo de membros de equipe com salvaguardas (bloqueio de autoexclusão e trava de único gestor) e perfil **SuperAdmin** para criação centralizada de campanhas, definição de slugs e provisionamento de gestores.

---

## 3. Aplicabilidade e Cenários

Embora concebido com base nas dores operacionais de **comitês de campanha eleitoral**, o modelo de domínio do Comitê Digital é agnóstico e extensível a qualquer operação intensiva com trabalho temporário por período determinado:

* **Comitês de Campanha Eleitoral:**
  * Gestão de centenas ou milhares de militantes, cabos eleitorais, coordenadores de comitê e equipes itinerantes.
  * Rigorosa segregação geográfica de dados por zonas ou regiões administrativas.
  * Conformidade documental preventiva para atendimento célere às exigências do Tribunal Superior Eleitoral (TSE) e do Sistema de Prestação de Contas Eleitorais (SPCE).
* **Produção de Grandes Eventos e Festivais:**
  * Credenciamento e contratação em lote de equipes de apoio, brigadistas, segurança, recepcionistas e operadores de montagem.
  * Disparo de termos de compromisso, distratos automatizados e comprovação de cumprimento de escalas de atividade.
* **Frentes de Obra e Construção Civil:**
  * Formalização ágil de prestadores de serviços pontuais e subcontratados em projetos com prazo definido.
  * Manutenção de acervo comprobatório de conformidade trabalhista e previdenciária, mitigando riscos de solidariedade passiva.
* **Ações de Trade Marketing e Varejo Sazonal:**
  * Contratação de promotores temporários para campanhas sazonais (Black Friday, Natal, campanhas de verão).
  * Registro de presença, atividades de campo e gestão de pagamentos via Chave PIX.

---

## 4. A Estrutura da Solução

A solução organiza-se em camadas funcionais coerentes, implementadas sobre uma arquitetura moderna em TypeScript e Next.js 15:

```
src/
├── app/
│   ├── (auth)/             # Fluxos de entrada (Login e-mail/senha, Redefinição de senha temporária, MFA)
│   ├── (painel)/           # Aplicação corporativa segura protegida por RLS
│   │   ├── dashboard/      # Matriz categoria × status, escala térmica por região e funil de conversão
│   │   │   └── contratos/  # Listagem nominal detalhada por Objeto Contratual (Drill-down)
│   │   ├── pessoas/        # Gestão cadastral, condição documental, Chave PIX e relatório demográfico (idade)
│   │   ├── contratos/      # Ciclo de vida contratual, filtro por status, emissão, exclusão auditada e distrato
│   │   ├── documentos/     # Repositório de arquivos auditado e visualização protegida
│   │   └── configuracoes/  # Central unificada: Equipe (CRUD), Regiões, Atividades, Minutas, Identidade e SuperAdmin
│   ├── coleta/[token]/     # Interface pública de onboarding responsivo
│   ├── inscricao/[slug]/   # Página pública de autoinscrição por campanha/organização
│   ├── assinar/[token]/    # Interface pública de assinatura de contrato com evidências
│   └── api/
│       ├── equipe/convite  # Rota com isolamento de privilégios para CRUD e credenciais da equipe
│       ├── superadmin/     # Rota administrativa para criação de campanhas e provisionamento de 1º gestor
│       ├── cron/           # Endpoints agendados protegidos por CRON_SECRET (vigência, lembrete, resumo)
│       └── webhooks/       # Receptor assinado de eventos de e-mail (Resend)
├── db/                     # Camada de persistência Drizzle ORM, schemas e migrations
├── emails/                 # Componentes tipados de e-mail transacional (React Email)
└── lib/                    # Regras de negócio puras, clientes de infraestrutura e serviços
    ├── atividades/         # Sincronização offline e fila de atividades de rua
    ├── auditoria/          # Registrador central de trilha e acessos
    ├── contratos/          # Máquina de estados, distrato proporcional, gerador de PDF e extenso pt-BR
    ├── cron/               # Rotinas de tarefas periódicas e agendamento
    ├── dashboard/          # Motores de agregação estatística, escalas térmicas e exportações
    ├── documentos/         # Validação de upload, hash SHA-256 e inspeção Sharp
    ├── equipe/             # Validações de entrada de membros e regras de privilégios
    ├── notificacoes/       # Disparador idempotente e tratamento de retentativas
    ├── realtime/           # Gerenciador de assinaturas Postgres Changes
    └── supabase/           # Clientes tipados isolados (client, server, admin)
```

---

### Componentes Principais

#### 1. Autenticação, Perfis e Controle de Acesso (RBAC)

O sistema opera sob isolamento estrito via PostgreSQL Row Level Security (RLS) e claims injetadas no JWT:

* **SuperAdmin (Governança Global):** Perfil de topo responsável pela configuração de novas campanhas eleitorais/organizações, gestão de slugs públicos e provisionamento dos primeiros gestores de cada comitê. Possui visibilidade cross-organizacional.
* **Gestor:** Administra integralmente a organização vinculada, coordena os acessos da equipe (CRUD completo), emite e cancela contratos, aprova documentação e configura modelos de minuta.
* **Coordenador de Comitê (`coord_comite`):** Visão ampla da organização para triagem documental, emissão de contratos e fiscalização.
* **Coordenador Regional (`coord_regiao`):** Escopo estritamente limitado à sua região administrativa de atuação via RLS.
* **Auditor:** Acesso em modo leitura aos dados consolidados e trilha de auditoria para prestação de contas.
* **Contratado:** Acesso pontual restrito ao seu próprio contrato e links públicos de coleta e assinatura.

| Papel | Escopo de Visão | Criar Campanhas | Gerenciar Equipe | Emitir Contratos | Distratar / Excluir | Trilha de Auditoria |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **superadmin** | Cross-Campanhas | Sim | Global / Gestores | Sim | Sim | Sim |
| **gestor** | Sua Organização | Não | Sim (CRUD) | Sim | Sim | Sim |
| **coord_comite** | Sua Organização | Não | Não | Sim | Sim | Não |
| **coord_regiao** | Apenas sua Região | Não | Não | Não | Não | Não |
| **auditor** | Sua Organização (Leitura) | Não | Não | Não | Não | Sim |
| **contratado** | Apenas o seu Contrato | Não | Não | Não | Não | Não |

---

#### 2. Central Unificada de Configurações (`/configuracoes`)

A página de configurações unifica a governança da campanha em abas funcionais:

1. **🔑 Equipe & Acessos (`?aba=equipe`):**
   * **Visualizar (Read):** Modal com histórico, data de cadastro formatada, papel, e-mail, região e ID do usuário com botão de cópia.
   * **Editar (Update):** Edição de nome, e-mail (sincronizado automaticamente com Supabase Auth), papel e região.
   * **Excluir (Delete):** Remoção de acesso com **bloqueio de autoexclusão**, **bloqueio de exclusão do único gestor ativo** e snapshot integral arquivado na tabela `DadosExcluidos` com identificação de quem realizou a exclusão.
   * **Convidar (Create):** Criação de acessos com geração de **senha temporária única**, que deve ser alterada obrigatoriamente no primeiro login.
   * **Ações Ágeis:** Botões diretos para redefinição de senha e suspensão/reativação imediata de acesso.
2. **🗺 Regiões de Atuação (`?aba=regioes`):** Cadastro e parametrização das bases geográficas e zonas de atuação.
3. **📋 Atividades da Equipe (`?aba=atividades`):** Gestão e acompanhamento das atividades de mobilização de rua, centralizadas dentro de configurações.
4. **🏛 Identidade da Campanha (`?aba=identidade`):** Definição do Nome do Comitê, CNPJ e **Slug público** (`/inscricao/<slug>`) para autoinscrição de equipes.
5. **📄 Modelos de Minuta (`?aba=modelos`):** Criação e customização de minutas contratuais com suporte a variáveis dinâmicas (`{{nome}}`, `{{cpf}}`, `{{objeto}}`, `{{valor}}`, `{{vigencia_inicio}}`, `{{vigencia_fim}}`, etc.) e visualização prévia.
6. **🛡 Proteção & LGPD (`?aba=seguranca`):** Controle de retenção com expurgo auditado pós-campanha e verificação em duas etapas (2FA).
7. **👑 Campanhas & Gestores (`?aba=campanhas` — Exclusivo SuperAdmin):** Painel para criação de novas campanhas, visualização de comitês ativos e provisionamento do 1º gestor responsável com entrega de credenciais seguras.

---

#### 3. Gestão de Contratos, Distratos e Exclusão Segura (`/contratos`)

* **Máquina de Estados Rigorosa:**
  ```
  [ rascunho ] ──► [ emitido ] ──► [ enviado ] ──► [ assinado ] ──► [ encerrado ]
        │               │               │               │
        │               │               │               └──► [ distratado ] ──► [ distrato_assinado ]
        │               │               │
        └───────► [ cancelado ] ◄───────┘
  ```
* **Filtro por Estado do Contrato:** Filtro completo no formulário de busca e pílulas rápidas (*filter chips*) para alternar entre `Todos`, `✓ Assinado`, `➤ Enviado`, `▸ Emitido`, `○ Rascunho`, `✕ Cancelado` e `✓✓ Encerrado`.
* **Fluxo de Distrato com Período e Valor Proporcional:**
  * O administrador clica em **Distrato** e um modal solicita o período de atuação (data de início e data final de rescisão).
  * O sistema calcula os dias efetivamente trabalhados, divide o valor do contrato pelo período total e determina o valor proporcional exato a ser pago.
  * É gerado o **Termo de Distrato Contratual em PDF** com base no modelo oficial de rescisão, contendo os dados das partes, período e valores discriminados.
* **Exclusão de Contratado com Arquivamento em `DadosExcluidos`:**
  * Permite ao gestor apagar o registro do painel ativo para despoluir a visualização.
  * O contrato, a pessoa e todo o histórico de eventos são preservados de forma imutável na tabela `DadosExcluidos` (`dados_excluidos`), salvando o nome e login do executor e o motivo da exclusão.

---

#### 4. Dashboard Executivo e Visualização Térmica (`/dashboard`)

* **Drill-down Nominal na Matriz por Objeto Contratual:** Ao clicar em qualquer função/objeto (ex.: *"Administrativo e Montagem de Material"*), o sistema redireciona para a listagem nominal detalhada de todos os colaboradores contratados para aquela função (`/dashboard/contratos?objeto=...`).
* **Conclusão por Região com Escala Térmica:** Os cards de progresso regional utilizam uma escala térmica dinâmica — cores frias para baixos percentuais evoluindo gradualmente para tons quentes e destacados à medida que a taxa de conclusão se aproxima de 100%.
* **Funil de Conversão Profissional:** Cores temáticas bem contrastadas para cada etapa da jornada (cadastros, documentação apta, contratos emitidos e contratos assinados).
* **Propagação Instantânea via Realtime:** Alterações refletem em menos de 3 segundos via WebSockets Postgres Changes com fallback para polling inteligente.
* **Exportação Analítica:** Relatórios em PDF institucional e planilhas em XLSX geradas via `exceljs`.

---

#### 5. Módulo de Pessoas e Análise Demográfica (`/pessoas`)

* **Relatório Demográfico por Função e Região:** Filtro inteligente que calcula e apresenta a média de idade dos trabalhadores contratados, segmentada por função e localidade, auxiliando o planejamento de campo e conformidade legal.
* **Gestão de Chave PIX e Dados Bancários:** Registro estruturado de chave PIX (CPF, e-mail, telefone ou chave aleatória), banco, agência e conta para liquidação financeira.
* **Condição Documental:** Indicadores visuais claros de documentação apta ou pendente, com temas de alto contraste adaptados para modo claro e escuro.

---

#### 6. Assinatura Eletrônica e Evidências (`/assinar/[token]`)

* **Link Público de Assinatura:** Contratados assinam termos contratuais diretamente pelo navegador (desktop ou smartphone).
* **Captura de Evidências:** Registro de assinatura manuscrita (canvas), endereço IP, data/hora exata, *user agent* e geolocalização.
* **Anexação no PDF Original:** A tecnologia `pdf-lib` adiciona uma página de evidências ao contrato final, consolidando a validade jurídica do ato.

---

## 5. Abordagem Estratégica e Governança

### Prevenção por Design (*The Pit of Success*)
* Nomenclatura determinística e imutável de arquivos gerada pelo sistema: `{organizacao_id}/{tipo}_{pessoa_id}_v{versao}.{ext}`.
* Imagens de documentos inspecionadas via `sharp` para rejeitar resoluções inferiores a 800 px.
* Unicidade de arquivo garantida via hash criptográfico SHA-256.

### Defesa em Profundidade e Segregação da `service_role`
* Toda operação ordinária utiliza o token JWT do usuário sob políticas de RLS.
* A chave `SUPABASE_SERVICE_ROLE_KEY` é estritamente confinada em rotas de API seguras (`/api/equipe/convite`, `/api/superadmin/campanhas`) e rotinas cron, sendo terminantemente proibida na camada de apresentação por regras de linter (`no-restricted-imports`).

### Governança LGPD e Trilha de Auditoria
* **Tabela `DadosExcluidos` (`dados_excluidos`):** Garante que exclusões no painel não representem perda irrecuperável de histórico contábil e jurídico.
* **Minimização de Dados em Notificações:** E-mails transacionais não exibem dados sensíveis (CPF, RG, valores bancários) no corpo da mensagem.
* **Expurgo Seguro de Retenção:** Rotina de expurgo definitivo pós-campanha para cumprimento do direito ao esquecimento e normas da LGPD.

---

## 6. Impacto e Resultados Esperados

| Indicador | Modelo Tradicional (Pastas / Planilhas) | Com o Comitê Digital |
|---|---|---|
| **Consolidação de Relatórios** | De 4 a 8 horas abrindo arquivos dispersos | **Instantâneo (< 2 segundos)** no painel |
| **Erros em Valores e Extenso** | Frequente (erros de digitação manual) | **Zero** (algoritmo gramatical automatizado) |
| **Cálculo de Distrato** | Manual, sujeito a contestações | **Automático por período de dias trabalhados** |
| **Risco de Perda por Exclusão** | Irreversível (registro apagado) | **Protegido** (snapshot em DadosExcluidos) |
| **Controle de Campanhas** | Múltiplas planilhas e contas separadas | **Centralizado via SuperAdmin** |
| **Conferência Demográfica de Equipe** | Lenta, exigindo cruzamento de dados | **Relatório instantâneo de média de idade** |
| **Arquivos Duplicados / Ilegíveis** | Detectados apenas em auditoria posterior | **Bloqueio síncrono no upload** |

---

## 7. Evolução e Roadmap Entregue

* [x] **Fase 1 — Fundação e Segurança:** Modelagem relacional multi-tenant, RLS, injeção de claims no JWT, autenticação e testes unitários.
* [x] **Fase 2 — Pessoas, Documentos e Contratos:** Gestão cadastral, validação de CPF, links públicos de coleta, verificação SHA-256 e motor de compilação PDF.
* [x] **Fase 3 — Dashboard em Tempo Real e Relatórios:** Agregações analíticas, WebSockets Realtime, exportação em PDF e XLSX.
* [x] **Fase 4 — Campo, Mobilidade e Automações:** Interface mobile 360 px, operação offline com IndexedDB, agendamento via `pg_cron` e Resend.
* [x] **Fase 5 — Governança Avançada, Distratos e SuperAdmin:**
  * [x] Perfil e migração de **SuperAdmin** com gestão centralizada de campanhas e provisionamento do 1º gestor.
  * [x] CRUD completo de membros de equipe em `/configuracoes?aba=equipe` com travas de segurança.
  * [x] Arquivamento permanente em `DadosExcluidos` (`dados_excluidos`) para contratos e membros.
  * [x] Fluxo de distrato com inserção de período, cálculo proporcional de dias e emissão de PDF rescisório.
  * [x] Filtro por status do contrato e navegação rápida via pílulas (*chips*).
  * [x] Assinatura pública com coleta de evidências e anexação no PDF.
  * [x] Drill-down nominal por Objeto Contratual no Dashboard.
  * [x] Escala térmica contextual em Conclusão por Região.
  * [x] Relatório demográfico de média de idade por Função e Região.
  * [x] Centralização da gestão de atividades de rua dentro de configurações.
  * [x] Criação e edição de modelos de minuta contratual com marcadores dinâmicos.

---

## 8. Pilares Tecnológicos e Conceituais

* **Frontend & Runtime:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) estrito, [Tailwind CSS v4](https://tailwindcss.com/) e PWA com [idb](https://github.com/jakearchibald/idb).
* **Banco de Dados & BaaS:** [Supabase](https://supabase.com/) sobre [PostgreSQL 15+](https://www.postgresql.org/), com [Drizzle ORM](https://orm.drizzle.team/) para versionamento tipado de esquemas e migrações SQL declarativas.
* **Segurança de Linha & Identidade:** Row Level Security (RLS) estrito, Custom Access Token Hook para injeção de claims (`organizacao_id`, `papel`, `regiao_id`), permissões RBAC e proteção contra autoexclusão.
* **Processamento de Mídia & Documentos:** [Sharp](https://sharp.pixelplumbing.com/) para validação síncrona de dimensões de imagens; [pdf-lib](https://pdf-lib.js.org/) para renderização determinística de contratos e distratos; [exceljs](https://github.com/exceljs/exceljs) para geração de planilhas de prestação de contas.
* **Mensageria & Automação:** [Resend](https://resend.com/) e [React Email](https://react.email/) com chaves de idempotência; jobs agendados via `pg_cron`.
* **Qualidade de Software:** 43 suítes com **286 testes unitários aprovados** em [Vitest](https://vitest.dev/), além de validação estrita de tipos (`npx tsc --noEmit`) e ESLint sem erros.

---

## 9. Guia Rápido de Instalação e Execução

### 1. Pré-requisitos
* **Node.js:** versão 20 ou superior (recomendado Node.js 22 LTS).
* Instância do **Supabase** configurada com as migrações aplicadas.

### 2. Configuração de Variáveis de Ambiente
Crie o arquivo `.env.local` na raiz do projeto com base no modelo `.env.example`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-anon-key"
SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key" # Uso exclusivo de rotas de admin/scripts
DATABASE_URL="postgresql://postgres:senha@db.seu-projeto.supabase.co:5432/postgres"

# Resend
RESEND_API_KEY="re_123456789"
RESEND_FROM="Comitê Digital <nao-responda@seudominio.com.br>"
RESEND_WEBHOOK_SECRET="whsec_..."

# Aplicação & Segurança
APP_URL="http://localhost:3000"
CRON_SECRET="chave-secreta-para-rotinas-agendadas"
```

### 3. Instalação e Execução Local

```bash
# Instalação das dependências
npm install

# Aplicação de migrações e carga inicial de demonstração
npm run db:migrate
npm run db:seed

# Inicialização do servidor de desenvolvimento
npm run dev
```

Acesse **http://localhost:3000** no navegador para utilizar a aplicação.

### 4. Suíte de Testes e Validação de Qualidade

```bash
# Execução dos 286 testes unitários
npm run test:unit

# Verificação estática de tipos (TypeScript)
npx tsc --noEmit

# Análise de linting (ESLint)
npm run lint

# Build otimizado de produção
npm run build
```

---

*Comitê Digital — Tecnologia a serviço da governança, transparência e eficiência operacional.*
