# Contratos: consulta e assinatura

A tela `/contratos`, acessada por **Contratos & Vigor**, pesquisa nome, CPF, e-mail e telefone no servidor. CPF e telefone podem conter pontuação. A paginação permite 10, 20, 50 ou 100 registros; a URL preserva busca, aba e página. As contagens consideram os resultados completos da busca e respeitam as permissões de organização e região.

**Ver Termo** abre o contrato completo em um modal e permite baixar o PDF. A leitura na tela, inclusive no celular, usa o texto armazenado dentro do próprio PDF, sem depender de um visualizador externo. Os quatro modelos de exemplo da campanha Michelle foram substituídos pelas cláusulas do PDF fornecido, com dados pessoais parametrizados. Somente o contrato principal foi incluído, conforme confirmado pelo usuário. A ficha diária e a declaração sobre benefícios não fazem parte do documento. O texto continua editável em Configurações. Nome, CPF, endereço, função, valor por extenso, vigência, contato e dados de pagamento são preenchidos pelo sistema.

Ao preparar o documento, o sistema arquiva o PDF e seu SHA-256. As próximas visualizações e a assinatura usam esse mesmo arquivo. Documentos já assinados não são regenerados; quando um registro antigo não contém o arquivo original, a interface informa a ausência.

## Envio

1. Clique em **Enviar link**. O destinatário é preenchido com o e-mail cadastrado.
2. O sistema prepara o contrato e o link, válido por sete dias, e solicita o envio ao provedor de e-mail.
3. O colaborador abre o link sem login, confere o contrato, desenha sua assinatura e tira uma foto usando a câmera.
4. Após o aceite, o sistema gera automaticamente um PDF com o contrato original e uma página de evidências, registra a transição para assinado e disponibiliza **Ver Assinado** no painel.

**Configuração pendente, adiada pelo usuário:** preencher `APP_URL` com o endereço público HTTPS. O envio não usa `localhost` como destino alternativo de e-mail. Sem a configuração, o painel informa a pendência e permite copiar o link para testes locais. Configure também o transporte já existente (`RESEND_API_KEY` e remetente autorizado em `RESEND_FROM`). Não foram enviados e-mails reais durante a implementação.

O link contém uma credencial de acesso: compartilhe somente com o colaborador. A câmera exige HTTPS ou localhost e permissão do navegador. A foto complementa o registro; não há reconhecimento facial, prova de vida ou certificação ICP-Brasil.

## Banco e verificação

Migração: `supabase/migrations/20260910152052_contratos_busca_assinatura_evidencias.sql`. Aplicada ao Supabase configurado neste ambiente, usando o fluxo de SQL em transação já adotado pelo projeto. Revoga o aceite público antigo sem evidências. A função de conclusão é exclusiva do servidor; busca paginada e seleção de pessoas aptas usam as permissões do usuário.

Testes:

```bash
npx vitest run tests/unit/contratos tests/unit/components/paginacao.test.ts
node --env-file=.env.local node_modules/vitest/vitest.mjs run tests/integration/contratos-paginacao-evidencias.test.ts
node --env-file=.env.local node_modules/@playwright/test/cli.js test tests/e2e/contratos-assinatura.spec.ts
```

O teste de integração usa uma transação com rollback. O teste de navegador cria dados fictícios em organização separada, usa uma câmera simulada, evita o envio real de e-mail e remove seus registros e arquivos ao terminar.
