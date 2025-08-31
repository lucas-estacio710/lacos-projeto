-- Sistema de Categorias Hierárquico - 3 Tabelas Relacionadas
-- O SUBTIPO é a chave principal - ele puxa CATEGORIA e CONTA automaticamente

-- 1. CONTAS (Nível mais alto: PJ, PF, CONC, Receitas Raquel, etc)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,  -- 'PJ', 'PF', 'CONC', 'RECEITAS_RAQUEL'
  name VARCHAR(100) NOT NULL,        -- 'Pessoa Jurídica', 'Receitas Raquel'
  icon VARCHAR(10) NOT NULL,         -- '🏢', '💰', '👤', '🔄'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. CATEGORIAS (Nível médio: Receitas, Despesas, etc)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,         -- 'RECEITAS', 'DESPESAS_OPERACIONAIS'
  name VARCHAR(100) NOT NULL,        -- 'Receitas', 'Despesas Operacionais'
  icon VARCHAR(10),                  -- '💰', '💸'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, code)
);

-- 3. SUBTIPOS (Nível mais específico - CHAVE PRINCIPAL DO SISTEMA)
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,         -- 'VENDAS_PRODUTOS', 'COMISSOES', 'ALUGUEL'
  name VARCHAR(100) NOT NULL,        -- 'Vendas de Produtos', 'Comissões', 'Aluguel'
  icon VARCHAR(10),                  -- '🛍️', '💼', '🏢'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_id, code)
);

-- ÍNDICES PARA PERFORMANCE
CREATE INDEX idx_accounts_code ON accounts(code);
CREATE INDEX idx_accounts_order ON accounts(display_order, is_active);
CREATE INDEX idx_categories_account ON categories(account_id, display_order);
CREATE INDEX idx_subcategories_category ON subcategories(category_id, display_order);

-- TRIGGERS PARA UPDATED_AT
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accounts_updated_at BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subcategories_updated_at BEFORE UPDATE ON subcategories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- INSERIR DADOS PADRÃO
-- 1. Contas Padrão
INSERT INTO accounts (code, name, icon, display_order) VALUES
('PJ', 'Pessoa Jurídica', '🏢', 1),
('PF', 'Pessoa Física', '👤', 2),
('CONC', 'Conciliação', '🔄', 3);

-- 2. Categorias PJ
INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT a.id, 'RECEITAS', 'Receitas', '💰', 1 FROM accounts a WHERE a.code = 'PJ';

INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT a.id, 'DESPESAS_OPERACIONAIS', 'Despesas Operacionais', '💸', 2 FROM accounts a WHERE a.code = 'PJ';

INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT a.id, 'INVESTIMENTOS', 'Investimentos', '📈', 3 FROM accounts a WHERE a.code = 'PJ';

-- 3. Categorias PF
INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT a.id, 'RECEITAS', 'Receitas', '💰', 1 FROM accounts a WHERE a.code = 'PF';

INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT a.id, 'DESPESAS_PESSOAIS', 'Despesas Pessoais', '🏠', 2 FROM accounts a WHERE a.code = 'PF';

INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT a.id, 'INVESTIMENTOS', 'Investimentos', '📈', 3 FROM accounts a WHERE a.code = 'PF';

-- 4. Categorias CONC
INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT a.id, 'AJUSTES', 'Ajustes', '⚙️', 1 FROM accounts a WHERE a.code = 'CONC';

-- 5. Subtipos PJ > Receitas
INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT c.id, 'VENDAS_PRODUTOS', 'Vendas de Produtos', '🛍️', 1
FROM categories c JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PJ' AND c.code = 'RECEITAS';

INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT c.id, 'PRESTACAO_SERVICOS', 'Prestação de Serviços', '💼', 2
FROM categories c JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PJ' AND c.code = 'RECEITAS';

-- 6. Subtipos PJ > Despesas
INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT c.id, 'ALUGUEL', 'Aluguel', '🏢', 1
FROM categories c JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PJ' AND c.code = 'DESPESAS_OPERACIONAIS';

INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT c.id, 'SALARIOS', 'Salários e Encargos', '👥', 2
FROM categories c JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PJ' AND c.code = 'DESPESAS_OPERACIONAIS';

-- 7. Subtipos PF > Receitas
INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT c.id, 'SALARIO', 'Salário', '💵', 1
FROM categories c JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PF' AND c.code = 'RECEITAS';

-- 8. Subtipos PF > Despesas
INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT c.id, 'MORADIA', 'Moradia', '🏠', 1
FROM categories c JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PF' AND c.code = 'DESPESAS_PESSOAIS';

INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT c.id, 'ALIMENTACAO', 'Alimentação', '🍽️', 2
FROM categories c JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PF' AND c.code = 'DESPESAS_PESSOAIS';

-- 9. Subtipos CONC > Ajustes
INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT c.id, 'CONCILIACAO_BANCARIA', 'Conciliação Bancária', '🏦', 1
FROM categories c JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'CONC' AND c.code = 'AJUSTES';

-- VIEW PARA FACILITAR CONSULTAS (hierarquia completa)
CREATE VIEW v_subcategories_full AS
SELECT 
  s.id as subcategory_id,
  s.code as subcategory_code,
  s.name as subcategory_name,
  s.icon as subcategory_icon,
  
  c.id as category_id,
  c.code as category_code,
  c.name as category_name,
  c.icon as category_icon,
  
  a.id as account_id,
  a.code as account_code,
  a.name as account_name,
  a.icon as account_icon,
  
  -- Caminho completo: "PJ > Receitas > Vendas de Produtos"
  a.name || ' > ' || c.name || ' > ' || s.name as full_path,
  
  -- Para ordenação
  a.display_order as account_order,
  c.display_order as category_order,
  s.display_order as subcategory_order
  
FROM subcategories s
JOIN categories c ON s.category_id = c.id
JOIN accounts a ON c.account_id = a.id
WHERE s.is_active = true 
  AND c.is_active = true 
  AND a.is_active = true
ORDER BY a.display_order, c.display_order, s.display_order;

-- POLÍTICAS RLS (se necessário)
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON accounts FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON categories FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON subcategories FOR SELECT USING (true);