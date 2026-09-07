/**
 * Schema Drizzle — Seção 5 do PROMPT-Comite-Digital.md.
 *
 * Convenção de nomes (Regra 8): identificadores do TypeScript (nomes de export, de
 * propriedade) em inglês; nomes de tabela, de coluna e valores de enum em português,
 * exatamente como a Seção 5 os declara — são eles que viram SQL.
 *
 * RLS e policies entram em uma migration separada (Tarefa 4/5), não aqui.
 */
import { sql } from "drizzle-orm";
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
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";

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

export const documentStatusEnum = pgEnum("status_documento", [
  "pendente",
  "aprovado",
  "rejeitado",
]);

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
// organizacoes
// ---------------------------------------------------------------------------

export const organizations = pgTable("organizacoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("nome").notNull(),
  cnpj: text("cnpj"),
  active: boolean("ativa").notNull().default(true),
  ...timestamps,
});

// ---------------------------------------------------------------------------
// regioes (antes de usuarios/pessoas no arquivo por dependência de FK; a ordem de
// listagem da Seção 5 é organizacoes, usuarios, regioes — aqui invertida só entre
// essas duas por necessidade de declaração)
// ---------------------------------------------------------------------------

export const regions = pgTable("regioes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organizacao_id")
    .notNull()
    .references(() => organizations.id),
  name: text("nome").notNull(),
  ...timestamps,
});

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
  ],
);

// ---------------------------------------------------------------------------
// templates_contrato
// ---------------------------------------------------------------------------

export const contractTemplates = pgTable("templates_contrato", {
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
});

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
  ],
);

// ---------------------------------------------------------------------------
// eventos_contrato — somente inserção (RLS sem UPDATE/DELETE entra na Tarefa 5)
// ---------------------------------------------------------------------------

export const contractEvents = pgTable("eventos_contrato", {
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
});

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
  ],
);

// ---------------------------------------------------------------------------
// registros_atividade
// ---------------------------------------------------------------------------

export const activityRecords = pgTable("registros_atividade", {
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
});

// ---------------------------------------------------------------------------
// links_coleta
// ---------------------------------------------------------------------------

export const collectionLinks = pgTable("links_coleta", {
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
});

// ---------------------------------------------------------------------------
// notificacoes
// ---------------------------------------------------------------------------

export const notifications = pgTable("notificacoes", {
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
});

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
  (table) => [index("log_auditoria_organizacao_id_ocorrido_em_idx").on(table.organizationId, table.occurredAt)],
);
