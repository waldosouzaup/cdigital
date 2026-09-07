/**
 * Schema Drizzle — Seção 5 do PROMPT-Comite-Digital.md.
 *
 * Convenção de nomes (Regra 8): identificadores do TypeScript (nomes de export, de
 * propriedade) em inglês; nomes de tabela, de coluna e valores de enum em português,
 * exatamente como a Seção 5 os declara — são eles que viram SQL.
 *
 * RLS: cada tabela com organizacao_id ganha uma policy permissiva de isolamento por
 * organização (usando public.organizacao_id(), definida em
 * supabase/migrations/0001_auth_claims.sql) e uma policy restritiva de MFA. Quatro
 * tabelas (pessoas, contratos, documentos, registros_atividade) ganham também a
 * restrição de região para coord_regiao (Seção 5, "Regras de integridade
 * obrigatórias"). A granularidade de "quem pode editar o quê" da Seção 8 (ex.: só
 * gestor edita templates) é decisão de Server Action na Fase 2 — RLS aqui cuida só do
 * isolamento multi-tenant, que é o que a Fase 1 pede.
 */
import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUsers } from "drizzle-orm/supabase";

// ---------------------------------------------------------------------------
// Enums (Seção 5)
// ---------------------------------------------------------------------------

export const userRoleEnum = pgEnum("papel_usuario", [
  "gestor",
  "coord_comite",
  "coord_regiao",
  "contratado",
  "auditor",
]);

export const contractStatusEnum = pgEnum("status_contrato", [
  "rascunho",
  "emitido",
  "enviado",
  "assinado",
  "distratado",
  "distrato_assinado",
  "encerrado",
  "cancelado",
]);

export const documentStatusEnum = pgEnum("status_documento", ["pendente", "aprovado", "rejeitado"]);

export const deliveryChannelEnum = pgEnum("canal_envio", ["email", "whatsapp", "presencial"]);

export const notificationStatusEnum = pgEnum("status_notificacao", [
  "enfileirada",
  "enviada",
  "entregue",
  "falhou",
  "bounce",
  "reclamada",
]);

export const notificationTypeEnum = pgEnum("tipo_notificacao", [
  "link_coleta",
  "documento_rejeitado",
  "contrato_enviado",
  "lembrete_assinatura",
  "vigencia_a_vencer",
  "resumo_diario",
  "pessoa_apta",
]);

// ---------------------------------------------------------------------------
// Colunas comuns a todas as tabelas (Seção 5: "adicione id uuid pk, criado_em e
// atualizado_em em todas")
// ---------------------------------------------------------------------------

const timestamps = {
  createdAt: timestamp("criado_em", { withTimezone: true }).notNull().defaultNow(),
  // Mantida atualizada por trigger no banco (ver supabase/migrations) — funciona
  // independente de a escrita vir do Drizzle, do PostgREST ou de um job.
  updatedAt: timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow(),
};

// ---------------------------------------------------------------------------
// Helpers de RLS — ver o comentário do topo do arquivo para o raciocínio.
// ---------------------------------------------------------------------------

/**
 * Isolamento por organização, para todas as operações.
 *
 * `(select public.organizacao_id())`, não `public.organizacao_id()` puro — achado do
 * skill oficial `supabase-postgres-best-practices` (instalado após a Tarefa 8):
 * envolver a chamada em `select` deixa o Postgres avaliar a função uma vez por
 * consulta em vez de uma vez por linha (InitPlan cacheado vs. reavaliação por
 * linha) — até 100x mais rápido em tabelas grandes. Relevante aqui porque a Seção
 * 10 exige dashboard < 2s com 2.000 contratos.
 */
function organizationPolicy(name: string, organizationIdColumn: AnyPgColumn) {
  const condition = sql`${organizationIdColumn} = (select public.organizacao_id())`;
  return pgPolicy(name, {
    as: "permissive",
    for: "all",
    to: authenticatedRole,
    using: condition,
    withCheck: condition,
  });
}

/**
 * Isolamento por organização + região: coord_regiao só enxerga linhas da própria
 * região; os demais papéis não são restritos por região. Mesmo cuidado de
 * performance do comentário de `organizationPolicy` acima.
 */
function organizationAndRegionPolicy(
  name: string,
  organizationIdColumn: AnyPgColumn,
  regionIdColumn: AnyPgColumn,
) {
  const condition = sql`${organizationIdColumn} = (select public.organizacao_id()) AND ((select public.papel()) <> 'coord_regiao' OR ${regionIdColumn} = (select public.regiao_id()))`;
  return pgPolicy(name, {
    as: "permissive",
    for: "all",
    to: authenticatedRole,
    using: condition,
    withCheck: condition,
  });
}

/**
 * MFA obrigatório para gestor e coord_comite (Seção 3, item 6 da Fase 1). Restritiva:
 * intersecta (AND) com toda policy permissiva da mesma tabela — nunca afrouxa nada
 * sozinha, só pode negar. Mesmo cuidado de performance das duas anteriores.
 */
function mfaGatePolicy(name: string) {
  const condition = sql`(select public.papel()) NOT IN ('gestor', 'coord_comite') OR ((select auth.jwt()) ->> 'aal') = 'aal2'`;
  return pgPolicy(name, {
    as: "restrictive",
    for: "all",
    to: authenticatedRole,
    using: condition,
    withCheck: condition,
  });
}

/**
 * Para tabelas somente-inserção (eventos_contrato, log_auditoria): só select e
 * insert ganham policy. Sem policy de update/delete, o RLS nega as duas por padrão.
 */
function organizationReadInsertPolicies(prefix: string, condition: SQL) {
  return [
    pgPolicy(`${prefix}_select`, {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: condition,
    }),
    pgPolicy(`${prefix}_insert`, {
      as: "permissive",
      for: "insert",
      to: authenticatedRole,
      withCheck: condition,
    }),
  ];
}

// ---------------------------------------------------------------------------
// organizacoes — só leitura pela própria organização; criação é tarefa de
// onboarding via service_role (admin.ts), não de usuário autenticado.
// ---------------------------------------------------------------------------

export const organizations = pgTable(
  "organizacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("nome").notNull(),
    cnpj: text("cnpj"),
    active: boolean("ativa").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    pgPolicy("organizacoes_select", {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = (select public.organizacao_id())`,
    }),
    mfaGatePolicy("organizacoes_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// regioes (antes de usuarios/pessoas no arquivo por dependência de FK; a ordem de
// listagem da Seção 5 é organizacoes, usuarios, regioes — aqui invertida só entre
// essas duas por necessidade de declaração)
// ---------------------------------------------------------------------------

export const regions = pgTable(
  "regioes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    name: text("nome").notNull(),
    ...timestamps,
  },
  (table) => [
    pgPolicy("regioes_select", {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: sql`${table.organizationId} = (select public.organizacao_id())`,
    }),
    mfaGatePolicy("regioes_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// usuarios — id referencia auth.users(id) do Supabase Auth (drizzle-orm/supabase),
// sem valor default: o id já vem definido pelo Supabase Auth na criação do usuário.
// ---------------------------------------------------------------------------

export const users = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    name: text("nome").notNull(),
    email: text("email").notNull(),
    role: userRoleEnum("papel").notNull(),
    // Nulo exceto para coord_regiao (Seção 5).
    regionId: uuid("regiao_id").references(() => regions.id),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [authUsers.id],
      name: "usuarios_id_auth_users_id_fk",
    }).onDelete("cascade"),
    organizationPolicy("usuarios_organizacao", table.organizationId),
    mfaGatePolicy("usuarios_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// pessoas
// ---------------------------------------------------------------------------

export const people = pgTable(
  "pessoas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    fullName: text("nome_completo").notNull(),
    cpf: text("cpf").notNull(),
    rg: text("rg"),
    birthDate: date("data_nascimento"),
    address: text("endereco"),
    zipCode: text("cep"),
    phone: text("telefone"),
    email: text("email"),
    regionId: uuid("regiao_id").references(() => regions.id),
    role: text("funcao"),
    bank: text("banco"),
    bankBranch: text("agencia"),
    bankAccount: text("conta"),
    eligible: boolean("apta").notNull().default(false),
    ...timestamps,
  },
  (table) => [
    // "CPF único por organização (impede a duplicata que hoje passa despercebida)"
    uniqueIndex("pessoas_organizacao_id_cpf_idx").on(table.organizationId, table.cpf),
    organizationAndRegionPolicy("pessoas_organizacao_regiao", table.organizationId, table.regionId),
    mfaGatePolicy("pessoas_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// templates_contrato
// ---------------------------------------------------------------------------

export const contractTemplates = pgTable(
  "templates_contrato",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    name: text("nome").notNull(),
    subject: text("objeto").notNull(),
    bodyHtml: text("corpo_html").notNull(),
    defaultAmount: numeric("valor_padrao", { precision: 12, scale: 2 }),
    active: boolean("ativo").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    organizationPolicy("templates_contrato_organizacao", table.organizationId),
    mfaGatePolicy("templates_contrato_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// contratos
// ---------------------------------------------------------------------------

export const contracts = pgTable(
  "contratos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    personId: uuid("pessoa_id")
      .notNull()
      .references(() => people.id),
    templateId: uuid("template_id").references(() => contractTemplates.id),
    // Desnormalizado a partir de pessoas.regiao_id (trigger em
    // supabase/migrations/0002_triggers.sql) — evita subconsulta por linha na policy
    // de RLS abaixo, que é exatamente o problema que a Seção 3.1 pede para evitar.
    regionId: uuid("regiao_id").references(() => regions.id),
    subject: text("objeto").notNull(),
    amount: numeric("valor", { precision: 12, scale: 2 }).notNull(),
    amountInWords: text("valor_extenso").notNull(),
    termStart: date("vigencia_inicio").notNull(),
    termEnd: date("vigencia_fim").notNull(),
    status: contractStatusEnum("status").notNull().default("rascunho"),
    issuedAt: timestamp("emitido_em", { withTimezone: true }),
    sentAt: timestamp("enviado_em", { withTimezone: true }),
    deliveryChannel: deliveryChannelEnum("canal_envio"),
    sentTo: text("enviado_para"),
    signedAt: timestamp("assinado_em", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // "Vigência coerente" (Seção 5, Regras de integridade obrigatórias)
    check("vigencia_valida", sql`${table.termEnd} >= ${table.termStart}`),
    check("valor_positivo", sql`${table.amount} > 0`),
    check(
      "ordem_datas",
      sql`${table.sentAt} IS NULL OR ${table.issuedAt} IS NULL OR ${table.sentAt} >= ${table.issuedAt}`,
    ),
    organizationAndRegionPolicy(
      "contratos_organizacao_regiao",
      table.organizationId,
      table.regionId,
    ),
    mfaGatePolicy("contratos_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// eventos_contrato — somente inserção; sem organizacao_id própria (Seção 5), por
// isso a policy verifica via EXISTS no contrato — join indexado (contrato_id é FK,
// contratos.id é PK), não a subconsulta por linha em `usuarios` que a Seção 3.1 evita.
// ---------------------------------------------------------------------------

export const contractEvents = pgTable(
  "eventos_contrato",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contractId: uuid("contrato_id")
      .notNull()
      .references(() => contracts.id),
    previousStatus: contractStatusEnum("status_anterior"),
    newStatus: contractStatusEnum("status_novo").notNull(),
    // Nulo para eventos gerados por job/seed, sem um usuário humano por trás.
    userId: uuid("usuario_id").references(() => users.id),
    observation: text("observacao"),
    occurredAt: timestamp("ocorrido_em", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    ...organizationReadInsertPolicies(
      "eventos_contrato_organizacao",
      sql`exists (select 1 from contratos c where c.id = ${table.contractId} and c.organizacao_id = (select public.organizacao_id()))`,
    ),
    mfaGatePolicy("eventos_contrato_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// documentos
// ---------------------------------------------------------------------------

export const documents = pgTable(
  "documentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    personId: uuid("pessoa_id")
      .notNull()
      .references(() => people.id),
    // Desnormalizado a partir de pessoas.regiao_id — mesmo motivo de contratos.regiao_id.
    regionId: uuid("regiao_id").references(() => regions.id),
    type: text("tipo").notNull(),
    storagePath: text("caminho_storage").notNull(),
    originalName: text("nome_original").notNull(),
    hashSha256: text("hash_sha256").notNull(),
    widthPx: integer("largura_px"),
    heightPx: integer("altura_px"),
    bytes: bigint("bytes", { mode: "number" }),
    status: documentStatusEnum("status").notNull().default("pendente"),
    rejectionReason: text("motivo_rejeicao"),
    version: integer("versao").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    // "Documento idêntico não entra duas vezes" (Seção 5)
    uniqueIndex("documentos_organizacao_id_hash_sha256_idx").on(
      table.organizationId,
      table.hashSha256,
    ),
    organizationAndRegionPolicy(
      "documentos_organizacao_regiao",
      table.organizationId,
      table.regionId,
    ),
    mfaGatePolicy("documentos_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// registros_atividade
// ---------------------------------------------------------------------------

export const activityRecords = pgTable(
  "registros_atividade",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    personId: uuid("pessoa_id")
      .notNull()
      .references(() => people.id),
    regionId: uuid("regiao_id").references(() => regions.id),
    date: date("data").notNull(),
    type: text("tipo").notNull(),
    quantity: integer("quantidade").notNull(),
    photoPath: text("foto_caminho"),
    observation: text("observacao"),
    syncedAt: timestamp("sincronizado_em", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    organizationAndRegionPolicy(
      "registros_atividade_organizacao_regiao",
      table.organizationId,
      table.regionId,
    ),
    mfaGatePolicy("registros_atividade_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// links_coleta — a policy abaixo cobre o uso autenticado (painel). O acesso público
// e não-autenticado de /coleta/[token] (sem JWT, sem organizacao_id) é um desenho à
// parte, resolvido na Fase 2 — provavelmente uma função SECURITY DEFINER que valida
// só o token, não uma policy de RLS para o papel anon.
// ---------------------------------------------------------------------------

export const collectionLinks = pgTable(
  "links_coleta",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    personId: uuid("pessoa_id")
      .notNull()
      .references(() => people.id),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expira_em", { withTimezone: true }).notNull(),
    usedAt: timestamp("usado_em", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    organizationPolicy("links_coleta_organizacao", table.organizationId),
    mfaGatePolicy("links_coleta_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// notificacoes
// ---------------------------------------------------------------------------

export const notifications = pgTable(
  "notificacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    type: notificationTypeEnum("tipo").notNull(),
    recipientEmail: text("destinatario_email").notNull(),
    // "entidade" + "entidade_id" formam uma referência polimórfica (contrato, pessoa,
    // etc.) — por isso entidade_id não tem FK de banco, só o nome da tabela em texto.
    entity: text("entidade").notNull(),
    entityId: uuid("entidade_id").notNull(),
    // "Cada notificação é enviada uma única vez" (Seção 5)
    idempotencyKey: text("chave_idempotencia").notNull().unique(),
    resendId: text("resend_id"),
    status: notificationStatusEnum("status").notNull().default("enfileirada"),
    attempts: integer("tentativas").notNull().default(0),
    error: text("erro"),
    sentAt: timestamp("enviada_em", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    organizationPolicy("notificacoes_organizacao", table.organizationId),
    mfaGatePolicy("notificacoes_mfa"),
  ],
);

// ---------------------------------------------------------------------------
// log_auditoria — somente inserção
// ---------------------------------------------------------------------------

export const auditLog = pgTable(
  "log_auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    // Nulo para ações automáticas (job, webhook) sem um usuário humano por trás.
    userId: uuid("usuario_id").references(() => users.id),
    action: text("acao").notNull(),
    entity: text("entidade").notNull(),
    entityId: uuid("entidade_id"),
    ip: text("ip"),
    occurredAt: timestamp("ocorrido_em", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("log_auditoria_organizacao_id_ocorrido_em_idx").on(
      table.organizationId,
      table.occurredAt,
    ),
    ...organizationReadInsertPolicies(
      "log_auditoria_organizacao",
      sql`${table.organizationId} = (select public.organizacao_id())`,
    ),
    mfaGatePolicy("log_auditoria_mfa"),
  ],
);
