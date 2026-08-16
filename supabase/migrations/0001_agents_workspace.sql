-- =====================================================================
-- 0001 — Workspace-Zugehörigkeit und Archiv für den Agenten-Katalog
--
-- Anlass: In `agents` stehen Agenten, die es in der Claude Console nicht
-- mehr gibt. Der Sync hat sie bisher nur auf published=false gesetzt und
-- die Zeile stehen lassen — man konnte danach nicht mehr unterscheiden,
-- ob ein Agent absichtlich verborgen oder schlicht verschwunden ist.
--
-- Ausserdem fehlte die Zugehörigkeit: Welcher Agent gehört zu welchem
-- Console-Workspace (KANA AI = Produktkatalog, Kundenworkspaces = Bestand
-- eines einzelnen Kunden)?
--
-- Diese Migration ergänzt nur Spalten. Sie löscht nichts und ändert keine
-- bestehenden Werte. Erst auf Staging einspielen, dann auf Produktion.
-- =====================================================================

-- Zu welchem Console-Workspace gehört der Agent.
-- NULL = unbekannt (Altbestand, vor dieser Migration synchronisiert).
alter table public.agents
  add column if not exists workspace text;

-- Wann wurde der Agent zuletzt in der Console gesehen?
-- Wird bei jedem Sync gesetzt. NULL = seit dieser Migration nie gesehen.
alter table public.agents
  add column if not exists last_seen_at timestamptz;

-- Archiviert = in der Console nicht mehr vorhanden.
-- Bewusst kein DELETE: An einem Agenten hängen Zugänge, Sitzungen und
-- später Abrechnungsdaten. Die Zeile bleibt, verschwindet aber aus allen
-- Kundenansichten.
alter table public.agents
  add column if not exists archived boolean not null default false;

-- Suchbeschleunigung für die Katalogabfragen
create index if not exists agents_workspace_idx
  on public.agents (workspace);

create index if not exists agents_sichtbar_idx
  on public.agents (published, archived);

comment on column public.agents.workspace     is 'Anzeigename des Console-Workspace, z.B. "KANA AI". NULL = unbekannt.';
comment on column public.agents.last_seen_at  is 'Letzter Sync, bei dem der Agent in der Console gefunden wurde.';
comment on column public.agents.archived      is 'true = in der Console nicht mehr vorhanden. Zeile bleibt wegen bestehender Zugaenge erhalten.';

-- ---------------------------------------------------------------------
-- Kontrolle nach dem Einspielen
-- ---------------------------------------------------------------------
-- select workspace, archived, published, count(*)
-- from public.agents
-- group by 1,2,3
-- order by 1 nulls first;
--
-- Direkt nach der Migration steht ueberall workspace = NULL und
-- archived = false. Erst der naechste Sync ordnet zu: Was in der Console
-- gefunden wird, bekommt seinen Workspace; was nicht mehr da ist, wird
-- archiviert.
