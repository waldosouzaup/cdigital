# Comitê Digital

> **Plataforma SaaS Multi-organização para Gestão de Equipes Temporárias, Governança Contratual e Prestação de Contas em Tempo Real.**

---

## Sumário

1. [Identificação do Problema](#1-identificação-do-problema)
2. [Panorama Geral da Solução](#2-panorama-geral-da-solução)
3. [Aplicabilidade e Cenários](#3-aplicabilidade-e-cenários)
4. [A Estrutura da Solução](#4-a-estrutura-da-solução)
5. [Abordagem Estratégica Adotada](#5-abordagem-estratégica-adotada)
6. [Impacto e Resultados Esperados](#6-impacto-e-resultados-esperados)
7. [Evolução e Próximas Etapas](#7-evolução-e-próximas-etapas)
8. [Pilares Tecnológicos e Conceituais](#8-pilares-tecnológicos-e-conceituais)
9. [Considerações Finais e Guia Rápido](#9-considerações-finais)

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
| **Erros tipográficos e financeiros em contratos (ex.: `R$ R$ 3.553,00,00` ou divergências no valor por extenso)** | Elaboração artesanal de contratos em editores de texto sem automação de templates ou tradução algorítmica de numerais monetários para texto por extenso. |
| **Vazamento e exposição de dados sensíveis (CPF, RG, CNH e dados bancários) sem controle** | Armazenamento em diretórios públicos ou compartilhados sem segregação de privilégios, sem criptografia de acesso e sem registro de acessos (não conformidade com a LGPD). |
| **Quebra de automações e scripts por caracteres inválidos ou espaços no fim de nomes de pastas** | Falta de padronização na taxonomia do armazenamento; dependência de caminhos físicos arbitrários. |
| **Descumprimento de prazos e descontrole de vigências** | Ausência de agendadores de tarefas em segundo plano e disparadores de notificações automatizadas de vencimento e cobrança. |

Em suma, **a localização física ou lógica de um arquivo nunca deve representar o estado de um negócio**. A dependência de conferência visual humana sobre coleções desordenadas de arquivos torna auditorias impraticáveis e impõe riscos severos de glosas eleitorais, autuações trabalhistas e prejuízos financeiros.

---

## 2. Panorama Geral da Solução

O **Comitê Digital** é uma plataforma SaaS (*Software as a Service*) multi-organização projetada para centralizar, automatizar e blindar a gestão de equipes temporárias, a emissão e coleta de contratos por período determinado e a prestação de contas operacional. 

O sistema substitui pastas estáticas por uma arquitetura viva orientada a eventos, estruturando todo o fluxo desde a captação de dados em campo até a visualização executiva consolidada em tempo real.

```
┌─────────────────┐       ┌────────────────────────┐       ┌─────────────────┐
│  Link Público   │ ────► │  Motor de Validação &  │ ────► │ Painel Gestor   │
│   de Coleta     │       │   Máquina de Estados   │       │ em Tempo Real   │
│ (Sem login/PWA) │       │ (Hash, OCR, Extenso)   │       │ (Auditoria/RLS) │
└─────────────────┘       └────────────────────────┘       └─────────────────┘
         │                            │                             │
         ▼                            ▼                             ▼
  Coleta Rápida             Integridade Garantida         Conformidade Plena
 (360px / Celular)       (Storage Privado / Eventos)       (TSE / MTE / LGPD)
```

### O Princípio Central da Arquitetura

O Comitê Digital fundamenta-se em um axioma técnico que elimina as falhas convencionais:

> **O estado nunca é representado pela localização de um arquivo.**  
> O estado é uma coluna em tabela relacional, com transições rígidas, validadas e registradas em trilha de auditoria append-only. O arquivo é um anexo estritamente subordinado a uma entidade de negócio, nomeado deterministicamente pelo sistema e armazenado sob buckets 100% privados acessíveis unicamente por URLs assinadas de curta duração.

### Proposta de Valor Integrada

1. **Alimentação Descentralizada e sem Fricção:** O contratado submete seus documentos por meio de links de coleta públicos e seguros (`/coleta/[token]`), sem necessidade de criar contas ou memorizar senhas.
2. **Triagem Técnica e Qualificação Automática:** Cada anexo recebido passa por validação imediata de dimensões de imagem, formato MIME e unicidade de hash criptográfico antes de ser aceito.
3. **Formalização Automatizada:** Templates contratuais inteligentes são mesclados com dados cadastrais e valores por extenso gerados algorítmicamente, eliminando discrepâncias financeiras.
4. **Visibilidade e Acompanhamento Ativo:** O gestor acompanha a evolução dos quadros em painel em tempo real atualizado via WebSockets (com fallback para polling inteligente), permitindo detalhamento progressivo até a cópia do documento com dois cliques.
5. **Automação de Alertas e Ciclo de Vida:** O sistema antecipa ações críticas — envia lembretes de assinatura, notifica sobre contratos próximos ao vencimento e expede resumos diários para as lideranças operacionais.

---

## 3. Aplicabilidade e Cenários

Embora concebido a partir das dores agudas verificadas em **comitês de campanha eleitoral**, o modelo de domínio do Comitê Digital é agnóstico e extensível a qualquer operação intensiva que envolva trabalho temporário por período determinado:

### Cenários Típicos de Aplicação

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
  * Contratação de promotores temporários para campanhas de datas sazonais (Black Friday, Natal, ações de verão).
  * Registro geo-referenciado e fotográfico de atividades de campo com operação offline em terminais móveis.

---

## 4. A Estrutura da Solução

A solução organiza-se em camadas funcionais coerentes, implementadas sobre uma arquitetura moderna em TypeScript e Next.js 15:

```
src/
├── app/
│   ├── (auth)/             # Fluxos de entrada (Login sem senha, Verificação, MFA TOTP)
│   ├── (painel)/           # Aplicação corporativa segura protegida por RLS
│   │   ├── dashboard/      # Matriz categoria × status, funil de conversão e pendências
│   │   ├── pessoas/        # Gestão cadastral de contratados e conferência documental
│   │   ├── contratos/      # Ciclo de vida contratual, emissão e assinatura
│   │   ├── documentos/     # Repositório de arquivos auditado e visualização protegida
│   │   ├── atividades/     # Registro operacional de campo (3 toques)
│   │   └── configuracoes/  # Gestão de templates, regiões e parâmetros da organização
│   ├── coleta/[token]/     # Interface pública de onboarding responsivo
│   └── api/
│       ├── cron/           # Endpoints agendados protegidos por CRON_SECRET
│       └── webhooks/       # Receptor assinado de eventos de e-mail (Resend)
├── db/                     # Camada de persistência Drizzle ORM, schemas e migrations
├── emails/                 # Componentes tipados de e-mail transacional (React Email)
└── lib/                    # Regras de negócio puras, clientes de infraestrutura e serviços
    ├── atividades/         # Sincronização offline e fila de atividades
    ├── auditoria/          # Registrador central de trilha e acessos
    ├── contratos/          # Máquina de estados, gerador de PDF e extenso pt-BR
    ├── cron/               # Rotinas de tarefas periódicas e agendamento
    ├── dashboard/          # Motores de agregação estatística e relatórios
    ├── documentos/         # Validação de upload, hash SHA-256 e inspeção Sharp
    ├── notificacoes/       # Disparador idempotente e tratamento de retentativas
    ├── realtime/           # Gerenciador de assinaturas Postgres Changes
    └── supabase/           # Clientes tipados isolados (client, server, admin)
```

### Componentes Principais

#### 1. Autenticação, Perfis e Controle de Acesso (RBAC)
* **Login sem senha (*Magic Links*):** Autenticação segura sem atrito de credenciais estáticas.
* **MFA Obrigatório via TOTP:** Exigência incondicional de segundo fator de autenticação (`aal2`) para perfis administrativos (`gestor` e `coord_comite`).
* **Segregação Estrita por Região:** Coordenadores regionais (`coord_regiao`) têm seu escopo de visibilidade limitado exclusivamente aos contratados de sua respectiva base geográfica, garantido diretamente na camada de banco de dados via PostgreSQL Row Level Security (RLS).

| Papel | Dashboard Consolidado | Cadastrar Pessoas | Emitir Contratos | Assinar / Distratar | Ver Log de Auditoria |
|---|:---:|:---:|:---:|:---:|:---:|
| **gestor** | Global | Global | Sim | Sim | Sim |
| **coord_comite** | Global | Global | Sim | Sim | Não |
| **coord_regiao** | Apenas sua região | Apenas sua região | Não | Não | Não |
| **auditor** | Global (Leitura) | Não | Não | Não | Sim |
| **contratado** | Não | Não | Não | Próprio Contrato | Não |

#### 2. Módulo de Triagem e Documentação Digital
* **Link de Coleta Público (`/coleta/[token]`):** Token criptográfico de uso controlado e prazo de expiração configurável, permitindo ao contratado enviar documentos do próprio smartphone.
* **Validação Síncrona Rigorosa:**
  * Rejeição automática de imagens com resolução inferior a **800 px** na menor dimensão (evitando uploads de thumbnails ou fotos ilegíveis).
  * Cálculo instantâneo de **hash SHA-256** para bloquear envios duplicados do mesmo arquivo dentro da organização.
  * Nomenclatura gerada deterministicamente pelo sistema: `{organizacao_id}/{tipo}_{pessoa_id}_v{versao}.{ext}`, preservando o nome original apenas como metadado para auditoria.

#### 3. Motor de Contratos e Máquina de Estados
A tramitação de contratos segue um fluxo de estados rigorosamente definido:

```
[ rascunho ] ──► [ emitido ] ──► [ enviado ] ──► [ assinado ] ──► [ encerrado ]
      │               │               │               │
      │               │               │               └──► [ distratado ] ──► [ distrato_assinado ]
      │               │               │
      └───────► [ cancelado ] ◄───────┘
```

* **Transições Atômicas:** Toda mudança de estado registra um registro imutável em `eventos_contrato` dentro da mesma transação de banco de dados.
* **Integridade Numérica:** O texto por extenso dos valores é computado por algoritmo gramatical oficial (`extenso`), eliminando contradições de digitação entre o numeral e o texto legal.
* **Emissão em Lote e PDF Institucional:** Compilação automatizada de documentos com `pdf-lib`, gerando termos formatados para impressão ou assinatura digital.

#### 4. Dashboard Executivo e Inteligência Operacional
* **Matriz Categoria × Status:** Quadro matricial consolidando contratados por função e fase de tramitação, separando expressamente o quadro ativo dos distratos.
* **Propagação Instantânea via Realtime:** Alterações efetuadas por operadores de campo refletem no painel do gestor em menos de 3 segundos através de WebSockets integrados ao Postgres Changes.
* **Detalhamento Progressivo (*Drill-down* em 2 Cliques):** Qualquer métrica numérica na tela é clicável, abrindo a listagem nominal correspondente e, a partir dela, o documento ou contrato original.
* **Exportação Multiformato:** Extração instantânea de relatórios analíticos em PDF formal e planilhas estruturadas em XLSX auditáveis (geradas via `exceljs`).

#### 5. Coleta de Campo e Capacidade Offline (PWA)
* **Interface Otimizada para Celular:** Desenvolvida sob viewport de 360 px, operável confortavelmente com apenas uma das mãos.
* **Registro em 3 Toques:** Fluxo minimalista para registro de presença, tarefas e mobilização.
* **Resiliência de Rede:** Armazenamento local temporário em IndexedDB com sincronização automática assim que a conectividade for restabelecida.

#### 6. Automação e Mensageria
* **Disparo Transacional via Resend:** Comunicação integrada por e-mail com layout responsivo construído em React Email.
* **Garantia de Idempotência:** Chaves determinísticas únicas vinculadas a cada tipo de notificação impedem duplicidade de envios, mesmo em caso de retentativas.
* **Agendamento com `pg_cron`:** Jobs periódicos que monitoram vencimento de vigências (alertas a 7 e 3 dias), cobrança de assinaturas pendentes (após 3 dias) e consolidação do resumo matinal diário às 8h (horário de Brasília).

---

## 5. Abordagem Estratégica Adotada

A concepção do Comitê Digital priorizou confiabilidade e segurança através de princípios de engenharia de software defensiva:

### Prevenção por Design (*The Pit of Success*)
O sistema foi concebido para que o caminho correto seja o mais natural, tornando a falha operacional estruturalmente impossível:
* Não há telas para criação manual de pastas ou definição de nomes de arquivo pelo usuário.
* Uploads que não atendam a requisitos de legibilidade são recusados na porta de entrada com explicações claras.
* Contratos só avançam para emissão caso a documentação pessoal obrigatória esteja aprovada.

### Defesa em Profundidade
A segurança da informação não depende de uma única barreira, articulando-se em quatro níveis concêntricos:

```
 Camada 1: Interface (Validações de formulário, máscaras e feedback de UI)
   Camada 2: Servidor (Server Actions, esquemas Zod, verificação de sessão)
     Camada 3: Banco de Dados (PostgreSQL RLS, constraints CHECK, Foreign Keys)
       Camada 4: Armazenamento (Buckets privados, URLs assinadas com TTL de 15 min)
```

### Segregação e Enclausuramento da `service_role`
A chave administrativa `SUPABASE_SERVICE_ROLE_KEY` bypassa todas as políticas de segurança de linha (RLS) do banco de dados. Para mitigar o risco de vazamento entre organizações:
* Toda requisição de usuário opera obrigatoriamente através da chave pública anônima munida do JWT do usuário autenticado.
* A chave `service_role` é restrita a scripts de migração, rotinas do agendador e webhooks, ficando isolada em `src/lib/supabase/admin.ts`.
* Uma regra de linter estrita (`no-restricted-imports`) bloqueia sumariamente a compilação caso qualquer módulo da área autenticada tente importar a chave administrativa.

### Governança e Adequação à LGPD
* **Minimização de Dados em Trânsito:** E-mails transacionais jamais contêm dados sensíveis (CPF, RG, valores de contrato ou dados bancários) no corpo da mensagem — funcionam estritamente como notificação de encaminhamento ao ambiente seguro.
* **Rastreabilidade de Acesso:** Toda geração de link assinado para visualização de documentos pessoais é registrada no `log_auditoria`, com identificação do usuário, IP e timestamp.
* **Isolamento Criptográfico e Temporal:** Documentos repousam em buckets fechados, e links temporários expiram automaticamente após 15 minutos.

---

## 6. Impacto e Resultados Esperados

A implementação do Comitê Digital transforma a eficiência operacional da organização:

| Indicador | Modelo Tradicional (Pastas / Planilhas) | Com o Comitê Digital |
|---|---|---|
| **Tempo de Consolidação de Relatórios** | De 4 a 8 horas abrindo arquivos dispersos | **Instantâneo (< 2 segundos)** no painel |
| **Taxa de Erros em Valores Contratuais** | Frequente (erros de digitação e divergências por extenso) | **Zero** (valores formatados por algoritmo matemático) |
| **Detecção de Arquivos Duplicados / Corrompidos** | Apenas em conferência visual manual posterior | **Imediata no upload** (bloqueio por hash e dimensão) |
| **Risco de Acesso Indevido a Dados Pessoais** | Crítico (pastas acessíveis a toda a equipe) | **Mitigado** (RLS por organização, região e log contínuo) |
| **Atrasos no Recolhimento de Assinaturas** | Frequente (dependente de cobrança humana manual) | **Automatizado** (notificações ativas com 3 dias de envio) |
| **Prestação de Contas e Auditoria** | Morosa, sujeita a extravio de vias e impugnações | **Rastreável** (histórico completo de eventos e exportações) |

---

## 7. Evolução e Próximas Etapas

O projeto foi estruturado em fases incrementais com gates de saída verificados de ponta a ponta:

* [x] **Fase 1 — Fundação e Arquitetura de Segurança:** Modelagem relacional completa, isolamento multi-tenant via RLS, Custom Access Token Hook com injeção de claims no JWT, autenticação sem senha, MFA TOTP obrigatório e pipeline de testes unitários e de integração.
* [x] **Fase 2 — Pessoas, Documentos e Contratos:** Gestão cadastral com validação de CPF, link público de coleta de documentos, upload síncrono com checagem de integridade SHA-256 e resolução mínima, versionamento de anexos, máquina de estados contratual e motor de compilação PDF.
* [x] **Fase 3 — Dashboard em Tempo Real e Relatórios:** Agregações analíticas, canal WebSocket com Supabase Realtime (e fallback para polling), detalhamento progressivo em dois cliques, métricas de cobertura regional e exportação formal em PDF e XLSX.
* [x] **Fase 4 — Campo, Mobilidade e Automações:** Interface mobile com registro em 3 toques, suporte a operação offline com fila local IndexedDB, automações de vigência, cobrança de assinatura e resumo matinal gerenciadas via `pg_cron` e rotas seguras.

### Roadmap Estratégico de Evolução

```
[ Atual: Fases 1–4 Concluídas ]
             │
             ├──► 1. Assinatura Eletrônica Homologada (ICP-Brasil / Gov.br / Assinadores Externos)
             ├──► 2. Pipeline de OCR Inteligente para pré-preenchimento assistido de RG/CNH
             ├──► 3. Integração Direta com Layouts de Exportação do SPCE (Justiça Eleitoral)
             ├──► 4. Módulo de Liquidação Financeira e Pagamentos em Lote via PIX
             └──► 5. Painéis Preditivos de Acompanhamento e Produtividade em Campo
```

1. **Assinatura Eletrônica Qualificada e Avançada:** Integração com serviços de assinatura digital com validade jurídica ampliada (Gov.br, ICP-Brasil, ClickSign ou DocuSign).
2. **OCR Multimodal Assistido:** Extração automática de dados biográficos a partir de documentos de identidade, com tela de conferência assistida obrigatória antes da persistência.
3. **Módulo de Prestação de Contas Eleitorais (SPCE):** Geração parametrizada de arquivos e recibos eleitorais nos padrões exigidos pelos tribunais eleitorais.
4. **Liquidação e Pagamentos via PIX:** Módulo de autorização de pagamentos das equipes com conciliação automática após a confirmação de cumprimento de vigência e atividades.

---

## 8. Pilares Tecnológicos e Conceituais

A stack tecnológica foi selecionada com foco em produtividade, segurança de dados em repouso e em trânsito, e suporte nativo a execuções assíncronas:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CAMADA DE APRESENTAÇÃO                          │
│        Next.js 15 (App Router)  ·  React 19  ·  Tailwind CSS v4        │
│          PWA / IndexedDB  ·  Server Actions  ·  Route Handlers         │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     NÚCLEO DE SERVIÇOS & DOMÍNIO                       │
│    Máquina de Estados Contratual  ·  Motor de Validação de Mídia       │
│  Notificações Idempotentes (Resend)  ·  Compilação PDF (pdf-lib)       │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       PERSISTÊNCIA & SEGURANÇA                         │
│   Supabase (PostgreSQL 15+)  ·  Drizzle ORM  ·  PostgreSQL RLS         │
│   Auth Hooks (JWT Claims)  ·  Storage Privado  ·  pg_cron Jobs         │
└────────────────────────────────────────────────────────────────────────┘
```

* **Frontend & Runtime:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions para redução de superfície de API), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) em modo estrito, [Tailwind CSS v4](https://tailwindcss.com/) e suporte a PWA com [idb](https://github.com/jakearchibald/idb) (IndexedDB).
* **Banco de Dados & BaaS:** [Supabase](https://supabase.com/) sobre [PostgreSQL 15+](https://www.postgresql.org/), com [Drizzle ORM](https://orm.drizzle.team/) para versionamento tipado de esquemas e controle de migrações.
* **Segurança de Linha & Identidade:** Row Level Security (RLS) mandatório, Custom Access Token Hook para injeção direta de metadados (`organizacao_id`, `papel`, `regiao_id`) no JWT e autenticação multi-fator (MFA TOTP).
* **Processamento de Mídia & Documentação:** [Sharp](https://sharp.pixelplumbing.com/) para inspeção e validação síncrona de dimensões de imagens; [pdf-lib](https://pdf-lib.js.org/) para renderização determinística de contratos; [exceljs](https://github.com/exceljs/exceljs) para geração segura de relatórios tabulares.
* **Mensageria Transacional & Agendamento:** [Resend](https://resend.com/) associado ao [React Email](https://react.email/) com tratamento de chaves determinísticas de idempotência e retentativas exponenciais; agendamentos de segundo plano orquestrados pelo `pg_cron`.
* **Qualidade de Software:** Cobertura de testes unitários com [Vitest](https://vitest.dev/) e testes de ponta a ponta e integração com [Playwright](https://playwright.dev/).

---

## 9. Considerações Finais

O **Comitê Digital** transcende a função de um simples repositório de documentos: consolida-se como uma infraestrutura de governança, conformidade e agilidade operacional projetada para organizações que operam sob prazos exíguos e fiscalização rigorosa. Ao alinhar uma experiência de uso simplificada para a ponta operacional em campo com controles estritos e auditáveis para a gestão central, a plataforma elimina o erro humano na raiz e assegura integridade em todas as etapas do ciclo de vida de contratos temporários.

---

### Guia Rápido de Instalação e Execução

#### 1. Pré-requisitos
* **Node.js:** versão 20 ou superior (recomendado Node.js 22 LTS).
* Instância do **Supabase** configurada com as migrações aplicadas.

#### 2. Configuração de Variáveis de Ambiente
Crie o arquivo `.env.local` na raiz do projeto com base no modelo `.env.example`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL="https://seu-projeto.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sua-anon-key"
SUPABASE_SERVICE_ROLE_KEY="sua-service-role-key" # Uso exclusivo de scripts/admin
DATABASE_URL="postgresql://postgres:senha@db.seu-projeto.supabase.co:5432/postgres"

# Resend
RESEND_API_KEY="re_123456789"
RESEND_FROM="Comitê Digital <nao-responda@seudominio.com.br>"
RESEND_WEBHOOK_SECRET="whsec_..."

# Aplicação & Segurança
APP_URL="http://localhost:3000"
CRON_SECRET="chave-secreta-para-rotinas-agendadas"
```

#### 3. Instalação e Execução Local

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

#### 4. Suíte de Testes e Validação de Qualidade

```bash
# Execução dos testes unitários
npm run test:unit

# Execução dos testes de integração (contra a base de dados)
npm run test:integration

# Verificação estática de tipos e análise de código
npx tsc --noEmit
npm run lint

# Build de produção
npm run build
```

---
*Comitê Digital — Tecnologia a serviço da conformidade, transparência e eficiência operacional.*
