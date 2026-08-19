-- Einmalige Einrichtungsgebuehr je Agent
--
-- Bis hierher kannte der Katalog nur price_eur, den Monatsbeitrag. Die
-- Einrichtung wurde aber ebenfalls berechnet und tauchte nirgends auf der
-- Seite auf. Kunden erfuhren davon erst im Gespraech — das ist genau die
-- Art versteckter Kosten, die Vertrauen kostet.
--
-- setup_eur = 0 bedeutet: keine Einrichtungsgebuehr, die Seite zeigt dann
-- auch keine Zeile dafuer an. NULL bedeutet: noch nicht festgelegt, die
-- Seite zeigt "nach Aufwand".
--
-- Ausfuehren im Supabase SQL-Editor.

alter table public.agents
  add column if not exists setup_eur integer;

comment on column public.agents.setup_eur is
  'Einmalige Einrichtungsgebuehr in Euro. 0 = keine, NULL = nach Aufwand.';

-- Beispiel: Betraege setzen (Werte anpassen)
-- update public.agents set setup_eur = 1500 where slug = 'brand-expert-check';
