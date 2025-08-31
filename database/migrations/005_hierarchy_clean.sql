-- Migration: Clean Hierarchy System 
-- Description: Creates Contas > Categorias > Subtipos hierarchy (no colors)

-- ===== TABELA CONTAS =====
-- Tipos de conta: PJ, PF, CONC., Raquel, etc.
CREATE TABLE contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo VARCHAR(20) UNIQUE NOT NULL,     -- 'PJ', 'PF', 'CONC', 'RAQUEL'
  nome VARCHAR(100) NOT NULL,             -- 'Pessoa Jurídica', 'Receitas Raquel'
  icone VARCHAR(10),                      -- '🏢', '👤', '🔄', '💰'
  ordem_exibicao INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ===== TABELA CATEGORIAS =====
-- Categorias vinculadas às contas
CREATE TABLE categorias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id UUID NOT NULL REFERENCES contas(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,            -- 'RECEITAS', 'DESPESAS_OPERACIONAIS'
  nome VARCHAR(100) NOT NULL,             -- 'Receitas', 'Despesas Operacionais'
  icone VARCHAR(10),                      -- '💰', '💸', '⚙️'
  ordem_exibicao INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(conta_id, codigo)
);

-- ===== TABELA SUBTIPOS =====
-- Subtipos vinculados às categorias
CREATE TABLE subtipos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  categoria_id UUID NOT NULL REFERENCES categorias(id) ON DELETE CASCADE,
  codigo VARCHAR(50) NOT NULL,            -- 'REC_A_P_IND', 'ALUGUEL_RIP'
  nome VARCHAR(100) NOT NULL,             -- 'REC. A. P. IND.', 'ALUGUEL RIP'
  icone VARCHAR(10),                      -- '🛍️', '🏢'
  ordem_exibicao INTEGER DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(categoria_id, codigo)
);

-- ===== ÍNDICES =====
CREATE INDEX idx_contas_codigo ON contas(codigo);
CREATE INDEX idx_contas_ordem ON contas(ordem_exibicao, ativo);
CREATE INDEX idx_categorias_conta ON categorias(conta_id, ordem_exibicao);
CREATE INDEX idx_subtipos_categoria ON subtipos(categoria_id, ordem_exibicao);

-- ===== TRIGGERS =====
CREATE OR REPLACE FUNCTION atualizar_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_contas_updated_at BEFORE UPDATE ON contas
  FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

CREATE TRIGGER trigger_categorias_updated_at BEFORE UPDATE ON categorias
  FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

CREATE TRIGGER trigger_subtipos_updated_at BEFORE UPDATE ON subtipos
  FOR EACH ROW EXECUTE FUNCTION atualizar_updated_at();

-- ===== VIEW HIERÁRQUICA =====
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

-- ===== DADOS INICIAIS =====
-- Contas principais
INSERT INTO contas (codigo, nome, icone, ordem_exibicao) VALUES
('PJ', 'Pessoa Jurídica', '🏢', 1),
('PF', 'Pessoa Física', '👤', 2),
('CONC', 'Conciliação', '🔄', 3),
('RAQUEL', 'Receitas Raquel', '💰', 4);

-- RLS (ajuste conforme necessário)
ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY; 
ALTER TABLE subtipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura" ON contas FOR SELECT USING (true);
CREATE POLICY "Permitir leitura" ON categorias FOR SELECT USING (true);
CREATE POLICY "Permitir leitura" ON subtipos FOR SELECT USING (true);