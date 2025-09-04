-- Migration: Fix Security Definer View
-- Description: Recria a view vw_hierarquia_completa sem SECURITY DEFINER

-- Drop a view existente
DROP VIEW IF EXISTS vw_hierarquia_completa;

-- Recria a view sem SECURITY DEFINER (padrão é SECURITY INVOKER)
CREATE VIEW vw_hierarquia_completa AS
SELECT 
  c.id as conta_id,
  c.codigo as conta_codigo,
  c.nome as conta_nome,
  c.icone as conta_icone,
  cat.id as categoria_id,
  cat.codigo as categoria_codigo,
  cat.nome as categoria_nome,
  cat.icone as categoria_icone,
  sub.id as subtipo_id,
  sub.codigo as subtipo_codigo,
  sub.nome as subtipo_nome,
  sub.icone as subtipo_icone,
  CONCAT(c.nome, ' > ', cat.nome, ' > ', sub.nome) as caminho_completo
FROM contas c
LEFT JOIN categorias cat ON c.id = cat.conta_id AND cat.ativo = true
LEFT JOIN subtipos sub ON cat.id = sub.categoria_id AND sub.ativo = true
WHERE c.ativo = true
ORDER BY c.ordem_exibicao, cat.ordem_exibicao, sub.ordem_exibicao;

-- Garantir que a view pode ser acessada
GRANT SELECT ON vw_hierarquia_completa TO authenticated;
GRANT SELECT ON vw_hierarquia_completa TO anon;