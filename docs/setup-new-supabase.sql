-- ============================================================
-- KANA AI — Vollständiges Datenbankschema
-- Für neues Supabase-Projekt ausführen:
-- supabase.com → Projekt → SQL Editor → New Query → Einfügen → Run
-- ============================================================


-- ── Tabelle: organizations ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT,
  user_id     TEXT UNIQUE,       -- Clerk user_id
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service-Role Full Access" ON public.organizations
  USING (TRUE) WITH CHECK (TRUE);


-- ── Tabelle: agents (Master-Agent-Katalog) ────────────────────
CREATE TABLE IF NOT EXISTS public.agents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anthropic_agent_id  TEXT UNIQUE,
  environment_id      TEXT,
  name                TEXT,
  slug                TEXT,
  description         TEXT,
  category            TEXT,
  thumbnail_url       TEXT,
  price_eur           NUMERIC,
  published           BOOLEAN DEFAULT FALSE,
  featured            BOOLEAN DEFAULT FALSE,
  stripe_price_id     TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service-Role Full Access" ON public.agents
  USING (TRUE) WITH CHECK (TRUE);


-- ── Tabelle: agent_access1 (Wer hat was gekauft) ─────────────
CREATE TABLE IF NOT EXISTS public.agent_access1 (
  id                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id              UUID REFERENCES public.organizations(id),
  agent_id                     UUID REFERENCES public.agents(id),
  customer_anthropic_agent_id  TEXT,
  active                       BOOLEAN DEFAULT TRUE,
  purchased_at                 TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (organization_id, agent_id)
);

ALTER TABLE public.agent_access1 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service-Role Full Access" ON public.agent_access1
  USING (TRUE) WITH CHECK (TRUE);


-- ── Tabelle: sessions ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               TEXT,
  agent_id              TEXT,
  anthropic_session_id  TEXT UNIQUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  last_message_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service-Role Full Access" ON public.sessions
  USING (TRUE) WITH CHECK (TRUE);


-- ── Tabelle: runs ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID,
  status          TEXT,
  input_prompt    TEXT,
  output_summary  TEXT,
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service-Role Full Access" ON public.runs
  USING (TRUE) WITH CHECK (TRUE);


-- ── Tabelle: widget_configs ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.widget_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_token          TEXT NOT NULL UNIQUE,
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  anthropic_agent_id    TEXT NOT NULL,
  shopify_shop          TEXT,
  shopify_access_token  TEXT,
  dhl_api_key           TEXT,
  trello_key            TEXT,
  trello_token          TEXT,
  trello_board_id       TEXT,
  escalation_email      TEXT,
  active                BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_widget_configs_token
  ON public.widget_configs (widget_token) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_widget_configs_org
  ON public.widget_configs (organization_id);

ALTER TABLE public.widget_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service-Role Full Access" ON public.widget_configs
  USING (TRUE) WITH CHECK (TRUE);


-- ── Tabelle: escalations ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.escalations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES public.organizations(id),
  shop             TEXT,
  reason           TEXT NOT NULL,
  summary          TEXT,
  customer_message TEXT,
  priority         TEXT CHECK (priority IN ('HOCH', 'NORMAL')) DEFAULT 'NORMAL',
  handled          BOOLEAN DEFAULT FALSE,
  handled_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escalations_org
  ON public.escalations (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escalations_unhandled
  ON public.escalations (handled, created_at DESC) WHERE handled = FALSE;

ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service-Role Full Access" ON public.escalations
  USING (TRUE) WITH CHECK (TRUE);


-- ── Trigger: updated_at für widget_configs ────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER widget_configs_updated_at
  BEFORE UPDATE ON public.widget_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- Constraints sind bereits via UNIQUE in den CREATE TABLE Statements oben definiert.
