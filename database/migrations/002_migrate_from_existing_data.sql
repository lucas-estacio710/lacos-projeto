-- Migração: Criar Sistema de Categorias a partir dos dados existentes
-- Lê as transações atuais e constrói as tabelas automaticamente

-- 1. CRIAR TABELAS VAZIAS PRIMEIRO
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10) NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(account_id, code)
);

CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(10),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(category_id, code)
);

-- 2. POPULAR CONTAS (ACCOUNTS) com base nas transações existentes
INSERT INTO accounts (code, name, icon, display_order)
SELECT DISTINCT 
  conta as code,
  CASE 
    WHEN conta = 'PJ' THEN 'Pessoa Jurídica'
    WHEN conta = 'PF' THEN 'Pessoa Física' 
    WHEN conta = 'CONC.' THEN 'Conciliação'
    ELSE conta -- Para contas customizadas, usar o próprio código como nome inicialmente
  END as name,
  CASE 
    WHEN conta = 'PJ' THEN '🏢'
    WHEN conta = 'PF' THEN '👤'
    WHEN conta = 'CONC.' THEN '🔄'
    ELSE '💼' -- Ícone padrão para contas customizadas
  END as icon,
  CASE 
    WHEN conta = 'PJ' THEN 1
    WHEN conta = 'PF' THEN 2
    WHEN conta = 'CONC.' THEN 3
    ELSE 10 -- Contas customizadas depois das padrão
  END as display_order
FROM transactions 
WHERE conta IS NOT NULL 
  AND conta != ''
ORDER BY display_order;

-- 3. POPULAR CATEGORIAS com base nas combinações conta + categoria existentes
INSERT INTO categories (account_id, code, name, icon, display_order)
SELECT DISTINCT
  a.id as account_id,
  t.categoria as code,
  t.categoria as name, -- Usar o próprio nome da categoria
  CASE 
    WHEN LOWER(t.categoria) LIKE '%receita%' THEN '💰'
    WHEN LOWER(t.categoria) LIKE '%despesa%' THEN '💸'
    WHEN LOWER(t.categoria) LIKE '%investimento%' THEN '📈'
    WHEN LOWER(t.categoria) LIKE '%ajuste%' THEN '⚙️'
    ELSE '📋'
  END as icon,
  ROW_NUMBER() OVER (PARTITION BY a.id ORDER BY t.categoria) as display_order
FROM transactions t
JOIN accounts a ON t.conta = a.code
WHERE t.categoria IS NOT NULL 
  AND t.categoria != ''
  AND t.categoria != 'Não classificado';

-- 4. POPULAR SUBCATEGORIAS com base nas combinações existentes
INSERT INTO subcategories (category_id, code, name, icon, display_order)
SELECT DISTINCT
  c.id as category_id,
  t.subtipo as code,
  t.subtipo as name, -- Usar o próprio nome do subtipo
  '📌' as icon, -- Ícone padrão para subtipos
  ROW_NUMBER() OVER (PARTITION BY c.id ORDER BY t.subtipo) as display_order
FROM transactions t
JOIN accounts a ON t.conta = a.code
JOIN categories c ON (c.account_id = a.id AND c.code = t.categoria)
WHERE t.subtipo IS NOT NULL 
  AND t.subtipo != ''
  AND t.subtipo != 'Não classificado';

-- 5. ADICIONAR COLUNA SUBCATEGORY_ID NA TABELA TRANSACTIONS
ALTER TABLE transactions 
ADD COLUMN subcategory_id UUID REFERENCES subcategories(id);

-- 6. POPULAR SUBCATEGORY_ID nas transações existentes
UPDATE transactions t
SET subcategory_id = s.id
FROM subcategories s
JOIN categories c ON s.category_id = c.id
JOIN accounts a ON c.account_id = a.id
WHERE t.conta = a.code 
  AND t.categoria = c.code 
  AND t.subtipo = s.code;

-- 7. CRIAR ÍNDICES
CREATE INDEX idx_accounts_code ON accounts(code);
CREATE INDEX idx_accounts_order ON accounts(display_order, is_active);
CREATE INDEX idx_categories_account ON categories(account_id, display_order);
CREATE INDEX idx_subcategories_category ON subcategories(category_id, display_order);
CREATE INDEX idx_transactions_subcategory ON transactions(subcategory_id);

-- 8. CRIAR TRIGGERS PARA UPDATED_AT
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

-- 9. CRIAR VIEW PARA FACILITAR CONSULTAS
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
  
  -- Caminho completo
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

-- 10. POLÍTICAS RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON accounts FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON categories FOR SELECT USING (true);
CREATE POLICY "Enable read access for all users" ON subcategories FOR SELECT USING (true);

-- 11. VERIFICAR RESULTADO
-- Contar quantos registros foram criados
SELECT 
  'ACCOUNTS' as tabela,
  COUNT(*) as total,
  STRING_AGG(name, ', ') as exemplos
FROM accounts
UNION ALL
SELECT 
  'CATEGORIES' as tabela,
  COUNT(*) as total,
  STRING_AGG(name, ', ') as exemplos
FROM categories
UNION ALL
SELECT 
  'SUBCATEGORIES' as tabela,
  COUNT(*) as total,
  STRING_AGG(name, ', ') as exemplos
FROM subcategories;

-- Mostrar alguns exemplos da hierarquia criada
SELECT * FROM v_subcategories_full LIMIT 10;