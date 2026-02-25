-- 010_add_updated_at_to_transactions.sql
-- Adiciona coluna updated_at na tabela transactions e triggers de auto-update

-- 1. Adicionar coluna updated_at na tabela transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Preencher valores existentes com created_at (ou NOW() se não existir)
UPDATE transactions SET updated_at = COALESCE(created_at, NOW()) WHERE updated_at IS NULL;

-- 3. Criar função genérica para auto-atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Criar trigger para transactions
DROP TRIGGER IF EXISTS trigger_transactions_updated_at ON transactions;
CREATE TRIGGER trigger_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. Criar trigger para card_transactions (garantir auto-update)
DROP TRIGGER IF EXISTS trigger_card_transactions_updated_at ON card_transactions;
CREATE TRIGGER trigger_card_transactions_updated_at
  BEFORE UPDATE ON card_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Criar índices para ordenação eficiente por updated_at
CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON transactions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_card_transactions_updated_at ON card_transactions(updated_at DESC);
