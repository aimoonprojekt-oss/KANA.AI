-- ═══════════════════════════════════════════════════════════════════════════════
-- 0004_memory_store_ids.sql
-- Behebt L1 aus claude/architektur-console-first.md
--
-- app/api/chat/route.ts las bisher `agentDef.memory_store_ids` über einen
-- TypeScript-Cast:
--
--     (agentDef as { memory_store_ids?: string[] } | null)?.memory_store_ids
--
-- Die Spalte gab es aber nie. Der Cast unterdrückt den Compilerfehler, zur
-- Laufzeit war der Wert immer `undefined`, und der Code fiel stillschweigend
-- auf ANTHROPIC_MEMORY_STORE_IDS zurück — EINE globale Liste für alle Agenten
-- und alle Mandanten. Genau das Gegenteil der Entscheidung vom 17.08.2026,
-- Kundenwissen je Agent in einem eigenen Memory-Store zu halten.
--
-- Vorbild ist `vault_ids`: gleiche Bauart, gleicher Weg in die Session,
-- funktioniert dort seit jeher.
-- ═══════════════════════════════════════════════════════════════════════════════

begin;

alter table public.agents
  add column if not exists memory_store_ids text[];

comment on column public.agents.memory_store_ids is
  'Memory-Store-IDs (memstore_...), die beim Anlegen einer Session unter /mnt/memory/<name>/ eingehaengt werden. NULL oder leer = kein Kundenwissen. Traegt das Wissen, das frueher in brand_knowledge, strategist_knowledge und analyst_knowledge lag.';

comment on column public.agents.vault_ids is
  'Vault-IDs fuer Zugangsdaten, die der Agent im Container braucht (z.B. APIFY_API_TOKEN, GEMINI_API_KEY). Werden nur beim Anlegen der Session angehaengt.';

-- ── L2: Zuordnung Console-Agent -> Repo-Ordner ────────────────────────────────
--
-- Die Werkzeugskripte liegen im Repo unter agents/<ordner>/werkzeuge/. Welcher
-- Console-Agent zu welchem Ordner gehoert, laesst sich NICHT aus Name oder Slug
-- ableiten — gepruefet am 18.08.2026:
--
--   Repo-Ordner            Console-Name (Slug)
--   creative-strategist    Creative Strategist (Test Modus 20)   creative-strategist-test-modus-20
--   dokumentenbauer        Sub_Dokumentenbauer                   sub-dokumentenbauer
--   brand-expert           Brand Expert - Check                  brand-expert-check
--
-- Der Slug entsteht aus dem Anzeigenamen in der Console und aendert sich, sobald
-- jemand dort umbenennt. Als Schluessel taugt er nicht. Deshalb eine eigene
-- Spalte, gesetzt beim Ausrollen: scripts/console-ausrollen.sh gibt bereits
-- { "<ordner>": "<agent_id>" } aus — genau diese Zuordnung gehoert hierher.
alter table public.agents
  add column if not exists repo_ordner text;

comment on column public.agents.repo_ordner is
  'Ordnername unter agents/ im Repo, z.B. "creative-researcher". Bestimmt, welche Werkzeugskripte beim Anlegen einer Session nach /mnt/session/uploads/ gemountet werden. NULL = keine Werkzeuge.';

commit;

-- Gegenprobe:
--   select column_name, data_type from information_schema.columns
--    where table_schema='public' and table_name='agents'
--      and column_name in ('vault_ids','memory_store_ids');
--   -> beide Zeilen, data_type = ARRAY
--
-- Befuellen (Beispiel, IDs aus der Console):
--   update public.agents
--      set memory_store_ids = array['memstore_...']
--    where slug = 'creative-strategist';
