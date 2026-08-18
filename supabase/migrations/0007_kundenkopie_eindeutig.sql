-- ═══════════════════════════════════════════════════════════════════════════════
-- 0007_kundenkopie_eindeutig.sql
-- Modell A: Je Kunde und Produkt darf es genau EINE Kopie geben.
--
-- Warum das eine Datenbankregel sein muss und keine Codepruefung:
--
-- Die Kopie entsteht beim ersten Chat ("lazy"). Klickt jemand zweimal schnell
-- hintereinander, laufen zwei Anfragen gleichzeitig. Beide sehen "keine Kopie
-- vorhanden", beide legen eine an — und der Kunde hat zwei Agenten mit
-- getrennten Sitzungsverlaeufen fuer dasselbe Produkt. Eine Pruefung im Code
-- kann das nicht verhindern, weil zwischen Pruefung und Anlage Zeit vergeht.
--
-- Der eindeutige Index verhindert es. Der zweite Insert scheitert, der Code
-- faengt das ab und liest die vorhandene Kopie.
--
-- Nur fuer Kopien: Master haben organization_id IS NULL, und davon gibt es je
-- Produkt genau einen — das regelt bereits anthropic_agent_id UNIQUE.
-- ═══════════════════════════════════════════════════════════════════════════════

begin;

create unique index if not exists agents_eine_kopie_je_kunde_und_produkt
  on public.agents (organization_id, master_agent_id)
  where organization_id is not null;

commit;

-- Gegenprobe — muss den Index zeigen:
--   select indexname from pg_indexes
--    where schemaname='public' and indexname='agents_eine_kopie_je_kunde_und_produkt';
