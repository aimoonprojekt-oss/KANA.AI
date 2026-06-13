-- ============================================================
-- SUPABASE DATENBANKSCHEMA - Agent Platform
-- ============================================================
-- Dieses SQL in der Supabase Console ausführen:
-- supabase.com → Dein Projekt → SQL Editor → New Query → Einfügen → Run
-- ============================================================


-- ── Tabelle 1: Agent-Zugänge ──────────────────────────────
-- Speichert wer welchen Agent gekauft hat
CREATE TABLE IF NOT EXISTS agent_access (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         TEXT NOT NULL,          -- Clerk User ID (z.B. "user_2abc...")
  agent_id        TEXT NOT NULL,          -- Anthropic Agent ID (z.B. "agt_abc...")
  agent_name      TEXT NOT NULL,          -- Anzeigename (z.B. "Sales Agent")
  agent_description TEXT NOT NULL DEFAULT '',
  purchased_at    TIMESTAMPTZ DEFAULT NOW(),
  is_active       BOOLEAN DEFAULT TRUE,   -- false = Abo gekündigt

  -- Ein Benutzer kann denselben Agent nur einmal kaufen
  UNIQUE(user_id, agent_id)
);

-- Index für schnelle Abfragen nach User
CREATE INDEX IF NOT EXISTS idx_agent_access_user_id ON agent_access(user_id);


-- ── Tabelle 2: Sessions ───────────────────────────────────
-- Speichert alle Agent-Sessions pro Kunde
CREATE TABLE IF NOT EXISTS sessions (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               TEXT NOT NULL,          -- Clerk User ID
  agent_id              TEXT NOT NULL,           -- Anthropic Agent ID
  anthropic_session_id  TEXT NOT NULL UNIQUE,    -- Session ID von Anthropic
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  last_message_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnelle Abfragen nach User
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);


-- ── Row Level Security (RLS) ──────────────────────────────
-- Sicherheits-Regeln: Benutzer sehen nur ihre eigenen Daten

ALTER TABLE agent_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Für agent_access: nur eigene Zeilen lesen (über Backend-Calls)
-- Hinweis: Wir nutzen den Service Role Key im Backend, daher
-- gelten diese Policies für direkte Frontend-Zugriffe.
CREATE POLICY "Users see own agent access" ON agent_access
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Users see own sessions" ON sessions
  FOR SELECT USING (auth.uid()::text = user_id);

-- ── SNL Agent Knowledge-Tabellen ─────────────────────────

-- Brand Expert: Sins 'n Lashes Brand Intelligence
CREATE TABLE IF NOT EXISTS public.brand_knowledge (
  key        TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Creative Strategist: REF-Dateien (5 Stages Framework etc.)
CREATE TABLE IF NOT EXISTS public.strategist_knowledge (
  key        TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Creative Analyst: Analyse-Framework & Scoring-Rubrik
CREATE TABLE IF NOT EXISTS public.analyst_knowledge (
  key        TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  content    TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Creative Analyst: Input-Breakdowns (vom Researcher geliefert)
CREATE TABLE IF NOT EXISTS public.analyst_breakdowns (
  ad_id      TEXT PRIMARY KEY,
  advertiser TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Creative Analyst: Output-Analysen (K1-K6 Scoring, vom Strategist genutzt)
CREATE TABLE IF NOT EXISTS public.analyst_results (
  ad_id      TEXT PRIMARY KEY,
  advertiser TEXT NOT NULL,
  score      FLOAT,
  klasse     TEXT,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── Seed-Skripte (im Ordner "Brand experte railway") ─────
-- node seed_supabase.js    → brand_knowledge befüllen
-- node seed_strategist.js  → strategist_knowledge befüllen
-- node seed_analyst.js     → analyst_knowledge befüllen
