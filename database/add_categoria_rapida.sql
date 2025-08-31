-- Adicionar campo categoria_rapida na tabela subtipos
ALTER TABLE subtipos ADD COLUMN IF NOT EXISTS categoria_rapida BOOLEAN DEFAULT FALSE;

-- Adicionar campo cor para os botões de ação rápida
ALTER TABLE subtipos ADD COLUMN IF NOT EXISTS cor_botao VARCHAR(50);

-- Adicionar comentário para explicar o campo
COMMENT ON COLUMN subtipos.categoria_rapida IS 'Indica se este subtipo aparece como botão de ação rápida na classificação';
COMMENT ON COLUMN subtipos.cor_botao IS 'Classe CSS para a cor do botão de ação rápida (ex: bg-green-600 hover:bg-green-500)';

-- Exemplo de como marcar alguns subtipos como categoria rápida
-- UPDATE subtipos SET categoria_rapida = TRUE, cor_botao = 'bg-green-600 hover:bg-green-500' 
-- WHERE nome = 'SUPERMERCADOS';

-- UPDATE subtipos SET categoria_rapida = TRUE, cor_botao = 'bg-orange-600 hover:bg-orange-500' 
-- WHERE nome = 'RESTAURANTES';

-- UPDATE subtipos SET categoria_rapida = TRUE, cor_botao = 'bg-blue-600 hover:bg-blue-500' 
-- WHERE nome = 'CARRO PESSOAL';

-- UPDATE subtipos SET categoria_rapida = TRUE, cor_botao = 'bg-purple-600 hover:bg-purple-500' 
-- WHERE nome = 'CARRO RIP';

-- UPDATE subtipos SET categoria_rapida = TRUE, cor_botao = 'bg-gray-600 hover:bg-gray-500' 
-- WHERE nome = 'ENTRECONTAS';