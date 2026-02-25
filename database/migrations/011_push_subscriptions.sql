-- 011_push_subscriptions.sql
-- Tabela para armazenar subscriptions de push notifications

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Unique constraint no endpoint (evitar duplicatas)
ALTER TABLE push_subscriptions ADD CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint);

-- Index para buscar subscriptions rapidamente
CREATE INDEX idx_push_subscriptions_user_id ON push_subscriptions(user_id);

-- Habilitar RLS
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: usuário pode gerenciar suas próprias subscriptions
CREATE POLICY "Users can manage their own push subscriptions"
  ON push_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: service role pode ler todas (para enviar notificações)
CREATE POLICY "Service role can read all push subscriptions"
  ON push_subscriptions
  FOR SELECT
  USING (true);
