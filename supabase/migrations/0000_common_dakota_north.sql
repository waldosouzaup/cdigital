CREATE TYPE "public"."status_contrato" AS ENUM('rascunho', 'emitido', 'enviado', 'assinado', 'distratado', 'distrato_assinado', 'encerrado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."canal_envio" AS ENUM('email', 'whatsapp', 'presencial');--> statement-breakpoint
CREATE TYPE "public"."status_documento" AS ENUM('pendente', 'aprovado', 'rejeitado');--> statement-breakpoint
CREATE TYPE "public"."status_notificacao" AS ENUM('enfileirada', 'enviada', 'entregue', 'falhou', 'bounce', 'reclamada');--> statement-breakpoint
CREATE TYPE "public"."tipo_notificacao" AS ENUM('link_coleta', 'documento_rejeitado', 'contrato_enviado', 'lembrete_assinatura', 'vigencia_a_vencer', 'resumo_diario', 'pessoa_apta');--> statement-breakpoint
CREATE TYPE "public"."papel_usuario" AS ENUM('gestor', 'coord_comite', 'coord_regiao', 'contratado', 'auditor');--> statement-breakpoint
CREATE TABLE "registros_atividade" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"regiao_id" uuid,
	"data" date NOT NULL,
	"tipo" text NOT NULL,
	"quantidade" integer NOT NULL,
	"foto_caminho" text,
	"observacao" text,
	"sincronizado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "log_auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"usuario_id" uuid,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid,
	"ip" text,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "links_coleta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "links_coleta_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "eventos_contrato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contrato_id" uuid NOT NULL,
	"status_anterior" "status_contrato",
	"status_novo" "status_contrato" NOT NULL,
	"usuario_id" uuid,
	"observacao" text,
	"ocorrido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "templates_contrato" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"objeto" text NOT NULL,
	"corpo_html" text NOT NULL,
	"valor_padrao" numeric(12, 2),
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contratos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"template_id" uuid,
	"objeto" text NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"valor_extenso" text NOT NULL,
	"vigencia_inicio" date NOT NULL,
	"vigencia_fim" date NOT NULL,
	"status" "status_contrato" DEFAULT 'rascunho' NOT NULL,
	"emitido_em" timestamp with time zone,
	"enviado_em" timestamp with time zone,
	"canal_envio" "canal_envio",
	"enviado_para" text,
	"assinado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vigencia_valida" CHECK ("contratos"."vigencia_fim" >= "contratos"."vigencia_inicio"),
	CONSTRAINT "valor_positivo" CHECK ("contratos"."valor" > 0),
	CONSTRAINT "ordem_datas" CHECK ("contratos"."enviado_em" IS NULL OR "contratos"."emitido_em" IS NULL OR "contratos"."enviado_em" >= "contratos"."emitido_em")
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"caminho_storage" text NOT NULL,
	"nome_original" text NOT NULL,
	"hash_sha256" text NOT NULL,
	"largura_px" integer,
	"altura_px" integer,
	"bytes" bigint,
	"status" "status_documento" DEFAULT 'pendente' NOT NULL,
	"motivo_rejeicao" text,
	"versao" integer DEFAULT 1 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notificacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"tipo" "tipo_notificacao" NOT NULL,
	"destinatario_email" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid NOT NULL,
	"chave_idempotencia" text NOT NULL,
	"resend_id" text,
	"status" "status_notificacao" DEFAULT 'enfileirada' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"erro" text,
	"enviada_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notificacoes_chave_idempotencia_unique" UNIQUE("chave_idempotencia")
);
--> statement-breakpoint
CREATE TABLE "organizacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"cnpj" text,
	"ativa" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pessoas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome_completo" text NOT NULL,
	"cpf" text NOT NULL,
	"rg" text,
	"data_nascimento" date,
	"endereco" text,
	"cep" text,
	"telefone" text,
	"email" text,
	"regiao_id" uuid,
	"funcao" text,
	"banco" text,
	"agencia" text,
	"conta" text,
	"apta" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regioes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"papel" "papel_usuario" NOT NULL,
	"regiao_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "registros_atividade" ADD CONSTRAINT "registros_atividade_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_atividade" ADD CONSTRAINT "registros_atividade_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "registros_atividade" ADD CONSTRAINT "registros_atividade_regiao_id_regioes_id_fk" FOREIGN KEY ("regiao_id") REFERENCES "public"."regioes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links_coleta" ADD CONSTRAINT "links_coleta_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "links_coleta" ADD CONSTRAINT "links_coleta_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_contrato" ADD CONSTRAINT "eventos_contrato_contrato_id_contratos_id_fk" FOREIGN KEY ("contrato_id") REFERENCES "public"."contratos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_contrato" ADD CONSTRAINT "eventos_contrato_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "templates_contrato" ADD CONSTRAINT "templates_contrato_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_template_id_templates_contrato_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."templates_contrato"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notificacoes" ADD CONSTRAINT "notificacoes_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_regiao_id_regioes_id_fk" FOREIGN KEY ("regiao_id") REFERENCES "public"."regioes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regioes" ADD CONSTRAINT "regioes_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_regiao_id_regioes_id_fk" FOREIGN KEY ("regiao_id") REFERENCES "public"."regioes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_id_auth_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "log_auditoria_organizacao_id_ocorrido_em_idx" ON "log_auditoria" USING btree ("organizacao_id","ocorrido_em");--> statement-breakpoint
CREATE UNIQUE INDEX "documentos_organizacao_id_hash_sha256_idx" ON "documentos" USING btree ("organizacao_id","hash_sha256");--> statement-breakpoint
CREATE UNIQUE INDEX "pessoas_organizacao_id_cpf_idx" ON "pessoas" USING btree ("organizacao_id","cpf");