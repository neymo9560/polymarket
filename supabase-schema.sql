-- ============================================================
-- SUPABASE SCHEMA - Tables pour la persistance du bot
-- Exécuter dans Supabase SQL Editor
-- ============================================================

-- Table pour l'état du bot
CREATE TABLE IF NOT EXISTS bot_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL,
  bot_state JSONB DEFAULT '{}',
  open_positions JSONB DEFAULT '[]',
  trades JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table pour l'historique des trades
CREATE TABLE IF NOT EXISTS trades (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  market TEXT,
  side TEXT,
  entry_price DECIMAL,
  exit_price DECIMAL,
  size DECIMAL,
  profit DECIMAL,
  strategy TEXT,
  status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_bot_states_user_id ON bot_states(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);

-- RLS (Row Level Security) - optionnel
ALTER TABLE bot_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE trades ENABLE ROW LEVEL SECURITY;

-- Politique: tout le monde peut lire/écrire (pour simplifier)
CREATE POLICY "Allow all" ON bot_states FOR ALL USING (true);
CREATE POLICY "Allow all" ON trades FOR ALL USING (true);
