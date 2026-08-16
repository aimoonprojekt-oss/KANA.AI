import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  upsertAgent,
  archiviereVerschwundeneAgenten,
  isAdminUser,
} from "@/lib/platform/supabase";
import { konfigurierteWorkspaces } from "@/lib/anthropic/workspaces";

export const runtime = "nodejs";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Agenten eines Workspace laden. Der Schlüssel bestimmt den Workspace. */
async function agentenLaden(apiKey: string): Promise<Record<string, unknown>[]> {
  const anthropic = new Anthropic({ apiKey });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (anthropic as any).beta;

  const liste: Record<string, unknown>[] = [];
  try {
    for await (const agent of beta.agents.list()) {
      liste.push(agent as Record<string, unknown>);
    }
  } catch {
    // Ältere SDK-Fassungen liefern keine iterierbare Seite
    const resp = await beta.agents.list();
    const page: Record<string, unknown>[] =
      resp?.data ?? resp?.agents ?? (Array.isArray(resp) ? resp : []);
    liste.push(...page);
  }
  return liste;
}

/**
 * POST /api/admin/sync-agents
 *
 * Gleicht den Agenten-Katalog mit der Claude Console ab — über ALLE
 * Workspaces, für die ein Schlüssel hinterlegt ist (siehe
 * lib/anthropic/workspaces.ts).
 *
 * 1. Je Workspace die Agenten laden
 * 2. Einfügen bzw. aktualisieren, mit Workspace-Zugehörigkeit
 * 3. Was nirgends mehr auftaucht: archivieren, nicht löschen
 *
 * Neu angelegte Agenten sind immer `published = false`. Die Freigabe zum
 * Verkauf ist eine bewusste Entscheidung im Admin-Bereich, kein Nebeneffekt
 * eines Syncs.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ message: "Nicht eingeloggt" }, { status: 401 });
  if (!isAdminUser(userId)) return NextResponse.json({ message: "Kein Zugriff — nur Admins." }, { status: 403 });

  const workspaces = konfigurierteWorkspaces();

  if (workspaces.length === 0) {
    return NextResponse.json({
      message: "Kein Workspace konfiguriert. Es fehlt mindestens ANTHROPIC_API_KEY.",
    }, { status: 500 });
  }

  const synced:  { id: string; name: string; workspace: string }[] = [];
  const skipped: string[] = [];
  const errors:  string[] = [];
  const gesehen: string[] = [];
  const erfolgreicheWorkspaces: string[] = [];
  const proWorkspace: Record<string, number> = {};

  for (const ws of workspaces) {
    let liste: Record<string, unknown>[];
    try {
      liste = await agentenLaden(ws.apiKey);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Workspace nicht lesbar → seine Agenten bleiben unangetastet und er
      // zählt nicht als synchronisiert. Sonst würde ein abgelaufener
      // Schlüssel den halben Katalog archivieren.
      errors.push(`Workspace "${ws.name}" nicht lesbar: ${msg}`);
      console.error(`[sync-agents] Workspace ${ws.name}:`, msg);
      continue;
    }

    erfolgreicheWorkspaces.push(ws.name);
    proWorkspace[ws.name] = liste.length;
    console.log(`[sync-agents] ${ws.name}: ${liste.length} Agent(en) geladen`);

    // Kundenkopien und Testagenten überspringen
    const master = liste.filter((agent) => {
      const name = (agent.name ?? agent.display_name ?? "") as string;
      const ueberspringen = / — user_\w+/.test(name) || name.startsWith("TEST_COPY_DELETE_ME");
      if (ueberspringen) skipped.push(`${name} (${ws.name})`);
      return !ueberspringen;
    });

    const fallbackEnvId =
      process.env.ANTHROPIC_ENVIRONMENT_ID ??
      (master[0]?.environment_id as string) ??
      "default";

    for (const agent of master) {
      const agentId   = (agent.id ?? agent.agent_id ?? "") as string;
      const agentName = (agent.name ?? agent.display_name ?? agentId) as string;

      if (!agentId) {
        errors.push(`Agent ohne ID übersprungen (${ws.name})`);
        continue;
      }

      gesehen.push(agentId);

      try {
        await upsertAgent({
          anthropic_agent_id: agentId,
          environment_id:     (agent.environment_id as string) ?? fallbackEnvId,
          name:               agentName,
          slug:               slugify(agentName),
          description:        (agent.description as string) ?? undefined,
          category:
            (agent as Record<string, Record<string, unknown>>).metadata?.category as string ??
            (agent.category as string) ??
            undefined,
          workspace:          ws.name,
        });
        synced.push({ id: agentId, name: agentName, workspace: ws.name });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[sync-agents] ✗ ${agentName}:`, msg);
        errors.push(`${agentName}: ${msg}`);
      }
    }
  }

  // Karteileichen archivieren — nur aus Workspaces, die wir wirklich gelesen
  // haben, plus Altbestand ohne Zuordnung.
  let archiviert: { id: string; name: string; workspace: string | null }[] = [];
  if (erfolgreicheWorkspaces.length > 0) {
    try {
      archiviert = await archiviereVerschwundeneAgenten(gesehen, erfolgreicheWorkspaces);
      archiviert.forEach(a => console.log(`[sync-agents] ↓ archiviert: ${a.name}`));
    } catch (e) {
      errors.push(`Archivierung fehlgeschlagen: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const wsZusammenfassung = Object.entries(proWorkspace)
    .map(([name, n]) => `${name}: ${n}`)
    .join(", ");

  return NextResponse.json({
    message: [
      `${synced.length} Agent(en) synchronisiert (${wsZusammenfassung}).`,
      archiviert.length > 0 ? `${archiviert.length} archiviert (nicht mehr in der Console).` : "",
      skipped.length    > 0 ? `${skipped.length} Kundenkopie(n) übersprungen.` : "",
      errors.length     > 0 ? `${errors.length} Fehler.` : "",
    ].filter(Boolean).join(" "),
    workspaces: erfolgreicheWorkspaces,
    synced,
    archiviert: archiviert.length > 0 ? archiviert : undefined,
    skipped:    skipped.length    > 0 ? skipped    : undefined,
    errors:     errors.length     > 0 ? errors     : undefined,
  });
}
