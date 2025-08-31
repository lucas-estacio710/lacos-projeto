-- Migration: Add subtipo_id to card_transactions table
-- Description: Links card transactions to the new hierarchy system

-- Add the new field (optional for backward compatibility)
ALTER TABLE card_transactions 
ADD COLUMN subtipo_id UUID REFERENCES subtipos(id);

-- Create index for performance
CREATE INDEX idx_card_transactions_subtipo_id ON card_transactions(subtipo_id);

-- Optional: Create a view that enriches card transactions with hierarchy data
CREATE VIEW vw_card_transactions_enriched AS
SELECT 
  ct.*,
  h.conta_nome,
  h.conta_icone,
  h.categoria_nome, 
  h.categoria_icone,
  h.subtipo_nome,
  h.subtipo_icone,
  h.caminho_completo
FROM card_transactions ct
LEFT JOIN vw_hierarquia_completa h ON ct.subtipo_id = h.subtipo_id;