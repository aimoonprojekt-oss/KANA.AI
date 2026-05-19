-- ============================================================
-- widget_configs — Pro-Shop-Konfiguration für den Support-Agent
-- Jeder KANA AI Kunde (Shop-Betreiber) hat einen Eintrag hier.
-- Der widget_token wird im Shopify-Widget eingebettet.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.widget_configs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  widget_token          TEXT NOT NULL UNIQUE,        -- Eingebettet im <script> Tag im Shopify-Theme
  organization_id       UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  anthropic_agent_id    TEXT NOT NULL,               -- Kundenkopie des Support-Agents (aus agent_access1)

  -- Shopify
  shopify_shop          TEXT,                        -- z.B. meinshop.myshopify.com
  shopify_access_token  TEXT,                        -- shpat_...

  -- DHL
  dhl_api_key           TEXT,

  -- Trello (Antwortvorlagen)
  trello_key            TEXT,
  trello_token          TEXT,
  trello_board_id       TEXT,

  -- Eskalation
  escalation_email      TEXT,                        -- 2nd-Level E-Mail des Shop-Betreibers

  -- Status
  active                BOOLEAN DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Index für schnellen Token-Lookup bei jedem Chat-Request
CREATE INDEX IF NOT EXISTS idx_widget_configs_token
  ON public.widget_configs (widget_token)
  WHERE active = TRUE;

-- Index für Org-Lookup (Admin-Dashboard)
CREATE INDEX IF NOT EXISTS idx_widget_configs_org
  ON public.widget_configs (organization_id);

-- RLS aktivieren — nur Service-Role darf lesen/schreiben
ALTER TABLE public.widget_configs ENABLE ROW LEVEL SECURITY;

-- Alle Zugriffe via Service-Role (Server-Side) erlauben
CREATE POLICY "Service-Role Full Access" ON public.widget_configs
  USING (TRUE)
  WITH CHECK (TRUE);

-- ============================================================
-- escalations — Protokoll aller Eskalationen
-- ============================================================

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
  ON public.escalations (handled, created_at DESC)
  WHERE handled = FALSE;

ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service-Role Full Access" ON public.escalations
  USING (TRUE)
  WITH CHECK (TRUE);

-- ============================================================
-- Helper: Updated-At Trigger für widget_configs
-- ============================================================

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

-- ============================================================
-- Beispiel-Eintrag (als Referenz — nicht im Produktivsystem)
-- ============================================================
-- INSERT INTO public.widget_configs (
--   widget_token, organization_id, anthropic_agent_id,
--   shopify_shop, shopify_access_token,
--   dhl_api_key,
--   escalation_email,
--   active
-- ) VALUES (
--   gen_random_uuid()::text,
--   '<organization-uuid>',
--   '<customer-anthropic-agent-id>',
--   'meinshop.myshopify.com',
--   'shpat_...',
--   'dhl-api-key...',
--   'support@meinshop.de',
--   TRUE
-- );
