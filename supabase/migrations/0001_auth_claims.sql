-- Custom Access Token Hook — Seção 3.1 do PROMPT-Comite-Digital.md.
--
-- Injeta organizacao_id, papel e regiao_id como claims no JWT do Supabase Auth, para
-- que as políticas de RLS leiam via public.organizacao_id()/public.papel()/
-- public.regiao_id() em vez de fazer subconsulta em `usuarios` a cada linha (lento e
-- sujeito a recursão).
--
-- Confirmado no Context 7 (registrado em CONSULTAS.md): o hook é uma FUNÇÃO POSTGRES,
-- não uma Edge Function — a forma como o próprio PROMPT o menciona sugeria o contrário.
--
-- ATENÇÃO — segunda divergência descoberta só ao aplicar contra o projeto real
-- (registrada em CONSULTAS.md): em projeto hospedado, o schema `auth` é travado —
-- só `supabase_auth_admin` pode criar objeto lá, nem o role `postgres` (o de mais
-- privilégio disponível ao usuário) tem `CREATE` em `auth`. As funções de leitura de
-- claim abaixo vivem em `public`, igual ao exemplo oficial atual do Supabase para
-- RBAC (`public.authorize(...)`) — não em `auth.*`, como a Seção 3.1 do PROMPT sugere.

-- ---------------------------------------------------------------------------
-- Funções de leitura dos claims, usadas nas policies de RLS (Tarefa 5)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.organizacao_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'organizacao_id','')::uuid
$$;

CREATE OR REPLACE FUNCTION public.papel() RETURNS public.papel_usuario
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'papel','')::public.papel_usuario
$$;

CREATE OR REPLACE FUNCTION public.regiao_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true)::json->>'regiao_id','')::uuid
$$;

-- ---------------------------------------------------------------------------
-- O hook em si
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  usuario record;
BEGIN
  SELECT organizacao_id, papel, regiao_id
    INTO usuario
    FROM public.usuarios
   WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF usuario IS NULL THEN
    -- Usuário autenticado no Supabase Auth mas sem linha em public.usuarios ainda
    -- (provisionamento incompleto). Não injeta claim nenhuma; a policy de RLS nega
    -- tudo por padrão (organizacao_id() retorna NULL), o que é o comportamento seguro.
    RETURN event;
  END IF;

  claims := jsonb_set(claims, '{organizacao_id}', to_jsonb(usuario.organizacao_id));
  claims := jsonb_set(claims, '{papel}', to_jsonb(usuario.papel));

  IF usuario.regiao_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{regiao_id}', to_jsonb(usuario.regiao_id));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- ---------------------------------------------------------------------------
-- Permissões — sem este bloco o hook falha em silêncio e o JWT sai sem claims
-- (achado do Context 7, registrado em CONSULTAS.md).
-- ---------------------------------------------------------------------------

GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

GRANT EXECUTE
  ON FUNCTION public.custom_access_token_hook
  TO supabase_auth_admin;

REVOKE EXECUTE
  ON FUNCTION public.custom_access_token_hook
  FROM authenticated, anon, public;

GRANT SELECT
  ON public.usuarios
  TO supabase_auth_admin;

CREATE POLICY "Permite leitura pelo auth admin para o hook"
  ON public.usuarios
  AS PERMISSIVE
  FOR SELECT
  TO supabase_auth_admin
  USING (true);
