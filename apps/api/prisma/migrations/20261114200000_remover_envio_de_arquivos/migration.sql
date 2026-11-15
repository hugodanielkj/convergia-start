-- Sem envio de arquivos pelo link do cliente (decisão 2026-11-14-a-sem-envio-de-arquivos).
-- Antes de apagar a tabela, tira as perguntas do tipo "upload" dos formulários guardados e o
-- valor delas nas respostas, para nenhuma tela encontrar um tipo de pergunta que não existe mais.

-- Respostas primeiro: as versões ainda dizem quais perguntas eram de arquivo.
UPDATE "respostas_formulario" r
SET "respostas" = r."respostas" - ARRAY(
  SELECT c->>'chave'
  FROM "versoes_formulario" v, jsonb_array_elements(v."campos") c
  WHERE v."id" = r."versaoId" AND c->>'tipo' = 'upload'
  UNION
  SELECT c->>'chave'
  FROM "versoes_formulario_cliente" vc, jsonb_array_elements(vc."campos") c
  WHERE vc."id" = r."versaoClienteId" AND c->>'tipo' = 'upload'
)
WHERE jsonb_typeof(r."respostas") = 'object';

UPDATE "versoes_formulario"
SET "campos" = (
  SELECT COALESCE(jsonb_agg(c ORDER BY i), '[]'::jsonb)
  FROM jsonb_array_elements("campos") WITH ORDINALITY AS t(c, i)
  WHERE c->>'tipo' IS DISTINCT FROM 'upload'
)
WHERE "campos" @> '[{"tipo": "upload"}]';

UPDATE "versoes_formulario_cliente"
SET "campos" = (
  SELECT COALESCE(jsonb_agg(c ORDER BY i), '[]'::jsonb)
  FROM jsonb_array_elements("campos") WITH ORDINALITY AS t(c, i)
  WHERE c->>'tipo' IS DISTINCT FROM 'upload'
)
WHERE "campos" @> '[{"tipo": "upload"}]';

UPDATE "modelos_formulario"
SET "rascunho" = (
  SELECT COALESCE(jsonb_agg(c ORDER BY i), '[]'::jsonb)
  FROM jsonb_array_elements("rascunho") WITH ORDINALITY AS t(c, i)
  WHERE c->>'tipo' IS DISTINCT FROM 'upload'
)
WHERE jsonb_typeof("rascunho") = 'array' AND "rascunho" @> '[{"tipo": "upload"}]';

-- DropForeignKey
ALTER TABLE "arquivos" DROP CONSTRAINT "arquivos_agenciaId_fkey";

-- AlterTable
ALTER TABLE "config_agencia" DROP COLUMN "uploadTamanhoMaxMb",
DROP COLUMN "uploadTiposPermitidos";

-- DropTable
DROP TABLE "arquivos";
