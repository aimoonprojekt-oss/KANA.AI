-- ═══════════════════════════════════════════════════════════════════════════════
-- 0005_mandanten_workspaces.sql
-- Modell A: ein Workspace je Kunde. Entscheidung vom 18.08.2026.
--
-- Bisher kannte die Datenbank nur eine Sorte Agent. In Modell A gibt es zwei:
--
--   Master   liegt im Workspace "KANA AI", ist der Katalogeintrag, hat einen
--            Preis und wird veroeffentlicht. organization_id IS NULL.
--   Kopie    liegt im Workspace des Kunden, wird nie veroeffentlicht, und
--            master_agent_id zeigt auf das Produkt, von dem sie abstammt.
--
-- Gekauft wird immer der Master (agent_access1 bleibt unveraendert) — gestartet
-- wird immer die Kopie im Workspace des Kunden.
-- ═══════════════════════════════════════════════════════════════════════════════

begin;

-- ── Der Kunde und sein Workspace ──────────────────────────────────────────────
alter table public.organizations
  add column if not exists anthropic_workspace_id  text,
  add column if not exists anthropic_key_secret_id uuid,
  add column if not exists ausgabenlimit_eur       numeric;

comment on column public.organizations.anthropic_workspace_id is
  'Workspace-ID (wrk_...) dieses Kunden in der Claude Console. NULL = noch nicht aufgesetzt.';

-- Der API-Schluessel selbst steht NICHT hier, sondern in vault.secrets.
-- Hier liegt nur der Verweis. Grund: Eine Klartextspalte mit fuenfzig
-- Anthropic-Schluesseln waere derselbe Fehler wie in widget_configs, den wir
-- am 18.08. als kritisch aufgeschrieben haben. supabase_vault 0.3.1 ist
-- installiert und dafuer da.
--
--   select vault.create_secret('sk-ant-...', 'anthropic_wrk_kunde_mueller', 'Workspace-Schluessel');
--   update public.organizations set anthropic_key_secret_id = '<zurueckgegebene uuid>' where id = '...';
--
-- Gelesen wird serverseitig ueber vault.decrypted_secrets.
comment on column public.organizations.anthropic_key_secret_id is
  'Verweis auf vault.secrets — der Workspace-API-Schluessel dieses Kunden. Der Wert steht nie in dieser Tabelle.';

comment on column public.organizations.ausgabenlimit_eur is
  'Das in der Console gesetzte Ausgabenlimit des Workspace. Nur zur Dokumentation — durchgesetzt wird es von Anthropic, nicht von uns. Laesst sich laut scripts/workspace-anlegen.sh nicht per API setzen.';

-- ── Master und Kopie unterscheidbar machen ────────────────────────────────────
alter table public.agents
  add column if not exists organization_id uuid references public.organizations(id),
  add column if not exists master_agent_id uuid references public.agents(id);

comment on column public.agents.organization_id is
  'NULL = Master im KANA-Workspace (Katalogeintrag). Gesetzt = Kopie im Workspace dieses Kunden.';

comment on column public.agents.master_agent_id is
  'Bei einer Kopie: die agents.id des Masters, von dem sie abstammt. Beim Master selbst NULL.';

-- Entweder beides oder keins. Eine Kopie ohne Master waere eine Waise, ein
-- Master mit master_agent_id ein Widerspruch. Die sechs bestehenden Zeilen
-- sind alle Master und erfuellen die Bedingung bereits.
alter table public.agents
  add constraint agents_master_oder_kopie
  check ((organization_id is null) = (master_agent_id is null));

-- ── Die beiden Abfragen, um die sich alles dreht ──────────────────────────────
-- Katalog:  where organization_id is null and published and not archived
-- Laufzeit: where organization_id = <org> and master_agent_id = <master>
create index if not exists agents_katalog_idx
  on public.agents (published, archived) where organization_id is null;

create index if not exists agents_kopie_idx
  on public.agents (organization_id, master_agent_id);

commit;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Gegenprobe — diese beiden laufen jetzt wirklich:
--
--   -- Katalog (Shop). Zeigt heute die sechs bestehenden Agenten als Master.
--   select name, slug, price_eur, published
--     from public.agents
--    where organization_id is null and published and not archived
--    order by name;
--
--   -- Kopien je Kunde. Heute leer, das ist richtig so.
--   select o.name as kunde, a.name as agent, m.name as produkt
--     from public.agents a
--     join public.organizations o on o.id = a.organization_id
--     join public.agents m       on m.id = a.master_agent_id
--    order by 1, 2;
-- ═══════════════════════════════════════════════════════════════════════════════
