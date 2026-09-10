-- Paginação numerada no servidor; SECURITY INVOKER preserva RLS por organização/região.
CREATE OR REPLACE FUNCTION public.buscar_contratos_paginados(
  p_busca text DEFAULT '', p_aba text DEFAULT 'ativos', p_pagina integer DEFAULT 1, p_limite integer DEFAULT 20
) RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH filtro AS MATERIALIZED (
    SELECT c.id, c.criado_em, c.status
    FROM public.contratos c JOIN public.pessoas p ON p.id = c.pessoa_id
    WHERE coalesce(btrim(p_busca), '') = ''
      OR strpos(lower(p.nome_completo), lower(btrim(left(p_busca, 120)))) > 0
      OR strpos(lower(coalesce(p.email, '')), lower(btrim(left(p_busca, 120)))) > 0
      OR (regexp_replace(p_busca, '[^0-9]', '', 'g') <> '' AND p_busca !~ '[[:alpha:]]' AND (
        strpos(regexp_replace(p.cpf, '[^0-9]', '', 'g'), regexp_replace(p_busca, '[^0-9]', '', 'g')) > 0
        OR strpos(regexp_replace(coalesce(p.telefone, ''), '[^0-9]', '', 'g'), regexp_replace(p_busca, '[^0-9]', '', 'g')) > 0))
  ), totais AS (
    SELECT count(*) FILTER (WHERE status NOT IN ('distratado','distrato_assinado')) AS ativos,
      count(*) FILTER (WHERE status IN ('distratado','distrato_assinado')) AS distratos FROM filtro
  ), limites AS (
    SELECT *, CASE WHEN p_aba = 'distratos' THEN distratos ELSE ativos END AS total,
      greatest(1, least(coalesce(p_limite,20),100)) AS tamanho FROM totais
  ), paginacao AS (
    SELECT *, greatest(1,least(coalesce(p_pagina,1),ceil(total::numeric/tamanho)::integer)) AS pagina FROM limites
  ), ids AS (
    SELECT f.id FROM filtro f WHERE (f.status IN ('distratado','distrato_assinado')) = (p_aba = 'distratos')
    ORDER BY f.criado_em DESC, f.id DESC
    LIMIT (SELECT tamanho FROM paginacao) OFFSET (SELECT (pagina-1)*tamanho FROM paginacao)
  )
  SELECT jsonb_build_object('ativos',a.ativos,'distratos',a.distratos,'total',a.total,'pagina',a.pagina,'itens',
    coalesce((SELECT jsonb_agg(jsonb_build_object(
      'id',c.id,'pessoa_id',c.pessoa_id,'objeto',c.objeto,'valor',c.valor,'valor_extenso',c.valor_extenso,
      'vigencia_inicio',c.vigencia_inicio,'vigencia_fim',c.vigencia_fim,'status',c.status,
      'canal_envio',c.canal_envio,'enviado_para',c.enviado_para,'caminho_pdf',c.caminho_pdf,
      'caminho_pdf_assinado',c.caminho_pdf_assinado,'caminho_termo_distrato',c.caminho_termo_distrato,
      'pessoas',jsonb_build_object('nome_completo',p.nome_completo,'cpf',p.cpf,'email',p.email,'telefone',p.telefone),
      'regioes',jsonb_build_object('nome',r.nome)) ORDER BY c.criado_em DESC,c.id DESC)
      FROM ids JOIN public.contratos c USING(id) JOIN public.pessoas p ON p.id=c.pessoa_id
      LEFT JOIN public.regioes r ON r.id=c.regiao_id),'[]'::jsonb)) FROM paginacao a;
$$;
REVOKE ALL ON FUNCTION public.buscar_contratos_paginados(text,text,integer,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buscar_contratos_paginados(text,text,integer,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.pessoas_aptas_para_contrato()
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nomeCompleto',p.nome_completo,'cpf',p.cpf,
    'endereco',p.endereco,'regiaoNome',r.nome) ORDER BY p.nome_completo,p.id),'[]'::jsonb)
  FROM public.pessoas p LEFT JOIN public.regioes r ON r.id=p.regiao_id
  WHERE p.apta AND NOT EXISTS (SELECT 1 FROM public.contratos c WHERE c.pessoa_id=p.id
    AND c.status IN ('rascunho','emitido','enviado','assinado'));
$$;
REVOKE ALL ON FUNCTION public.pessoas_aptas_para_contrato() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pessoas_aptas_para_contrato() TO authenticated;
CREATE INDEX IF NOT EXISTS contratos_org_criado_id_idx ON public.contratos(organizacao_id,criado_em DESC,id DESC);
CREATE INDEX IF NOT EXISTS contratos_pessoa_vivo_idx ON public.contratos(pessoa_id) WHERE status IN ('rascunho','emitido','enviado','assinado');

ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS assinatura_expira_em timestamptz;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS pdf_sha256 text;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS assinatura_evidencias jsonb;
-- Links antigos têm prazo limitado; novos links recebem prazo ao serem preparados.
UPDATE public.contratos SET assinatura_expira_em = now() + interval '7 days'
WHERE token_assinatura IS NOT NULL AND assinatura_expira_em IS NULL;

CREATE OR REPLACE FUNCTION public.validar_link_assinatura(p_token text)
RETURNS TABLE (contrato_id uuid,pessoa_id uuid,nome_completo text,primeiro_nome text,cpf text,
  objeto text,valor numeric,valor_extenso text,vigencia_inicio date,vigencia_fim date,
  status public.status_contrato,organizacao_nome text,caminho_pdf text,assinado_em timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  -- Capacidade pública estrita: token aleatório de 192 bits, prazo e estado.
  SELECT c.id,p.id,p.nome_completo,split_part(p.nome_completo,' ',1),p.cpf,c.objeto,c.valor,c.valor_extenso,
    c.vigencia_inicio,c.vigencia_fim,c.status,o.nome,
    CASE WHEN c.status='assinado' THEN coalesce(c.caminho_pdf_assinado,c.caminho_pdf) ELSE c.caminho_pdf END,c.assinado_em
  FROM public.contratos c JOIN public.pessoas p ON p.id=c.pessoa_id AND p.organizacao_id=c.organizacao_id
  JOIN public.organizacoes o ON o.id=c.organizacao_id
  WHERE p_token ~ '^[0-9a-f]{48}$' AND c.token_assinatura=p_token
    AND c.assinatura_expira_em > now() AND c.status IN ('enviado','assinado');
$$;
REVOKE ALL ON FUNCTION public.validar_link_assinatura(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validar_link_assinatura(text) TO anon, authenticated;
-- Fecha o caminho antigo que permitia assinar sem foto e sem documento.
REVOKE ALL ON FUNCTION public.assinar_contrato_publico(text,text) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.concluir_assinatura_com_evidencias(
  p_token text,p_pdf_original_sha256 text,p_caminho_pdf text,p_evidencias jsonb
) RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE c public.contratos%ROWTYPE;
BEGIN
  IF current_user IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'Operação exclusiva do servidor';
  END IF;
  SELECT * INTO c FROM public.contratos WHERE token_assinatura=p_token FOR UPDATE;
  IF c.id IS NULL OR c.assinatura_expira_em <= now() OR c.assinatura_expira_em IS NULL THEN RETURN false; END IF;
  IF c.status='assinado' AND c.assinatura_evidencias IS NOT NULL THEN RETURN true; END IF;
  IF c.status<>'enviado' OR c.pdf_sha256 IS DISTINCT FROM p_pdf_original_sha256 THEN RETURN false; END IF;
  IF p_pdf_original_sha256 !~ '^[0-9a-f]{64}$'
    OR p_evidencias->>'assinatura_sha256' IS NULL OR p_evidencias->>'foto_sha256' IS NULL
    OR coalesce(p_evidencias->>'consentimento','') <> 'true'
    OR p_caminho_pdf NOT LIKE c.organizacao_id::text || '/' || c.pessoa_id::text || '/assinado_' || c.id::text || '_%.pdf'
    THEN RETURN false; END IF;
  UPDATE public.contratos SET status='assinado',assinado_em=now(),caminho_pdf_assinado=p_caminho_pdf,
    assinatura_evidencias=p_evidencias WHERE id=c.id;
  INSERT INTO public.eventos_contrato(contrato_id,status_anterior,status_novo,usuario_id,observacao)
  VALUES(c.id,'enviado','assinado',NULL,'Assinatura na tela e foto do rosto registradas. SHA-256 do original: '||p_pdf_original_sha256);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.concluir_assinatura_com_evidencias(text,text,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.concluir_assinatura_com_evidencias(text,text,text,jsonb) TO service_role;

-- Modelo fornecido para a campanha Michelle. Não altera documentos já arquivados/assinados.
UPDATE public.templates_contrato t SET corpo_html = $modelo$CONTRATANTE: ELEICAO 2026 MICHELLE DE PAULA FIRMO REINALDO BOLSONARO, candidata ao cargo de SENADOR, pelo PARTIDO LIBERAL - PL, com endereço na rua Q – SHIS – QI-15 – CONJUNTO 7, CASA 23, inscrito no CNPJ sob o nº 68.608.523/0001-59.

CONTRATADO: {{nome}}, inscrito no CPF nº {{cpf}}, com endereço em {{endereco}}.

Pelo presente instrumento particular de Contrato de Prestação de Serviços para campanha eleitoral nas eleições de 2026, têm entre si justo e contratado o seguinte, que mutuamente convencionam, outorgam e aceitam:

Objeto. Por este instrumento particular, as partes pactuam que o CONTRATADO prestará serviço de {{objeto}}{{objeto_descricao}} para a campanha eleitoral do CONTRATANTE referente às eleições de 2026.

Cláusula 1. - O CONTRATADO compromete-se, por este contrato, a prestar seus serviços, O CONTRATADO compromete-se, por este contrato, a prestar seus serviços, na eventos da campanha eleitoral, exercendo seu trabalho no período de 8 horas diárias. Cláusula 2. - Pela prestação dos serviços contratados, o CONTRATANTE pagará ao CONTRATADO a importância de {{valor}} ({{valor_extenso}}), o pagamento acordado tem como parâmetro o grau de complexidade das atividades, bem como, o salário mínimo vigente no país.

Cláusula 3. - O valor acima será pago por meio de Transferência Bancária ou Pix ao CONTRATADO durante a prestação de serviços.

Parágrafo Único: No caso de pagamento por meio de transferência bancária ou pix, esta será feita EXCLUSIVAMENTE para conta corrente de titularidade exclusiva do

CONTRATADO, sendo PROIBIDA a transferência para conta bancária de terceiro, mesmo que indicado pelo CONTRATADO.

Cláusula 4. - Este contrato terá vigência com início em {{vigencia_inicio}} e término em {{vigencia_fim}}, podendo ser rescindido por qualquer das partes, independentemente de justificação, desde que notificada a parte contrária por escrito a qualquer tempo. Será, porém, rescindido de imediato, caso alguma das partes infrinja qualquer cláusula contratual.

Cláusula 5. - O presente contrato não gera vínculo empregatício entre as partes, de acordo com o artigo 100, da Lei nº 9.504/97.

Parágrafo Único. – Fica estabelecido, conforme os termos da lei, que as contribuições decorrentes dos valores recebidos por força de presente contrato ficaram a cargo e responsabilidade exclusivamente do CONTRATADO.

Cláusula 6. – O CONTRATADO compromete-se, pelo presente, que estar em plenas condições de prestar os serviços ora contratados, não incorrendo em quaisquer vedações impostas pela legislação eleitoral.

CONFIDENCIALIDADE.

Cláusula 7- As partes comprometem-se a tratar como estritamente confidenciais e a não divulgar ou tornar público (conjuntamente “Informação Confidencial toda e qualquer informação relacionada ao objeto do presente contrato que venha a ter conhecimento por meio das operações e serviços contemplados neste Contrato e da relação mantida entre as partes e seus representados.

Cláusula 7.1 - A obrigação de confidencialidade não será considerada descumprida no tocante a informação: (i) que é ou venha a ser de domínio público; (ii) que já era de conhecimento das partes à época em que ocorreu tal revelação ou (iii) que for licitamente recebida, pela parte ou de terceiros que não estejam, de qualquer maneira, vinculados às atividades desenvolvidas pelas partes.

Cláusula 7.2 - As partes, seus filiados, sócios, associados, prepostos, empregados, credenciados e subcontratados obrigam-se e responsabiliza-se pela não divulgação de quaisquer Informações Confidenciais que lhes sejam confiadas com relação à prestação de serviços ora contratados, respeitando a confidencialidade dos assuntos internos das partes aos quais tiverem acesso, sendo que os documentos, resultados, relatórios e demais materiais empregados na prestação dos serviços são de exclusiva propriedade da parte que os produziu ou disponibilizou.

Cláusula 7.3 - O descumprimento do quanto previsto nas cláusulas supra facultará à parte vítima dar o presente contrato por rescindido de pleno direito.

Cláusula 7.4 - Sem prejuízo das demais obrigações acima ajustadas, as partes obrigam-se, por todo o tempo de vigência deste Contrato e por um período de 3 (três) anos contados de seu término, a manter e proteger a condição de confidencialidade de qualquer Informação Confidencial a que tenham tido acesso, principalmente considerando o alto nível de confidencialidade da informação e o dano que pode ser causado pela sua revelação.

Cláusula 7.5 - Em razão do disposto nesta Cláusula, as partes obrigam-se, pelo mesmo prazo de 3 (três) anos previsto acima, a não exibir, disponibilizar, divulgar ou fornecer, seja por via oral, meio eletrônico ou por escrito, e-mail, carta, memorando e contratos semelhantes, Internet, redes públicas ou privadas, ou de qualquer outra maneira, a qualquer terceiro, qualquer Informação Confidencial, ou documento, CD, pen drive ou qualquer outro meio de armazenamento que contenha Informação Confidencial, ou permitir ou consentir que terceiros tenham acesso a tais Informações Confidenciais, salvo se expressamente permitido pela outra parte.

Cláusula 8. - Fica eleito o Foro da cidade de BRASILIA/DF, para resolver qualquer questão decorrente do presente contrato, que não comporte a solução amigável.

E, por estarem assim justos e contratados, depois de lido e achado conforme, assinam as partes o presente instrumento, em duas vias de igual teor e forma, para uma só finalidade, na presença das testemunhas abaixo:

Brasília, {{vigencia_inicio}}.

______________________________ ______________________________ CONTRATANTE                          CONTRATADO
{{nome}} — CPF {{cpf}}

Testemunhas 1: Testemunha 2:

______________________________ ______________________________ NOME: NOME: CPF: CPF

DADOS PARA CONTATO E PAGAMENTO
E-mail: {{email}}
Telefone: {{telefone}}
Banco: {{banco}}
Agência: {{agencia}}
Conta: {{conta}}
Chave Pix: {{chave_pix}}$modelo$
FROM public.organizacoes o WHERE t.organizacao_id=o.id AND o.nome='Comitê Michelle — Eleição 2026'
AND t.corpo_html = '<p>Contrato de {{objeto}} no valor de {{valor}} ({{valor_extenso}}).</p>';
NOTIFY pgrst, 'reload schema';
