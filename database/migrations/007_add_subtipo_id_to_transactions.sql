-- Migration: Add subtipo_id to transactions table
-- Description: Links transactions to the new hierarchy system

-- Add the new field (optional for backward compatibility)
ALTER TABLE transactions 
ADD COLUMN subtipo_id UUID REFERENCES subtipos(id);

-- Create index for performance
CREATE INDEX idx_transactions_subtipo_id ON transactions(subtipo_id);

-- Optional: Create a view that enriches transactions with hierarchy data
CREATE VIEW vw_transactions_enriched AS
SELECT 
  t.*,
  h.conta_nome,
  h.conta_icone,
  h.categoria_nome, 
  h.categoria_icone,
  h.subtipo_nome,
  h.subtipo_icone,
  h.caminho_completo
FROM transactions t
LEFT JOIN vw_hierarquia_completa h ON t.subtipo_id = h.subtipo_id;