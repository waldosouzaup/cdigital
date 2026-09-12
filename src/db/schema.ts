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
  jsonb,
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
  "superadmin",
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
  "distrato_enviado",
  "distrato_assinado",
  "contrato_assinado",
  "convite_usuario",
  "cadastro_recebido",
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
 * Isolamento por organização + região na LEITURA (coord_regiao só enxerga a
 * própria região), mas ESCRITA restrita a gestor e coord_comite (migration 0016 —
 * decisão do coordenador: aprovar documento e emitir/transicionar contrato deixam
 * de ser acessíveis a coord_regiao/auditor/contratado). A restritiva de MFA
 * continua por cima.
 */
function regionReadRoleWritePolicies(
  prefix: string,
  organizationIdColumn: AnyPgColumn,
  regionIdColumn: AnyPgColumn,
) {
  const write = sql`${organizationIdColumn} = (select public.organizacao_id()) AND (select public.papel()) IN ('gestor', 'coord_comite')`;
  return [
    pgPolicy(`${prefix}_select`, {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: sql`${organizationIdColumn} = (select public.organizacao_id()) AND ((select public.papel()) <> 'coord_regiao' OR ${regionIdColumn} = (select public.regiao_id()))`,
    }),
    pgPolicy(`${prefix}_mutacao_gestor_coord`, {
      as: "permissive",
      for: "all",
      to: authenticatedRole,
      using: write,
      withCheck: write,
    }),
  ];
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
    // Slug da URL pública de autoinscrição `/inscricao/<slug>` (migration 0017).
    // Único global (não multi-tenant) — o índice parcial abaixo.
    slug: text("slug"),
    // Qualificação da CONTRATANTE nos contratos (migration 0037) — antes estava
    // escrita dentro do modelo, o que fazia todo comitê emitir em nome de outro.
    address: text("endereco"),
    representativeName: text("representante_nome"),
    representativeRole: text("representante_cargo"),
    contractorQualification: text("qualificacao_contratante"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("organizacoes_slug_idx")
      .on(table.slug)
      .where(sql`${table.slug} is not null`),
    pgPolicy("organizacoes_select", {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: sql`${table.id} = (select public.organizacao_id()) OR (select public.papel()) = 'superadmin'`,
    }),
    pgPolicy("organizacoes_insert_superadmin", {
      as: "permissive",
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`(select public.papel()) = 'superadmin'`,
    }),
    // Item 4: o gestor edita a identidade (nome/CNPJ) da própria organização; superadmin edita qualquer uma.
    // Migration 0014 e 0023. A restritiva de MFA continua valendo por cima.
    pgPolicy("organizacoes_update_gestor", {
      as: "permissive",
      for: "update",
      to: authenticatedRole,
      using: sql`(${table.id} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
      withCheck: sql`(${table.id} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
    }),  ],
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
    // Item 2: o gestor cria/renomeia regiões da própria organização (migration
    // 0015). Sem DELETE — FK de pessoas/contratos/atividades/documentos/usuarios.
    pgPolicy("regioes_insert_gestor", {
      as: "permissive",
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor'`,
    }),
    pgPolicy("regioes_update_gestor", {
      as: "permissive",
      for: "update",
      to: authenticatedRole,
      using: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
      withCheck: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
    }),
    pgPolicy("regioes_delete_gestor", {
      as: "permissive",
      for: "delete",
      to: authenticatedRole,
      using: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
    }),
  ],
);

// ---------------------------------------------------------------------------
// funcoes_pretendidas — Catálogo de atividades/funções pretendidas para candidatura
// ---------------------------------------------------------------------------

export const intendedRoles = pgTable(
  "funcoes_pretendidas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("nome").notNull(),
    description: text("descricao"),
    active: boolean("ativa").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("funcoes_pretendidas_org_nome_idx").on(
      table.organizationId,
      sql`lower(trim(${table.name}))`,
    ),
    index("funcoes_pretendidas_org_ativa_idx").on(table.organizationId, table.active),
    pgPolicy("funcoes_select", {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: sql`${table.organizationId} = (select public.organizacao_id()) OR (select public.papel()) = 'superadmin'`,
    }),
    pgPolicy("funcoes_insert_gestor", {
      as: "permissive",
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
    }),
    pgPolicy("funcoes_update_gestor", {
      as: "permissive",
      for: "update",
      to: authenticatedRole,
      using: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
      withCheck: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
    }),
    pgPolicy("funcoes_delete_gestor", {
      as: "permissive",
      for: "delete",
      to: authenticatedRole,
      using: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
    }),
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
    // Desativar acesso sem apagar a linha (migration 0016) — há FK de
    // eventos_contrato/log_auditoria/expurgos apontando para usuarios.id. Usuário
    // com ativo=false não recebe claim nenhuma: o custom_access_token_hook
    // (migration 0016) filtra `ativo IS TRUE` no lookup.
    active: boolean("ativo").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    foreignKey({
      columns: [table.id],
      foreignColumns: [authUsers.id],
      name: "usuarios_id_auth_users_id_fk",
    }).onDelete("cascade"),
    // "email único por organização" (migration 0016) — um convite não cria duplicata.
    uniqueIndex("usuarios_organizacao_id_email_idx").on(table.organizationId, table.email),
    // coord_regiao obrigatoriamente tem região (migration 0016).
    check(
      "usuarios_regiao_obrigatoria_coord",
      sql`${table.role} <> 'coord_regiao' OR ${table.regionId} is not null`,
    ),
    // Gestão de acessos (migration 0016): leitura para todos os autenticados da
    // organização (o custom_access_token_hook e disparos de notificação leem
    // usuarios), escrita só para o gestor. (A restritiva usuarios_mfa foi removida
    // na 0018 — MFA deixou de ser obrigatório.)
    pgPolicy("usuarios_select", {
      as: "permissive",
      for: "select",
      to: authenticatedRole,
      using: sql`${table.organizationId} = (select public.organizacao_id()) OR (select public.papel()) = 'superadmin'`,
    }),
    pgPolicy("usuarios_insert_gestor", {
      as: "permissive",
      for: "insert",
      to: authenticatedRole,
      withCheck: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
    }),
    pgPolicy("usuarios_update_gestor", {
      as: "permissive",
      for: "update",
      to: authenticatedRole,
      using: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
      withCheck: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
    }),
    pgPolicy("usuarios_delete_gestor", {
      as: "permissive",
      for: "delete",
      to: authenticatedRole,
      using: sql`(${table.organizationId} = (select public.organizacao_id()) AND (select public.papel()) = 'gestor') OR (select public.papel()) = 'superadmin'`,
    }),
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
    // banco/agencia/conta: legado — a coleta passou a pedir a chave PIX (migration
    // 0019). Colunas mantidas para não perder dado antigo.
    bank: text("banco"),
    bankBranch: text("agencia"),
    bankAccount: text("conta"),
    pixKey: text("chave_pix"),
    eligible: boolean("apta").notNull().default(false),
    // Origem do cadastro (migration 0017): "autoinscricao" quando veio do link
    // público `/inscricao/[slug]`. NULL = legado / cadastro pelo painel.
    origin: text("origem"),
    ...timestamps,
  },
  (table) => [
    // "CPF único por organização (impede a duplicata que hoje passa despercebida)"
    uniqueIndex("pessoas_organizacao_id_cpf_idx").on(table.organizationId, table.cpf),
    organizationAndRegionPolicy("pessoas_organizacao_regiao", table.organizationId, table.regionId),
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
    // 'contrato' = modelo de minuta da emissão; 'distrato' = termo de rescisão
    // (migration 0034). Índice parcial no banco limita a um distrato por organização.
    type: text("tipo").notNull().default("contrato"),
    subject: text("objeto").notNull(),
    bodyHtml: text("corpo_html").notNull(),
    defaultAmount: numeric("valor_padrao", { precision: 12, scale: 2 }),
    active: boolean("ativo").notNull().default(true),
    ...timestamps,
  },
  (table) => [
    organizationPolicy("templates_contrato_organizacao", table.organizationId),
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
    // Gap da Fase 1: a Seção 5 lista os campos de contratos mas não um caminho de
    // Storage para o PDF gerado — o bucket `contratos` (Fase 1, Tarefa 7) já existia
    // sem nenhuma coluna apontando pra ele. Fechado na Fase 2 junto com a emissão
    // real (item 8). `pdfPath` é o PDF gerado pelo sistema na emissão; `signedPdfPath`
    // é o PDF assinado anexado (item 12); `distratoTermPath` é o termo de distrato
    // gerado (item 13) — mesmo contrato, nunca um registro novo (Seção 7: "sem
    // apagar o contrato original").
    pdfPath: text("caminho_pdf"),
    signedPdfPath: text("caminho_pdf_assinado"),
    distratoTermPath: text("caminho_termo_distrato"),
    signatureToken: text("token_assinatura").unique(),
    // Assinatura do termo de distrato (migration 0035) — capacidade separada da
    // do contrato de entrada, que a esta altura já foi consumida.
    distratoSignatureToken: text("token_assinatura_distrato").unique(),
    distratoSignatureExpiresAt: timestamp("assinatura_distrato_expira_em", { withTimezone: true }),
    distratoSignedAt: timestamp("distrato_assinado_em", { withTimezone: true }),
    signedDistratoTermPath: text("caminho_termo_distrato_assinado"),
    distratoSignatureEvidence: jsonb("distrato_assinatura_evidencias"),
    distratoTermSha256: text("termo_distrato_sha256"),
    signatureExpiresAt: timestamp("assinatura_expira_em", { withTimezone: true }),
    pdfSha256: text("pdf_sha256"),
    signatureEvidence: jsonb("assinatura_evidencias"),
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
    ...regionReadRoleWritePolicies("contratos", table.organizationId, table.regionId),
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
    ),  ],
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
    // Fase 4, item 6: marca o documento cujo objeto no Storage já foi apagado
    // pela política de retenção. O registro do expurgo fica em `expurgos`.
    purgedAt: timestamp("expurgado_em", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    // "Documento idêntico não entra duas vezes" (Seção 5)
    uniqueIndex("documentos_organizacao_id_hash_sha256_idx").on(
      table.organizationId,
      table.hashSha256,
    ),
    // "Reenvio cria versão + 1" (Fase 2, item 5) só é garantia de verdade com um
    // índice único — sem isso, dois envios concorrentes do mesmo tipo de documento
    // para a mesma pessoa poderiam colidir na mesma versão. Faltava desde a Fase 1
    // (o plano original já previa isto); fechado junto com o upload real (Fase 2,
    // migration 0006), que também trava por advisory lock antes de calcular a
    // próxima versão.
    uniqueIndex("documentos_pessoa_tipo_versao_idx").on(
      table.personId,
      table.type,
      table.version,
    ),
    ...regionReadRoleWritePolicies("documentos", table.organizationId, table.regionId),
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
    // Coordenada do registro (migration 0038). Nulável: sinal ruim é o cenário
    // normal em campo, e a fila offline precisa subir registro sem GPS.
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    accuracyM: numeric("precisao_m", { precision: 8, scale: 2 }),
    geoCapturedAt: timestamp("geo_capturada_em", { withTimezone: true }),
    syncedAt: timestamp("sincronizado_em", { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    organizationAndRegionPolicy(
      "registros_atividade_organizacao_regiao",
      table.organizationId,
      table.regionId,
    ),  ],
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
    iniciadoEm: timestamp("iniciado_em", { withTimezone: true }),
    ipOrigem: text("ip_origem"),
    geolocalizacao: jsonb("geolocalizacao"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (table) => [
    organizationPolicy("links_coleta_organizacao", table.organizationId),
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
    // Payload já renderizado (assunto/HTML/texto), guardado para o job de
    // reprocessamento da Fase 4 reenviar sem re-renderizar o template. Sem PII
    // (Seção 6, regra 7). Migration 0012.
    resendPayload: jsonb("payload_reenvio"),
    ...timestamps,
  },
  (table) => [
    organizationPolicy("notificacoes_organizacao", table.organizationId),
  ],
);

// ---------------------------------------------------------------------------
// expurgos — Fase 4, item 6. Registro append-only do expurgo de documentos
// pessoais ao fim da campanha (só select + insert; sem update/delete).
// ---------------------------------------------------------------------------

export const purges = pgTable(
  "expurgos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    documentId: uuid("documento_id")
      .notNull()
      .references(() => documents.id),
    personId: uuid("pessoa_id")
      .notNull()
      .references(() => people.id),
    type: text("tipo").notNull(),
    hashSha256: text("hash_sha256").notNull(),
    reason: text("motivo").notNull(),
    executedBy: uuid("executado_por").references(() => users.id),
    purgedAt: timestamp("expurgado_em", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    ...organizationReadInsertPolicies(
      "expurgos_organizacao",
      sql`${table.organizationId} = (select public.organizacao_id())`,
    ),  ],
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
    detalhes: jsonb("detalhes"),
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
    ),  ],
);

// ---------------------------------------------------------------------------
// dados_excluidos — Arquivamento permanente de registros excluídos do painel
// ---------------------------------------------------------------------------

export const deletedRecords = pgTable(
  "dados_excluidos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organizacao_id")
      .notNull()
      .references(() => organizations.id),
    recordType: text("tipo_registro").notNull().default("contrato"),
    recordId: uuid("registro_id"),
    data: jsonb("dados").notNull(),
    userId: uuid("usuario_id").references(() => users.id),
    userName: text("usuario_nome").notNull(),
    userLogin: text("usuario_login").notNull(),
    reason: text("motivo"),
    deletedAt: timestamp("excluido_em", { withTimezone: true }).notNull().defaultNow(),
    ...timestamps,
  },
  (table) => [
    index("dados_excluidos_organizacao_id_excluido_em_idx").on(
      table.organizationId,
      table.deletedAt,
    ),
    ...organizationReadInsertPolicies(
      "dados_excluidos_organizacao",
      sql`${table.organizationId} = (select public.organizacao_id())`,
    ),
  ],
);

