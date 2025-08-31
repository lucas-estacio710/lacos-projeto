-- Migration: Create Category System Tables
-- Description: Creates a hierarchical category system with accounts, categories, and subcategories

-- 1. ACCOUNTS TABLE (Tipos de Conta: PJ, PF, CONC, Receitas Raquel, etc)
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL, -- 'PJ', 'PF', 'CONC', 'RECEITAS_RAQUEL'
  name VARCHAR(100) NOT NULL,       -- 'Pessoa Jurídica', 'Receitas Raquel' 
  icon VARCHAR(10) NOT NULL,        -- '🏢', '💰'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. CATEGORIES TABLE (Categorias principais: Receitas, Despesas, etc)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,        -- 'RECEITAS', 'DESPESAS_OPERACIONAIS'
  name VARCHAR(100) NOT NULL,       -- 'Receitas', 'Despesas Operacionais'
  icon VARCHAR(10),                 -- '💰', '💸'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, code)
);

-- 3. SUBCATEGORIES TABLE (Subtipos: Vendas, Comissões, Aluguel, etc)
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,        -- 'VENDAS_PRODUTOS', 'COMISSOES'
  name VARCHAR(100) NOT NULL,       -- 'Vendas de Produtos', 'Comissões'
  icon VARCHAR(10),                 -- '🛍️', '💼'
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_id, code)
);

-- 4. ADD INDEXES FOR PERFORMANCE
CREATE INDEX idx_accounts_code ON accounts(code);
CREATE INDEX idx_accounts_display_order ON accounts(display_order, is_active);
CREATE INDEX idx_categories_account ON categories(account_id, display_order);
CREATE INDEX idx_subcategories_category ON subcategories(category_id, display_order);

-- 5. ADD TRIGGERS FOR UPDATED_AT
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

-- 6. INSERT DEFAULT DATA
-- Default Accounts
INSERT INTO accounts (code, name, icon, display_order) VALUES
('PJ', 'Pessoa Jurídica', '🏢', 1),
('PF', 'Pessoa Física', '👤', 2),
('CONC', 'Conciliação', '🔄', 3);

-- PJ Categories
INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT 
  a.id, 
  'RECEITAS', 
  'Receitas', 
  '💰', 
  1
FROM accounts a WHERE a.code = 'PJ';

INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT 
  a.id, 
  'DESPESAS_OPERACIONAIS', 
  'Despesas Operacionais', 
  '💸', 
  2
FROM accounts a WHERE a.code = 'PJ';

INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT 
  a.id, 
  'INVESTIMENTOS', 
  'Investimentos', 
  '📈', 
  3
FROM accounts a WHERE a.code = 'PJ';

-- PF Categories
INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT 
  a.id, 
  'RECEITAS', 
  'Receitas', 
  '💰', 
  1
FROM accounts a WHERE a.code = 'PF';

INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT 
  a.id, 
  'DESPESAS_PESSOAIS', 
  'Despesas Pessoais', 
  '🏠', 
  2
FROM accounts a WHERE a.code = 'PF';

INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT 
  a.id, 
  'INVESTIMENTOS', 
  'Investimentos', 
  '📈', 
  3
FROM accounts a WHERE a.code = 'PF';

-- CONC Categories
INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT 
  a.id, 
  'AJUSTES', 
  'Ajustes', 
  '⚙️', 
  1
FROM accounts a WHERE a.code = 'CONC';

-- Sample PJ Subcategories
INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT 
  c.id, 
  'VENDAS_PRODUTOS',
  'Vendas de Produtos',
  '🛍️',
  1
FROM categories c 
JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PJ' AND c.code = 'RECEITAS';

INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT 
  c.id, 
  'PRESTACAO_SERVICOS',
  'Prestação de Serviços',
  '💼',
  2
FROM categories c 
JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PJ' AND c.code = 'RECEITAS';

INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT 
  c.id, 
  'ALUGUEL',
  'Aluguel',
  '🏢',
  1
FROM categories c 
JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PJ' AND c.code = 'DESPESAS_OPERACIONAIS';

INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT 
  c.id, 
  'SALARIOS',
  'Salários e Encargos',
  '👥',
  2
FROM categories c 
JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PJ' AND c.code = 'DESPESAS_OPERACIONAIS';

-- Sample PF Subcategories
INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT 
  c.id, 
  'SALARIO',
  'Salário',
  '💵',
  1
FROM categories c 
JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PF' AND c.code = 'RECEITAS';

INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT 
  c.id, 
  'MORADIA',
  'Moradia',
  '🏠',
  1
FROM categories c 
JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PF' AND c.code = 'DESPESAS_PESSOAIS';

INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT 
  c.id, 
  'ALIMENTACAO',
  'Alimentação',
  '🍽️',
  2
FROM categories c 
JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'PF' AND c.code = 'DESPESAS_PESSOAIS';

-- CONC Subcategories
INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT 
  c.id, 
  'CONCILIACAO_BANCARIA',
  'Conciliação Bancária',
  '🏦',
  1
FROM categories c 
JOIN accounts a ON c.account_id = a.id 
WHERE a.code = 'CONC' AND c.code = 'AJUSTES';

-- Enable Row Level Security (RLS) if needed
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

-- Create policies (adjust based on your auth requirements)
CREATE POLICY "Enable read access for all users" ON accounts
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON categories
  FOR SELECT USING (true);

CREATE POLICY "Enable read access for all users" ON subcategories
  FOR SELECT USING (true);