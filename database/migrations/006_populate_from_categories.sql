-- Migration: Populate from existing categories.ts
-- Description: Populates the hierarchy with data from src/lib/categories.ts

-- ===== PJ (PESSOA JURÍDICA) =====
-- Categorias PJ
INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'RECEITA_NOVA', 
  'Receita Nova', 
  '💵', 
  1
FROM contas c WHERE c.codigo = 'PJ';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'RECEITA_ANTIGA', 
  'Receita Antiga', 
  '💵', 
  2
FROM contas c WHERE c.codigo = 'PJ';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'CUSTOS_OPERACIONAIS', 
  'Custos Operacionais', 
  '⚙️', 
  3
FROM contas c WHERE c.codigo = 'PJ';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'CONTAS_FIXAS_PJ', 
  'Contas Fixas PJ', 
  '🏠', 
  4
FROM contas c WHERE c.codigo = 'PJ';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'MARKETING', 
  'Marketing', 
  '📢', 
  5
FROM contas c WHERE c.codigo = 'PJ';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'ESTRUTURA', 
  'Estrutura', 
  '🏢', 
  6
FROM contas c WHERE c.codigo = 'PJ';

-- Subtipos PJ - Receita Nova
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'REC_N_C_COL', 'REC. N. C. COL.', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'RECEITA_NOVA';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'REC_N_C_IND', 'REC. N. C. IND.', 2
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'RECEITA_NOVA';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'REC_N_P_COL', 'REC. N. P. COL.', 3
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'RECEITA_NOVA';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'REC_N_P_IND', 'REC. N. P. IND.', 4
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'RECEITA_NOVA';

-- Subtipos PJ - Receita Antiga
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'REC_A_C_COL', 'REC. A. C. COL.', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'RECEITA_ANTIGA';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'REC_A_C_IND', 'REC. A. C. IND.', 2
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'RECEITA_ANTIGA';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'REC_A_P_COL', 'REC. A. P. COL.', 3
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'RECEITA_ANTIGA';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'REC_A_P_IND', 'REC. A. P. IND.', 4
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'RECEITA_ANTIGA';

-- Subtipos PJ - Custos Operacionais
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'INDIVIDUAL', 'INDIVIDUAL', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'COLETIVA', 'COLETIVA', 2
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'URNAS', 'URNAS', 3
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'ACESSORIOS', 'ACESSÓRIOS', 4
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'IMPOSTO_RIP', 'IMPOSTO RIP', 5
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'IMPOSTOS_CMVE', 'IMPOSTOS CMVE', 6
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'CARRO_RIP', 'CARRO RIP', 7
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'MATERIAIS_OPER', 'MATERIAIS OPER', 8
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'OUTROS_ABSORVIDOS', 'OUTROS ABSORVIDOS', 9
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'FREELANCERS_OPER', 'FREELANCERS OPER', 10
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'ALIMENTACAO', 'ALIMENTAÇÃO', 11
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CUSTOS_OPERACIONAIS';

-- Subtipos PJ - Contas Fixas PJ
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'ALUGUEL_RIP', 'ALUGUEL RIP', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CONTAS_FIXAS_PJ';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'CONTAS_CONSUMO_RIP', 'CONTAS CONSUMO RIP', 2
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CONTAS_FIXAS_PJ';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'CONTADOR', 'CONTADOR', 3
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CONTAS_FIXAS_PJ';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'SEGUROS_RIP', 'SEGUROS RIP', 4
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'CONTAS_FIXAS_PJ';

-- Subtipos PJ - Marketing
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'FREELANCERS_CMCL', 'FREELANCERS CMCL', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'MARKETING';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'GOOGLE', 'GOOGLE', 2
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'MARKETING';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'GRATIFICACOES', 'GRATIFICAÇÕES', 3
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'MARKETING';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'MATERIAIS_MKT', 'MATERIAIS MKT', 4
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'MARKETING';

-- Subtipos PJ - Estrutura
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'ESTRUTURA_RIP', 'ESTRUTURA RIP', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PJ' AND cat.codigo = 'ESTRUTURA';

-- ===== PF (PESSOA FÍSICA) =====
-- Categorias PF
INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'CONTAS_FIXAS', 
  'Contas Fixas', 
  '🏠', 
  1
FROM contas c WHERE c.codigo = 'PF';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'CONTAS_NECESSARIAS', 
  'Contas Necessárias', 
  '🛒', 
  2
FROM contas c WHERE c.codigo = 'PF';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'AQUISICOES', 
  'Aquisições', 
  '🛍️', 
  3
FROM contas c WHERE c.codigo = 'PF';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'IMPREVISTOS', 
  'Imprevistos', 
  '⚠️', 
  4
FROM contas c WHERE c.codigo = 'PF';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'CONTAS_SUPERFLUAS', 
  'Contas Supérfluas', 
  '🎉', 
  5
FROM contas c WHERE c.codigo = 'PF';

-- Subtipos PF - Contas Fixas
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'MORADIA_PESSOAL', 'MORADIA PESSOAL', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_FIXAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'CONTAS_CONSUMO', 'CONTAS CONSUMO', 2
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_FIXAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'ESCOLA_OLI', 'ESCOLA OLI', 3
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_FIXAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'DIARISTA', 'DIARISTA', 4
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_FIXAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'ASSINATURAS', 'ASSINATURAS', 5
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_FIXAS';

-- Subtipos PF - Contas Necessárias
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'SUPERMERCADOS', 'SUPERMERCADOS', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_NECESSARIAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'CARRO_PESSOAL', 'CARRO PESSOAL', 2
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_NECESSARIAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'FARMACIAS', 'FARMÁCIAS', 3
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_NECESSARIAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'SAUDE', 'SAÚDE', 4
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_NECESSARIAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'EXTRAS_OLI', 'EXTRAS OLI', 5
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_NECESSARIAS';

-- Subtipos PF - Aquisições
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'AQUISICOES_PESSOAIS', 'AQUISIÇÕES PESSOAIS', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'AQUISICOES';

-- Subtipos PF - Imprevistos
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'IMPREVISTOS_PF', 'IMPREVISTOS', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'IMPREVISTOS';

-- Subtipos PF - Contas Supérfluas
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'RESTAURANTES', 'RESTAURANTES', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_SUPERFLUAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'ESTETICA_PESSOAL', 'ESTÉTICA PESSOAL', 2
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_SUPERFLUAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'PRESENTES', 'PRESENTES', 3
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_SUPERFLUAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'OUTROS_LAZER', 'OUTROS LAZER', 4
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_SUPERFLUAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'EVENTOS', 'EVENTOS', 5
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_SUPERFLUAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'VIAGENS', 'VIAGENS', 6
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'PF' AND cat.codigo = 'CONTAS_SUPERFLUAS';

-- ===== CONC (CONCILIAÇÃO) =====
-- Categorias CONC
INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'ENTRECONTAS', 
  'Entrecontas', 
  '🔄', 
  1
FROM contas c WHERE c.codigo = 'CONC';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'GASTOS_MAMU', 
  'Gastos Mamu', 
  '💸', 
  2
FROM contas c WHERE c.codigo = 'CONC';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'MOV_FINANCEIRA_PESSOAL', 
  'Mov. Financeira Pessoal', 
  '👤', 
  3
FROM contas c WHERE c.codigo = 'CONC';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'MOV_FINANCEIRA_PJ', 
  'Mov. Financeira PJ', 
  '🏢', 
  4
FROM contas c WHERE c.codigo = 'CONC';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'RECEITA_LEGADA_PF', 
  'Receita Legada PF', 
  '📜', 
  5
FROM contas c WHERE c.codigo = 'CONC';

INSERT INTO categorias (conta_id, codigo, nome, icone, ordem_exibicao)
SELECT 
  c.id, 
  'RECEITAS_MAMU', 
  'Receitas Mamu', 
  '💰', 
  6
FROM contas c WHERE c.codigo = 'CONC';

-- Subtipos CONC
INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'ENTRECONTAS', 'ENTRECONTAS', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'CONC' AND cat.codigo = 'ENTRECONTAS';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'GASTO_MAMU', 'GASTO MAMU', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'CONC' AND cat.codigo = 'GASTOS_MAMU';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'MOV_FIN_PESSOAL', 'MOV. FIN. PESSOAL', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'CONC' AND cat.codigo = 'MOV_FINANCEIRA_PESSOAL';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'MOV_FIN_PJ', 'MOV. FIN. PJ', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'CONC' AND cat.codigo = 'MOV_FINANCEIRA_PJ';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'RECEITA_LEGADA', 'RECEITA LEGADA', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'CONC' AND cat.codigo = 'RECEITA_LEGADA_PF';

INSERT INTO subtipos (categoria_id, codigo, nome, ordem_exibicao)
SELECT cat.id, 'RECEITA_MAMU', 'RECEITA MAMU', 1
FROM categorias cat JOIN contas c ON cat.conta_id = c.id 
WHERE c.codigo = 'CONC' AND cat.codigo = 'RECEITAS_MAMU';