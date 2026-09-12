-- Coordenada no registro de atividade de campo.
--
-- `registros_atividade` guardava foto, quantidade e observação, mas não onde a
-- atividade aconteceu. Para campanha isso bastava; para trade marketing a prova
-- de que a visita ocorreu NA LOJA é o entregável do setor, e sem coordenada não
-- existe.
--
-- A infraestrutura de captura já existe e roda na coleta pública desde a
-- migration 0030 — aqui é reaproveitamento, não conceito novo.
--
-- Nulável de propósito: sinal ruim é o cenário normal em campo, e a fila offline
-- precisa conseguir subir um registro sem coordenada em vez de perdê-lo.

ALTER TABLE public.registros_atividade
  ADD COLUMN IF NOT EXISTS latitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS longitude numeric(9,6),
  ADD COLUMN IF NOT EXISTS precisao_m numeric(8,2),
  ADD COLUMN IF NOT EXISTS geo_capturada_em timestamptz;
--> statement-breakpoint

-- `(x IS NULL) = (y IS NULL)` em vez de um OR entre as duas hipóteses: com
-- latitude preenchida e longitude nula, o OR resulta NULL, e CHECK que avalia
-- NULL APROVA a linha. Conferido contra o banco — a primeira versão desta
-- restrição deixava passar meia coordenada.
ALTER TABLE public.registros_atividade
  ADD CONSTRAINT registros_atividade_coordenada_valida
  CHECK (
    (latitude IS NULL) = (longitude IS NULL)
    AND (
      latitude IS NULL
      OR (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180)
    )
  );
--> statement-breakpoint

COMMENT ON COLUMN public.registros_atividade.precisao_m IS
  'Raio de precisão em metros informado pelo navegador. Precisão alta demais (centenas de metros) indica posição por rede, não por GPS.';
--> statement-breakpoint

NOTIFY pgrst, 'reload schema';
