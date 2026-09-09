# Manual Operacional e Técnico do Sistema — Comitê Digital

> **Guia Completo de Arquitetura, Engenharia e Processos com Diagramas Mermaid**  
> *Versão de Referência — Comitê Digital SaaS Multi-organização*

---

## Sumário

1. [Visão Geral e Macroprocesso Integrado](#1-visão-geral-e-macroprocesso-integrado)
2. [Processo 1: Autenticação, Controle de Acesso e Governança Multi-Tenant](#2-processo-1-autenticação-controle-de-acesso-e-governança-multi-tenant)
3. [Processo 2: Cadastro de Pessoas e Onboarding Descentralizado (Link Público)](#3-processo-2-cadastro-de-pessoas-e-onboarding-descentralizado-link-público)
4. [Processo 3: Recepção, Validação Síncrona e Versionamento de Documentos](#4-processo-3-recepção-validação-síncrona-e-versionamento-de-documentos)
5. [Processo 4: Ciclo de Vida do Contrato (Máquina de Estados e Emissão Formal)](#5-processo-4-ciclo-de-vida-do-contrato-máquina-de-estados-e-emissão-formal)
6. [Processo 5: Operação de Campo, Mobilidade e Capacidade Offline (PWA)](#6-processo-5-operação-de-campo-mobilidade-e-capacidade-offline-pwa)
7. [Processo 6: Monitoramento Executivo em Tempo Real e Detalhamento Progressivo](#7-processo-6-monitoramento-executivo-em-tempo-real-e-detalhamento-progressivo)
8. [Processo 7: Motor de Mensageria, Idempotência e Automações Periódicas (pg_cron)](#8-processo-7-motor-de-mensageria-idempotência-e-automações-periódicas-pg_cron)
9. [Processo 8: Trilha de Auditoria, Segurança e Conformidade com a LGPD](#9-processo-8-trilha-de-auditoria-segurança-e-conformidade-com-a-lgpd)
10. [Modelo Entidade-Relacionamento do Banco de Dados](#10-modelo-entidade-relacionamento-do-banco-de-dados)

---

## 1. Visão Geral e Macroprocesso Integrado

O **Comitê Digital** é uma plataforma concebida para estruturar e automatizar integralmente o ciclo de gestão de mão de obra temporária. A espinha dorsal do sistema conecta quatro fases sequenciais:

1. **Captação Cadastral & Documental:** Coleta de dados e anexos de identificação (RG, CNH, dados bancários e endereço) sem atrito para o contratado.
2. **Triagem Técnica & Qualificação:** Verificação síncrona de resolução, unicidade criptográfica e aprovação de aptidão.
3. **Formalização Jurídica:** Geração paramétrica de contratos com cálculos monetários por extenso e controle rigoroso de assinatura e distrato.
4. **Governança & Acompanhamento:** Painel consolidado em tempo real com detalhamento progressivo em até dois cliques e exportações oficiais.

### Diagrama do Macroprocesso Operacional

```mermaid
flowchart TD
    subgraph S1["1. Entrada Cadastral"]
        A["Coordenador Cadastra Pessoa"] --> B["Sistema Valida CPF & Gera Link"]
        B --> C["Contratado Recebe E-mail"]
        C --> D["Acesso ao Link Público /coleta/token"]
    end

    subgraph S2["2. Triagem e Qualificação"]
        D --> E["Upload de Documentos"]
        E --> F{"Validação Síncrona<br/>(Sharp: >= 800px & SHA-256)"}
        F -- "Reprovado" --> G["Dispara documento_rejeitado<br/>(Contratado Notificado)"]
        G -.-> D
        F -- "Aprovado" --> H["Armazena em Storage Privado<br/>(Nomenclatura do Sistema)"]
        H --> I{"Todos Documentos<br/>Aprovados?"}
        I -- "Não" --> J["Status: Pendente"]
        I -- "Sim" --> K["Pessoa Marcada como 'Apta'<br/>Dispara evento pessoa_apta"]
    end

    subgraph S3["3. Emissão Contratual"]
        K --> L["Gestor/Coord Seleciona Template"]
        L --> M["Gera PDF via pdf-lib<br/>(Valor Extenso via Algoritmo)"]
        M --> N["Contrato em Estado 'Emitido'"]
        N --> O["Registro de Envio<br/>(Transição para 'Enviado')"]
        O --> P["Disparo de contrato_enviado<br/>(Idempotência Garantida)"]
        P --> Q{"Assinatura<br/>Realizada?"}
        Q -- "Sim" --> R["Upload Assinado / Presencial<br/>(Transição para 'Assinado')"]
        Q -- "Não (3 dias)" --> S["pg_cron: lembrete_assinatura"]
        S -.-> Q
    end

    subgraph S4["4. Gestão e Auditoria"]
        R --> T["Atualização Realtime do Dashboard<br/>(Postgres Changes < 3s)"]
        T --> U["Detalhamento em 2 Cliques<br/>(Célula -> Nominal -> Documento)"]
        U --> V["Relatórios em PDF e XLSX"]
        V --> W["Log de Auditoria Append-Only<br/>(Quem acessou, quando e de onde)"]
    end
```

---

## 2. Processo 1: Autenticação, Controle de Acesso e Governança Multi-Tenant

O modelo de segurança do Comitê Digital baseia-se no princípio do menor privilégio e isolamento absoluto entre organizações (*tenants*) e regiões administrativas.

### Mecânica de Funcionamento

1. **Solicitação de Acesso:** O usuário informa seu e-mail corporativo em `/login`. O sistema dispara um link mágico via Supabase Auth.
2. **Segundo Fator Obrigatório (MFA TOTP):** Para perfis executivos (`gestor` e `coord_comite`), o sistema exige autenticação em dois fatores (`aal2`). Usuários sem fator cadastrado são direcionados ao pareamento via QR Code em `/mfa`.
3. **Injeção de Claims no JWT:** Um *Custom Access Token Hook* no PostgreSQL intercepta a emissão do token e injeta as variáveis `organizacao_id`, `papel` e `regiao_id` nas claims do token JWT.
4. **Enforcement por Row Level Security (RLS):** Cada consulta no banco de dados é filtrada diretamente pelo PostgreSQL via funções de suporte estáveis: `(select public.organizacao_id())`, `(select public.papel())` e `(select public.regiao_id())`.
5. **Enclausuramento da Chave Mestra:** A `SUPABASE_SERVICE_ROLE_KEY` é estritamente proibida no caminho de requisições de usuários, sendo enclausurada em `src/lib/supabase/admin.ts` com proteção ativa por linter (`no-restricted-imports`).

### Diagrama de Sequência: Autenticação e Autorização RLS

```mermaid
sequenceDiagram
    autonumber
    actor Usuario as Usuário (Gestor / Coord)
    participant App as Next.js (App Router)
    participant Auth as Supabase Auth
    participant Hook as Custom Access Token Hook
    participant DB as PostgreSQL (RLS)

    Usuario->>App: Submete e-mail em /login
    App->>Auth: signInWithOtp(email)
    Auth-->>Usuario: Envia e-mail com Link Mágico
    Usuario->>App: Clica no link e abre /verificacao
    App->>Auth: Valida token de acesso

    opt Se Papel for 'gestor' ou 'coord_comite' (Exige MFA)
        App->>Usuario: Redireciona para /mfa (Pede código TOTP)
        Usuario->>App: Informa código de 6 dígitos
        App->>Auth: mfa.challengeAndVerify({ factorId, code })
        Auth-->>App: Sessão promovida para nível AAL2
    end

    Auth->>Hook: Dispara hook custom_access_token_hook(event)
    Hook->>DB: Busca organizacao_id, papel e regiao_id do usuário
    DB-->>Hook: Retorna dados cadastrais
    Hook-->>Auth: Injeta claims personalizadas no JWT
    Auth-->>App: Devolve JWT assinado com claims

    Usuario->>App: Acessa rota protegida (ex: /pessoas)
    App->>DB: Executa SELECT * FROM pessoas (Anon Key + JWT)
    Note over DB: Postgres RLS avalia:<br/>organizacao_id = public.organizacao_id()<br/>AND (papel <> 'coord_regiao' OR regiao_id = public.regiao_id())
    DB-->>App: Retorna exclusivamente registros autorizados
    App-->>Usuario: Renderiza dados da própria organização
```

---

## 3. Processo 2: Cadastro de Pessoas e Onboarding Descentralizado (Link Público)

O cadastro de prestadores e militantes evita gargalos operacionais ao descentralizar o preenchimento de dados e o envio de documentos.

### Mecânica de Funcionamento

1. **Início do Cadastro:** O coordenador registra os dados biográficos preliminares da pessoa (Nome, CPF, Função e Região).
2. **Validação Estrita de CPF:** O sistema valida os dois dígitos verificadores matemáticos do CPF e verifica se já existe registro com aquele documento na mesma organização. Em caso de colisão, impede o cadastro duplo e aponta o registro já existente.
3. **Geração do Link Público:** É criado um registro na tabela `links_coleta` com token pseudo-aleatório criptograficamente seguro e data de expiração programada.
4. **Disparo do Link:** O sistema enfileira a notificação `link_coleta` via Resend, contendo o link `/coleta/[token]`.
5. **Preenchimento sem Senha:** O titular acessa a página pública no celular, confere seus dados e realiza a submissão dos comprovantes sem necessidade de criar conta no sistema.

### Diagrama de Sequência: Geração e Consumo do Link de Coleta

```mermaid
sequenceDiagram
    autonumber
    actor Coord as Coordenador
    participant Painel as Painel Administrativo
    participant Server as Server Action (Pessoas)
    participant DB as PostgreSQL
    participant Notif as Motor de Notificações
    actor Contratado as Contratado (Smartphone)

    Coord->>Painel: Preenche Nome, CPF e Região
    Painel->>Server: cadastrarPessoa(dados)
    Server->>Server: Valida dígitos verificadores do CPF
    Server->>DB: Verifica duplicata de CPF na organização
    DB-->>Server: CPF livre
    Server->>DB: INSERT INTO pessoas (...)
    Server->>DB: INSERT INTO links_coleta (token, expira_em)
    Server->>Notif: dispararNotificacao('link_coleta')
    Notif->>DB: INSERT INTO notificacoes (chave_idempotencia)
    Notif-->>Contratado: E-mail com link /coleta/[token]
    
    Contratado->>Painel: Acessa /coleta/[token]
    Painel->>DB: Valida token (não expirado e não usado)
    DB-->>Painel: Token válido
    Painel-->>Contratado: Exibe formulário público de coleta
    Contratado->>Painel: Submete dados e documentos
    Painel->>DB: UPDATE links_coleta SET usado_em = NOW()
```

---

## 4. Processo 3: Recepção, Validação Síncrona e Versionamento de Documentos

A integridade do repositório documental é mantida por meio de um filtro síncrono imposto na borda de recepção dos arquivos.

### Critérios Técnicos de Aceitação

* **Resolução Mínima:** Imagens (JPEG/PNG) precisam ter ao menos **800 pixels** na menor dimensão. Imagens menores (como miniaturas de 72×72 px) são recusadas imediatamente com instruções de reenvio.
* **Detecção de Duplicatas:** O arquivo tem sua soma criptográfica **SHA-256** calculada. Se o hash já constar no banco daquela organização, o upload é bloqueado, evitando duplicatas desnecessárias.
* **Nomenclatura do Sistema:** O nome original do arquivo é gravado como metadado. O caminho físico no bucket segue o formato `{organizacao_id}/{tipo}_{pessoa_id}_v{versao}.{ext}`.
* **Versionamento:** O reenvio de um documento reprovado não sobrescreve o anterior: cria uma nova linha com `versao = versao + 1`.
* **Qualificação Automática (Aptidão):** Quando todos os documentos obrigatórios exigidos para a função estão no estado `aprovado`, a pessoa é automaticamente atualizada para `apta = true`, disparando a notificação `pessoa_apta` para o coordenador.

### Diagrama de Fluxo de Decisão: Upload e Validação de Documentos

```mermaid
flowchart TD
    Start["Recebimento do Arquivo<br/>(Multipart Form-Data)"] --> CheckExt{"Extensão Válida?<br/>(PDF, JPG, PNG)"}
    CheckExt -- "Não" --> ErrExt["Erro: Formato não suportado"]
    CheckExt -- "Sim" --> CheckSize{"Tamanho <= 20 MB?"}
    CheckSize -- "Não" --> ErrSize["Erro: Arquivo excede 20 MB"]
    CheckSize -- "Sim" --> CheckType{"É Imagem?"}

    CheckType -- "Sim" --> Sharp["Processamento via Sharp<br/>(Inspeção de Dimensões)"]
    Sharp --> CheckDim{"Menor Dimensão<br/>>= 800 px?"}
    CheckDim -- "Não" --> RejDim["Rejeição Imediata:<br/>Resolução insuficiente<br/>Dispara documento_rejeitado"]
    CheckDim -- "Sim" --> Hash

    CheckType -- "Não (PDF)" --> Hash["Cálculo de Hash SHA-256"]
    
    Hash --> CheckHash{"Hash já existe<br/>na Organização?"}
    CheckHash -- "Sim" --> RejHash["Rejeição: Documento Idêntico<br/>já cadastrado anteriormente"]
    CheckHash -- "Não" --> Storage["Gravação no Bucket Privado<br/>Nomenclatura Padronizada v{N}"]
    
    Storage --> DB["INSERT INTO documentos<br/>(status: pendente)"]
    DB --> Audit["Registro em log_auditoria"]
    Audit --> Triagem{"Coordenador Avalia<br/>Documento"}
    
    Triagem -- "Reprovado" --> Rejeitado["status = 'rejeitado'<br/>Registra motivo_rejeicao<br/>Dispara documento_rejeitado"]
    Triagem -- "Aprovado" --> Aprovado["status = 'aprovado'"]
    
    Aprovado --> CheckAll{"Todos os docs da<br/>pessoa foram aprovados?"}
    CheckAll -- "Sim" --> MarcaApto["UPDATE pessoas SET apta = TRUE<br/>Dispara notificação pessoa_apta"]
    CheckAll -- "Não" --> Fim["Aguardando pendências"]
    MarcaApto --> Fim
```

---

## 5. Processo 4: Ciclo de Vida do Contrato (Máquina de Estados e Emissão Formal)

O gerenciamento de contratos é blindado por um autômato finito estrito, implementado na aplicação em TypeScript e replicado em nível de banco de dados via função RPC no PostgreSQL.

### A Máquina de Estados Contratual

As transições permitidas entre os estados do contrato são:

* `rascunho` $\rightarrow$ `emitido` ou `cancelado`
* `emitido` $\rightarrow$ `enviado` ou `cancelado`
* `enviado` $\rightarrow$ `assinado` ou `cancelado`
* `assinado` $\rightarrow$ `distratado` ou `encerrado`
* `distratado` $\rightarrow$ `distrato_assinado`
* Estados terminais: `distrato_assinado`, `encerrado`, `cancelado`

### Diagrama de Estados do Contrato

```mermaid
stateDiagram-v2
    [*] --> rascunho: Criação do Contrato
    rascunho --> emitido: Emissão Formal do PDF
    rascunho --> cancelado: Cancelamento Administrativo
    
    emitido --> enviado: Registro de Envio (E-mail/Zap)
    emitido --> cancelado: Cancelamento
    
    enviado --> assinado: Assinatura Registrada
    enviado --> cancelado: Desistência / Recusa
    
    assinado --> encerrado: Término Regular da Vigência
    assinado --> distratado: Solicitação de Distrato
    
    distratado --> distrato_assinado: Assinatura do Termo de Distrato
    
    cancelado --> [*]
    encerrado --> [*]
    distrato_assinado --> [*]

    note right of rascunho: Não conta no quadro ativo
    note right of emitido: Conta no quadro ativo
    note right of enviado: Conta no quadro ativo
    note right of assinado: Conta no quadro ativo
    note right of distratado: Visão separada de distratos
    note right of distrato_assinado: Histórico arquivado
```

### Emissão e Compilação de PDF

1. **Mescla com Template:** Os marcadores `{{nome}}`, `{{cpf}}`, `{{endereco}}`, `{{objeto}}`, `{{vigencia_inicio}}` e `{{vigencia_fim}}` são substituídos pelas informações do contratado.
2. **Cálculo de Extenso Gramatical:** O valor numérico passa pela biblioteca `extenso`, gerando a redação legal em reais de forma infalível (ex.: `R$ 3.553,00` $\rightarrow$ `"três mil quinhentos e cinquenta e três reais"`).
3. **Renderização Vetorial:** O PDF institucional é compilado diretamente no servidor via `pdf-lib` e persistido no bucket `contratos`.
4. **Transação Atômica:** A mudança de estado para `emitido` e a inserção em `eventos_contrato` ocorrem na mesma transação. Se uma falhar, toda a operação sofre rollback.

### Diagrama de Sequência: Emissão e Assinatura com Transação Atômica

```mermaid
sequenceDiagram
    autonumber
    actor Coord as Gestor / Coordenador
    participant Painel as Interface Web
    participant Action as Server Action (Contratos)
    participant Engine as Engine PDF & Extenso
    participant DB as PostgreSQL (Transação)
    participant Notif as Motor de Notificações

    Coord->>Painel: Solicita emissão do contrato
    Painel->>Action: emitirContrato(pessoaId, templateId, valor, datas)
    Action->>Engine: Calcula extenso do valor monetário
    Engine-->>Action: "três mil quinhentos e cinquenta e três reais"
    Action->>Engine: Compila PDF via pdf-lib
    Engine-->>Action: Buffer do PDF final
    Action->>DB: Inicia Transação BEGIN
    Action->>DB: Grava PDF no Storage Privado
    Action->>DB: INSERT INTO contratos (status: 'emitido', ...)
    Action->>DB: INSERT INTO eventos_contrato (status_anterior: 'rascunho', status_novo: 'emitido')
    Action->>DB: COMMIT
    DB-->>Action: Sucesso na persistência

    Coord->>Painel: Registra envio para o contratado
    Painel->>Action: registrarEnvio(contratoId, canal, destinatario)
    Action->>DB: Transição 'emitido' -> 'enviado' + eventos_contrato
    Action->>Notif: dispararNotificacao('contrato_enviado')
    Notif-->>Coord: E-mail de aviso enviado ao contratado

    Coord->>Painel: Faz upload do PDF assinado
    Painel->>Action: registrarAssinatura(contratoId, arquivo)
    Action->>DB: Transição 'enviado' -> 'assinado' + eventos_contrato
    Action-->>Painel: Contrato finalizado e ativo
```

---

## 6. Processo 5: Operação de Campo, Mobilidade e Capacidade Offline (PWA)

A rotina de campo foi desenhada para condições adversas: conexões oscilantes, aparelhos simples e uso sob movimento.

### Princípios da Operação Mobile

* **Viewport de 360 px:** Toda a interface de campo funciona em telas compactas, com botões de toque generosos dimensionados para o uso com uma só mão.
* **Regra dos 3 Toques:** A partir da tela inicial do PWA, o apontamento de atividade (ex.: panfletagem, montagem de estrutura, comício) é concluído em no máximo 3 interações.
* **Fila Local no IndexedDB:** Na ausência de sinal de internet, os registros não são perdidos: são serializados no banco local do navegador.
* **Sincronização com Indicador Honesto:** Um banner transparente informa a quantidade de itens na fila pendente. Ao detectar reconexão (`navigator.onLine`), o sistema processa a fila sequencialmente contra o servidor.

### Diagrama de Fluxo: Operação Offline e Sincronização de Campo

```mermaid
flowchart TD
    A["Operador de Campo<br/>Abre PWA no Celular"] --> B["Acessa Tela /atividades<br/>(Viewport 360px)"]
    B --> C["Preenche Tipo, Quantidade e Foto<br/>(Em até 3 toques)"]
    C --> D{"Conexão com a<br/>Internet Ativa?"}

    D -- "Sim" --> E["Envia diretamente via Server Action"]
    E --> F["Grava em registros_atividade<br/>no PostgreSQL"]
    F --> G["Feedback visual de sucesso imediato"]

    D -- "Não (Offline)" --> H["Salva na Fila Local IndexedDB<br/>(idb storage)"]
    H --> I["Exibe Banner:<br/>'1 registro salvo offline'"]
    I --> J["Operador continua trabalhando normalmente"]

    J --> K{"Evento 'online'<br/>detectado pelo navegador?"}
    K -- "Aguardando" --> K
    K -- "Sim" --> L["Dispara sincronizarFilaOffline()"]
    L --> M["Lê itens pendentes do IndexedDB"]
    M --> N["Submete lote para /api/atividades/sincronizar"]
    N --> O["Grava no PostgreSQL com sincronizado_em = NOW()"]
    O --> P["Limpa itens correspondentes do IndexedDB"]
    P --> Q["Banner atualiza: 'Tudo sincronizado!'"]
```

---

## 7. Processo 6: Monitoramento Executivo em Tempo Real e Detalhamento Progressivo

O gestor e os coordenadores acompanham a evolução da equipe por um painel em tempo real sem necessidade de recarregar a página manualmente.

### Arquitetura do Dashboard

* **Canal Realtime Resiliente:** Uma assinatura única de WebSocket monitora as tabelas `contratos`, `pessoas`, `documentos` e `notificacoes`.
* **Degradação Graciosa:** Se a conexão de WebSocket oscilar ou fechar (`CHANNEL_ERROR` ou `TIMED_OUT`), o sistema ativa um polling inteligente automático a cada 5 segundos até que a conexão Realtime se restabeleça.
* **Detalhamento Progressivo (*Drill-Down* em 2 Cliques):**
  * *1º Clique:* Em qualquer número do painel (matriz, funil ou card regional), abre-se um modal com a lista nominal correspondente.
  * *2º Clique:* Clicando sobre o nome da pessoa no modal, o sistema gera uma URL assinada e abre o documento comprobatório ou o PDF do contrato numa nova aba.
* **Tratamento de Lacunas de Dados:** Regiões sem dados preenchidos (como o caso real de Taguatinga com contratos sem assinatura informada) exibem o rótulo explícito **"não informado"**, evitando inflar métricas com zeros falsos.

### Diagrama de Sequência: Atualização Realtime e Drill-Down Progressivo

```mermaid
sequenceDiagram
    autonumber
    actor Gestor as Gestor no Dashboard
    participant Browser as Cliente Next.js (Dashboard)
    participant Socket as Supabase Realtime (WS)
    participant DB as PostgreSQL
    actor Coord as Coordenador em Campo

    Gestor->>Browser: Abre /dashboard
    Browser->>DB: Carrega estado consolidado inicial
    Browser->>Socket: Assina canal Realtime 'dashboard-realtime'
    Socket-->>Browser: Confirmação SUBSCRIBED

    Coord->>DB: Aprova documento ou registra assinatura de contrato
    DB->>Socket: Publica evento INSERT/UPDATE (Postgres Changes)
    Socket->>Browser: Transmite evento pelo WebSocket (< 3s)
    Browser->>Browser: Recalcula agregações da matriz e funil no cliente
    Browser-->>Gestor: Interface atualiza instantaneamente sem piscar

    Note over Gestor,Browser: Fluxo de Detalhamento Progressivo (2 Cliques)
    Gestor->>Browser: 1º Clique: Clica no número '14' (Contratos Administrativos)
    Browser->>Browser: Filtra lista nominal já em memória e abre Modal
    Gestor->>Browser: 2º Clique: Clica sobre 'Eduardo da Silva' no modal
    Browser->>DB: Chama Server Action gerarUrlAssinada(documentoId)
    DB-->>Browser: Retorna URL temporária (validade 15 min)
    Browser-->>Gestor: Abre o contrato original assinado em nova aba
```

---

## 8. Processo 7: Motor de Mensageria, Idempotência e Automações Periódicas (pg_cron)

O sistema conta com um motor de automação que antecipa pendências operacionais e elimina a necessidade de cobranças manuais.

### Garantias de Entrega e Idempotência

1. **Chaves Determinísticas:** Antes de solicitar o envio de qualquer e-mail pelo Resend, o sistema grava uma linha na tabela `notificacoes` com uma chave determinística única (ex.: `contrato_enviado:{contrato_id}` ou `vigencia_a_vencer:{contrato_id}:7d`).
2. **Proteção contra Duplicatas:** Se o agendador rodar repetidas vezes no mesmo dia, o índice único do banco recusa a inserção da chave repetida, impedindo disparos múltiplos para o mesmo evento.
3. **Resiliência a Falhas do Provedor:** A falha no serviço de e-mail nunca cancela a transação principal de negócio: o contrato permanece emitido/enviado, e a notificação é marcada como `falhou`, sendo capturada pela rotina de reprocessamento.
4. **Agendamento com `pg_cron` e Segurança via `CRON_SECRET`:** As rotas de cron em `/api/cron/*` só podem ser disparadas mediante o envio do cabeçalho `Authorization: Bearer <CRON_SECRET>`, protegendo as rotinas contra execuções não autorizadas.

### As Quatro Automações do Sistema

| Job Agendado | Frequência | Objetivo Operacional |
|---|---|---|
| **Vigências a Vencer** | Diariamente às 07:00 | Alerta gestores sobre contratos que expirarão em 7 ou 3 dias |
| **Lembrete de Assinatura** | Diariamente às 07:30 | Cobra contratados com contratos em `enviado` há mais de 3 dias |
| **Resumo Diário** | Dias úteis às 08:00 (Brasília) | Envia ao gestor um balanço das últimas 24h e lista de pendências |
| **Reprocessamento** | A cada 15 minutos | Retenta notificações `falhou` com recuo exponencial (máx. 3 vezes) |

### Diagrama de Sequência: Automações Periódicas com pg_cron

```mermaid
sequenceDiagram
    autonumber
    participant Cron as pg_cron (Agendador do Banco)
    participant Route as Route Handler (/api/cron/*)
    participant Auth as Validador CRON_SECRET
    participant DB as PostgreSQL
    participant Resend as Provedor Resend
    actor Destinatario as Gestor / Contratado

    Cron->>Route: Dispara POST /api/cron/vigencias (com Bearer Token)
    Route->>Auth: Valida cabeçalho contra env.CRON_SECRET
    
    alt Token Inválido ou Ausente
        Auth-->>Route: Recusado
        Route-->>Cron: HTTP 401 Unauthorized
    else Token Válido
        Auth-->>Route: Autorizado
        Route->>DB: Busca contratos que vencem em exatamente 7 ou 3 dias
        DB-->>Route: Retorna lista de contratos elegíveis
        
        loop Para cada contrato identificado
            Route->>DB: Tenta INSERT INTO notificacoes (chave_idempotencia)
            alt Chave já existe (notificação já foi gerada antes)
                DB-->>Route: Erro de Unique Constraint (Chave Duplicada)
                Note over Route: Pula envio com segurança (Idempotente)
            else Chave nova
                DB-->>Route: Registro gravado com status 'enfileirada'
                Route->>Resend: Envia e-mail via React Email Template
                alt Envio Bem-Sucedido
                    Resend-->>Route: Retorna resend_id
                    Route->>DB: UPDATE notificacoes SET status = 'enviada'
                    Resend-->>Destinatario: Entrega o e-mail na caixa postal
                else Falha no Provedor
                    Route->>DB: UPDATE notificacoes SET status = 'falhou', tentativas = 1
                end
            end
        end
        Route-->>Cron: HTTP 200 OK (Processamento Concluído)
    end
```

---

## 9. Processo 8: Trilha de Auditoria, Segurança e Conformidade com a LGPD

A integridade do acervo é assegurada por mecanismos de proteção e rastreabilidade que atendem aos preceitos da Lei Geral de Proteção de Dados (LGPD).

### Medidas de Blindagem

* **Isolamento Criptográfico em Buckets Privados:** Nenhum anexo repousa em links públicos estáticos. Todos os buckets de documentos e contratos são estritamente privados. O acesso só ocorre por URLs assinadas pelo servidor, com validade máxima de 15 minutos.
* **Tabelas Somente-Inserção (*Append-Only*):** As tabelas `log_auditoria` e `eventos_contrato` não possuem políticas de `UPDATE` ou `DELETE` no RLS. Uma vez gravado, o evento torna-se imutável.
* **Rastreabilidade de Visualização:** Toda chamada à função `criarUrlAssinada` registra um evento no `log_auditoria`, registrando o usuário solicitante, a pessoa consultada, o endereço IP e o timestamp da operação.
* **Minimização de Dados Sensíveis:** Comunicações transacionais (e-mails e logs do sistema) são terminantemente proibidas de exibir dados como CPF, RG, endereço, chave PIX ou valor contratual no corpo da mensagem. O e-mail serve exclusivamente como gatilho de redirecionamento para o ambiente seguro.

### Diagrama de Fluxo: Acesso Seguro e Trilha de Auditoria

```mermaid
flowchart TD
    A["Usuário Clica para Ver Documento Pessoal"] --> B["Requisição enviada a Server Action Segura"]
    B --> C["Verificação de Sessão e Permissões (JWT / RLS)"]
    C --> D{"Usuário tem Permissão<br/>sobre esta Região/Pessoa?"}
    
    D -- "Não" --> E["Erro 403 Forbidden<br/>Acesso Negado"]
    
    D -- "Sim" --> F["Registra Acesso em log_auditoria<br/>(usuario_id, documento_id, ip, timestamp)"]
    F --> G["Gera URL Assinada via Supabase Storage<br/>(Tempo de Vida: 15 minutos)"]
    G --> H["Retorna URL Segura para o Navegador"]
    H --> I["Navegador Exibe o Documento em Aba Protegida"]
    
    subgraph Auditoria["Camada de Auditoria Imutável"]
        F -.-> J[("Tabela log_auditoria<br/>(Sem permissão de UPDATE/DELETE)")]
    end
```

---

## 10. Modelo Entidade-Relacionamento do Banco de Dados

Abaixo está o diagrama formal das entidades, tipos enumerados e relacionamentos que compõem o banco de dados relacional do Comitê Digital:

```mermaid
erDiagram
    organizacoes ||--o{ usuarios : possui
    organizacoes ||--o{ regioes : divide_se_em
    organizacoes ||--o{ pessoas : cadastra
    organizacoes ||--o{ templates_contrato : padroniza
    organizacoes ||--o{ contratos : celebra
    organizacoes ||--o{ documentos : arquiva
    organizacoes ||--o{ registros_atividade : supervisiona
    organizacoes ||--o{ links_coleta : emite
    organizacoes ||--o{ notificacoes : despacha
    organizacoes ||--o{ log_auditoria : audita

    regioes ||--o{ usuarios : aloca
    regioes ||--o{ pessoas : vincula
    regioes ||--o{ registros_atividade : localiza

    pessoas ||--o{ contratos : firma
    pessoas ||--o{ documentos : fornece
    pessoas ||--o{ registros_atividade : executa
    pessoas ||--o{ links_coleta : recebe

    templates_contrato ||--o{ contratos : baseia

    contratos ||--o{ eventos_contrato : registra_historico

    organizacoes {
        uuid id PK
        text nome
        text cnpj
        boolean ativa
        timestamp criado_em
    }

    usuarios {
        uuid id PK
        uuid organizacao_id FK
        text nome
        text email
        papel_usuario papel
        uuid regiao_id FK
    }

    regioes {
        uuid id PK
        uuid organizacao_id FK
        text nome
    }

    pessoas {
        uuid id PK
        uuid organizacao_id FK
        text nome_completo
        text cpf UK
        text rg
        text telefone
        text email
        uuid regiao_id FK
        text funcao
        boolean apta
    }

    templates_contrato {
        uuid id PK
        uuid organizacao_id FK
        text nome
        text objeto
        text corpo_html
        numeric valor_padrao
        boolean ativo
    }

    contratos {
        uuid id PK
        uuid organizacao_id FK
        uuid pessoa_id FK
        uuid template_id FK
        text objeto
        numeric valor
        text valor_extenso
        date vigencia_inicio
        date vigencia_fim
        status_contrato status
        timestamp emitido_em
        timestamp enviado_em
        timestamp assinado_em
    }

    eventos_contrato {
        uuid id PK
        uuid contrato_id FK
        status_contrato status_anterior
        status_contrato status_novo
        uuid usuario_id FK
        text observacao
        timestamp ocorrido_em
    }

    documentos {
        uuid id PK
        uuid organizacao_id FK
        uuid pessoa_id FK
        text tipo
        text caminho_storage
        text nome_original
        text hash_sha256
        integer largura_px
        integer altura_px
        integer bytes
        status_documento status
        integer versao
    }

    registros_atividade {
        uuid id PK
        uuid organizacao_id FK
        uuid pessoa_id FK
        uuid regiao_id FK
        date data
        text tipo
        integer quantidade
        text observacao
        timestamp sincronizado_em
    }

    links_coleta {
        uuid id PK
        uuid organizacao_id FK
        uuid pessoa_id FK
        text token UK
        timestamp expira_em
        timestamp usado_em
    }

    notificacoes {
        uuid id PK
        uuid organizacao_id FK
        tipo_notificacao tipo
        text destinatario_email
        text chave_idempotencia UK
        status_notificacao status
        integer tentativas
        timestamp enviada_em
    }

    log_auditoria {
        uuid id PK
        uuid organizacao_id FK
        uuid usuario_id FK
        text acao
        text entidade
        uuid entidade_id
        text ip
        timestamp ocorrido_em
    }
```

---

## Conclusão

Este manual documenta o ecossistema integrado do **Comitê Digital**. Ao articular validações preventivas na entrada de dados, persistência relacional com garantia transacional, controle de concorrência por RLS e atualizações reativas em tempo real, o sistema garante conformidade jurídica integral, governança de ponta a ponta e eficiência operacional para equipes temporárias.
