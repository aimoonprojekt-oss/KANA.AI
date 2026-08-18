-- ═══════════════════════════════════════════════════════════════════════════════
-- 0002_rls_absichern.sql
-- Behebt Befund K1: Die Datenbank ist derzeit über den Anon-Key vollständig
-- lesbar und beschreibbar.
--
-- WARUM DAS SICHER IST
-- --------------------
-- Geprüft am 18.08.2026:  select rolname, rolbypassrls from pg_roles;
--   service_role  -> rolbypassrls = true
--   anon          -> rolbypassrls = false
--   authenticated -> rolbypassrls = false
--
-- service_role umgeht RLS grundsätzlich. Die Anwendung greift ausschließlich
-- über getSupabaseAdmin() mit dem Service-Role-Key zu (lib/platform/supabase.ts:19,
-- jeder .from()-Aufruf im Repo geprüft). Policies für service_role sind also
-- wirkungslos — sie erlauben faktisch nur anon und authenticated.
-- Das Entfernen dieser Policies kann die Anwendung nicht brechen.
--
-- WAS SICH ÄNDERT
-- ---------------
-- vorher: anon sieht organizations 1, agents 6, agent_access1 3, sessions 2,
--         runs 2, ad_research 8 ... und kann schreiben (INSERT-Test bestanden)
-- nachher: anon und authenticated sehen 0 Zeilen und können nichts schreiben.
--          Die Anwendung arbeitet unverändert weiter.
-- ═══════════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. Die acht wirkungslosen Policies entfernen ────────────────────────────────
-- Sie heißen "Service-Role Full Access", gelten aber für die Rolle public
-- mit der Bedingung true — also für alle, inklusive anon.

drop policy if exists "Service-Role Full Access" on public.organizations;
drop policy if exists "Service-Role Full Access" on public.agents;
drop policy if exists "Service-Role Full Access" on public.agent_access1;
drop policy if exists "Service-Role Full Access" on public.sessions;
drop policy if exists "Service-Role Full Access" on public.runs;
drop policy if exists "Service-Role Full Access" on public.widget_configs;
drop policy if exists "Service-Role Full Access" on public.escalations;

-- brand_knowledge hatte als einzige Tabelle eine korrekte Einschränkung
-- (auth.role() = 'service_role'). Auch sie ist überflüssig, weil service_role
-- RLS ohnehin umgeht — und sie kostet Leistung, weil auth.role() pro Zeile
-- ausgewertet wird (Supabase-Linter: auth_rls_initplan). Entfernen behebt beides.
drop policy if exists "service_role_only" on public.brand_knowledge;

-- ── 2. RLS auf den sechs ungeschützten Tabellen aktivieren ──────────────────────
alter table public.ad_research          enable row level security;
alter table public.strategist_knowledge enable row level security;
alter table public.analyst_knowledge    enable row level security;
alter table public.analyst_breakdowns   enable row level security;
alter table public.analyst_results      enable row level security;
alter table public.research_sessions    enable row level security;

-- ── 3. RLS auch gegen Tabelleneigentümer erzwingen ──────────────────────────────
-- Ohne FORCE würde der Eigentümer der Tabelle (postgres) RLS umgehen.
-- service_role bleibt davon unberührt (bypassrls gilt weiterhin).
alter table public.organizations        force row level security;
alter table public.agents               force row level security;
alter table public.agent_access1        force row level security;
alter table public.sessions             force row level security;
alter table public.runs                 force row level security;
alter table public.widget_configs       force row level security;
alter table public.escalations          force row level security;
alter table public.brand_knowledge      force row level security;
alter table public.ad_research          force row level security;
alter table public.strategist_knowledge force row level security;
alter table public.analyst_knowledge    force row level security;
alter table public.analyst_breakdowns   force row level security;
alter table public.analyst_results      force row level security;
alter table public.research_sessions    force row level security;

-- ── 4. Nebenbefund N5: search_path der Trigger-Funktion fixieren ────────────────
-- Supabase-Linter: function_search_path_mutable
alter function public.update_updated_at() set search_path = public, pg_temp;

-- ── 5. Nebenbefund N6: fehlender Index auf dem Fremdschlüssel ───────────────────
create index if not exists agent_access1_agent_id_idx
  on public.agent_access1 (agent_id);

commit;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PRÜFUNG NACH DEM EINSPIELEN — muss überall 0 ergeben:
--
--   set local role anon;
--   select 'organizations' t, count(*) from public.organizations
--   union all select 'agents',          count(*) from public.agents
--   union all select 'agent_access1',   count(*) from public.agent_access1
--   union all select 'sessions',        count(*) from public.sessions
--   union all select 'runs',            count(*) from public.runs
--   union all select 'widget_configs',  count(*) from public.widget_configs
--   union all select 'escalations',     count(*) from public.escalations
--   union all select 'ad_research',     count(*) from public.ad_research
--   union all select 'brand_knowledge', count(*) from public.brand_knowledge
--   union all select 'analyst_results', count(*) from public.analyst_results
--   union all select 'research_sessions', count(*) from public.research_sessions;
--
-- Und die Anwendung muss unverändert funktionieren:
--   Dashboard öffnen -> Agentenliste lädt -> Chat startet.
--
-- ZURÜCKROLLEN (falls doch etwas klemmt):
--   alter table public.<tabelle> disable row level security;
-- pro betroffener Tabelle. Die alten Policies müssen NICHT wiederhergestellt
-- werden — sie hatten keinerlei Funktion für die Anwendung.
-- ═══════════════════════════════════════════════════════════════════════════════
