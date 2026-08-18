-- ═══════════════════════════════════════════════════════════════════════════════
-- 0006_workspace_schluessel.sql
-- Modell A: Zugriff auf den Workspace-Schluessel eines Kunden.
--
-- Der Schluessel liegt in vault.secrets (Migration 0005). Das Schema `vault`
-- ist ueber PostgREST bewusst NICHT erreichbar — supabase-js kann also nicht
-- direkt hineinsehen, und das ist richtig so: Waere es erreichbar, laege die
-- gesamte Geheimnisablage hinter derselben Tuer wie die Anwendungsdaten.
--
-- Stattdessen genau eine Funktion, die genau eine Frage beantwortet:
-- "Wie lautet der Schluessel DIESER Organisation?" Nicht "zeig mir alle".
--
-- security definer laesst sie mit den Rechten ihres Eigentuemers laufen, damit
-- sie den Vault lesen darf. Das ist der Grund, warum search_path hier fest
-- verdrahtet ist — ohne das koennte ein Aufrufer mit eigenem Schema
-- untermogeln, welche Tabelle "organizations" bedeutet.
-- ═══════════════════════════════════════════════════════════════════════════════

begin;

create or replace function public.workspace_schluessel(p_organization_id uuid)
returns text
language sql
stable
security definer
set search_path = public, vault, pg_temp
as $$
  select ds.decrypted_secret
    from public.organizations o
    join vault.decrypted_secrets ds on ds.id = o.anthropic_key_secret_id
   where o.id = p_organization_id;
$$;

comment on function public.workspace_schluessel(uuid) is
  'Liefert den Anthropic-Workspace-Schluessel einer Organisation aus dem Vault. Nur fuer service_role. Gibt NULL zurueck, wenn die Organisation keinen hinterlegt hat.';

-- Standardmaessig darf JEDER eine neue Funktion ausfuehren. Das hier ist der
-- wichtigste Teil der Migration: erst alles entziehen, dann gezielt geben.
revoke all on function public.workspace_schluessel(uuid) from public;
revoke all on function public.workspace_schluessel(uuid) from anon;
revoke all on function public.workspace_schluessel(uuid) from authenticated;
grant execute on function public.workspace_schluessel(uuid) to service_role;

commit;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Gegenprobe:
--
--   -- Als service_role: liefert den Schluessel (hier nur die Laenge, damit er
--   -- nicht im Abfrageverlauf steht).
--   set local role service_role;
--   select length(public.workspace_schluessel('b636c4f2-45ea-4279-846a-170bcaa3537c'));
--   -- erwartet: 108
--
--   -- Als anon: muss scheitern.
--   set local role anon;
--   select public.workspace_schluessel('b636c4f2-45ea-4279-846a-170bcaa3537c');
--   -- erwartet: permission denied for function workspace_schluessel
-- ═══════════════════════════════════════════════════════════════════════════════
