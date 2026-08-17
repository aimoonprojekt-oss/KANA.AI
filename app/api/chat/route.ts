import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  checkAgentAccess,
  saveSession,
  getDBAgentById,
  createRun,
  completeRun,
} from "@/lib/platform/supabase";

// Managed Agents brauchen pro Request einen langen Lauf — Edge-Runtime
// würde nach ~30s schließen. Daher Node-Runtime.
//
// 300 s ist das HARTE Maximum des Vercel-Hobby-Tarifs und nicht erhöhbar.
// Pro erlaubt 800 s, erweitert bis 1800 s.
// Gemessen am 17.08.2026: Strategy Guide mit 20 Briefs + PDF = 536 s.
// Auf Hobby passt deshalb nur ein kleiner Lauf (Modus 2) in eine Anfrage.
//
// Die eigentliche Lösung ist unabhängig vom Tarif: Starten und Zuhören
// trennen — Lauf starten, sofort antworten, Ende per Webhook. Solange die
// Abholung der Dateien unten im Stream-Handler steht, geht bei einem
// Verbindungsabbruch das Ergebnis verloren, obwohl die Session bei
// Anthropic weiterläuft. Siehe claude/18_Laufakte_und_Kundenansicht.md.
export const runtime = "nodejs";
export const maxDuration = 300;

// Anthropic SDK — API Key NUR hier auf dem Server
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  // ── 1. Authentifizierung prüfen ────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Nicht eingeloggt" }, { status: 401 });
  }

  // ── 2. Request-Daten auslesen ──────────────────────────────────────────────
  const { agentId, message, sessionId } = await req.json();

  if (!agentId || !message) {
    return NextResponse.json({ message: "Fehlende Parameter" }, { status: 400 });
  }

  // ── 3. Berechtigung prüfen (hat der Kunde diesen Agent gekauft?) ───────────
  const hasAccess = await checkAgentAccess(userId, agentId);
  if (!hasAccess) {
    return NextResponse.json(
      { message: "Kein Zugang zu diesem Agent" },
      { status: 403 }
    );
  }

  // ── 4. Agent-Definition laden ──────────────────────────────────────────────
  const agentDef = await getDBAgentById(agentId);
  const agentName = agentDef?.name ?? "Agent";

  // Ein Master-Agent je Produkt, keine Kundenkopien mehr.
  // Entscheidung vom 16.08.2026: Kopien erreichen Verbesserungen am Master
  // nie, und bei 50 Kunden × 6 Agenten wären es 300 Definitionen.
  // Unterschieden wird zur Laufzeit — über Kontext, Vaults und Metadaten.
  const activeAgentId = agentId;

  const environmentId = agentDef?.environment_id ?? process.env.ANTHROPIC_ENVIRONMENT_ID;
  if (!environmentId) {
    return NextResponse.json(
      { message: "ANTHROPIC_ENVIRONMENT_ID nicht gesetzt." },
      { status: 500 }
    );
  }

  // Vaults liefern dem Agent seine Credentials (z.B. SUPABASE_SERVICE_ROLE_KEY
  // für den Brand Expert). Sie lassen sich NUR beim Anlegen der Session
  // anhängen — nachträglich nicht mehr. Agents ohne Credentials (Support,
  // Widget) bekommen eine leere Liste und verhalten sich unverändert.
  const vaultIds =
    (agentDef as { vault_ids?: string[] } | null)?.vault_ids ??
    process.env.ANTHROPIC_VAULT_IDS?.split(",").map((s) => s.trim()).filter(Boolean) ??
    [];

  // Memory-Stores tragen das Kundenwissen. Sie werden als Verzeichnis unter
  // /mnt/memory/<name>/ eingehängt und lassen sich — wie Vaults — NUR beim
  // Anlegen der Session anhängen, nicht nachträglich.
  //
  // read_only ist Absicht: Nur der Datenpfleger schreibt hinein, und zwar
  // über das Backend mit Validierung. Ein Agent, der die Wissensbasis eines
  // Mandanten überschreiben kann, ist ein Agent zu viel.
  const memoryStoreIds =
    (agentDef as { memory_store_ids?: string[] } | null)?.memory_store_ids ??
    process.env.ANTHROPIC_MEMORY_STORE_IDS?.split(",").map((s) => s.trim()).filter(Boolean) ??
    [];

  // ── 5. Anthropic Managed Agents API aufrufen ───────────────────────────────
  // Beta-Felder werden als `any` getypt, da die SDK-TS-Definitionen je nach
  // Version unterschiedlich sind und wir direkt gegen die Laufzeit-API gehen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (anthropic as any).beta;

  try {
    let activeSessionId: string = sessionId;
    let dbSessionId = "";

    // Neue Session starten wenn noch keine vorhanden
    if (!activeSessionId) {
      const session = await beta.sessions.create({
        agent: activeAgentId,
        environment_id: environmentId,
        ...(vaultIds.length ? { vault_ids: vaultIds } : {}),
        ...(memoryStoreIds.length
          ? {
              resources: memoryStoreIds.map((id) => ({
                type: "memory_store",
                memory_store_id: id,
                access: "read_only",
              })),
            }
          : {}),
        // Harter Kostendeckel je Lauf, in ganzen CENT als String.
        // Ohne ihn ist eine Endlosschleife im Agenten ein unbegrenztes
        // Kostenrisiko. Gemessen: ein Strategy Guide mit 20 Briefs = 40 Cent.
        budget: {
          type: "limit",
          max_list_cost: {
            amount: process.env.ANTHROPIC_MAX_LIST_COST_CENT ?? "300",
            currency: "USD",
          },
        },
        // Für die spätere Zuordnung in der Laufakte.
        metadata: { tenant: userId, agent_key: agentId },
        title: `${agentName} — ${userId}`,
      });
      activeSessionId = session.id;

      // Session in Datenbank speichern — gibt die DB-UUID zurück
      dbSessionId = await saveSession(userId, agentId, activeSessionId);
    }

    // Run in DB anlegen (Tracking: wann gestartet, welcher Prompt)
    const runId = dbSessionId
      ? await createRun(dbSessionId, message)
      : "";

    // Streaming aufsetzen: erst den Stream OPEN, dann das User-Event SENDEN.
    // (Reihenfolge ist wichtig — sonst verpasst du die ersten Events.)
    const eventStream = await beta.sessions.events.stream(activeSessionId);

    // User-Nachricht in das laufende Session-Event-Protokoll einspeisen
    await beta.sessions.events.send(activeSessionId, {
      events: [
        {
          type: "user.message",
          content: [{ type: "text", text: message }],
        },
      ],
    });

    const encoder = new TextEncoder();
    let fullResponse = "";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of eventStream) {
            // Agent-Text streamen (kommt als agent.message.delta oder agent.message)
            if (event.type === "agent.message.delta" && event.delta?.text) {
              fullResponse += event.delta.text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            } else if (event.type === "agent.message" && Array.isArray(event.content)) {
              // Volltext-Variante (kein Delta-Stream): Blöcke einzeln rausgeben
              for (const block of event.content) {
                if (block?.type === "text" && typeof block.text === "string") {
                  fullResponse += block.text;
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`)
                  );
                }
              }
            } else if (event.type === "agent.tool_use") {
              // Tool-Name als separates Event senden (kein Text — wird im UI als Status angezeigt)
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ tool: event.name ?? "tool" })}\n\n`)
              );
            } else if (event.type === "session.status_idle") {
              // Agent ist fertig
              break;
            }
          }

          // ── 6. Output-Dateien via Files API abholen ────────────────────
          // Agent schreibt Dateien nach /mnt/session/outputs/ im Container.
          // Nach session.status_idle sind sie über die Files API abrufbar.
          try {
            const fileList = await beta.files.list({ scope_id: activeSessionId });
            if (fileList?.data?.length > 0) {
              const files = fileList.data.map((f: { id: string; filename?: string }) => ({
                id: f.id,
                filename: f.filename ?? f.id,
              }));
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ files })}\n\n`)
              );
            }
          } catch (filesError) {
            // Files API nicht verfügbar oder keine Dateien — kein fataler Fehler
            console.warn("Files API:", filesError);
          }

          // Run als completed markieren
          if (runId) {
            const summary = fullResponse.slice(0, 500) || undefined;
            await completeRun(runId, summary);
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (streamError) {
          // Run als failed markieren wenn möglich
          if (runId) await completeRun(runId, "ERROR").catch(() => {});
          const msg = streamError instanceof Error ? streamError.message : "Stream-Fehler";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          controller.close();
        }
      },
    });

    // Response mit SSE-Headers zurückgeben
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Session-Id": activeSessionId,
        "X-Agent-Name": agentName,
      },
    });
  } catch (error) {
    console.error("Anthropic API Fehler:", error);
    const msg = error instanceof Error ? error.message : "API-Fehler";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
