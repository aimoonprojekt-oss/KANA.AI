-- Beschreibung, Fakten und Startprompts je Agent
--
-- Der Chat-Entwurf zeigt vor der ersten Nachricht: Agentenname,
-- Beschreibung, drei Fakten-Chips ("Liefert", "Braucht", "Typische
-- Laufzeit") und sechs Startprompts zum Antippen. Beschreibung gibt es
-- schon (description), die anderen beiden nicht.
--
-- Bewusst als jsonb und nicht fest im Code: sonst haengen Produkttexte
-- wieder im Repo statt bei den Daten, wo sie hingehoeren.
--
-- Ausfuehren im Supabase SQL-Editor.

alter table public.agents
  add column if not exists chat_fakten  jsonb,
  add column if not exists chat_prompts jsonb;

comment on column public.agents.chat_fakten is
  'Fakten-Chips im leeren Chat. Form: [["Liefert","…"],["Braucht","…"]]';
comment on column public.agents.chat_prompts is
  'Startprompts im leeren Chat. Form: [{"kurz":"Hooks","text":"Welche Hooks …?"}]';

-- Beispiel (Werte anpassen):
-- update public.agents set
--   chat_fakten = '[["Liefert","Hook-Analyse, Formatvergleich, Tabelle"],
--                   ["Braucht","Wettbewerber oder Nische"],
--                   ["Typische Laufzeit","2–6 Minuten"]]'::jsonb,
--   chat_prompts = '[{"kurz":"Hooks","text":"Welche Hooks laufen bei meinen Wettbewerbern am längsten?"},
--                    {"kurz":"Formate","text":"Vergleiche Video- und Bild-Ads der letzten 30 Tage."}]'::jsonb
-- where slug = 'brand-expert-check';
