import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkAgentAccess, saveSession } from "@/lib/supabase";
import { getAgentById as getAgentDef } from "@/lib/agents";

// Managed Agents brauchen pro Request einen langen Lauf — Edge-Runtime
// würde nach ~30s schließen. Daher Node-Runtime + max. Laufzeit hochsetzen.
export const runtime = "nodejs";
export const maxDuration = 300;

// Anthropic SDK — API Key NUR hier auf dem Server
// Ab v0.86.0 setzt der SDK den Beta-Header für Managed Agents automatisch.
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

export async function POST(req: NextRequest) {
  // ── 1. Authentifizierung prüfen ─────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Nicht eingeloggt" }, { status: 401 });
  }

  // ── 2. Request-Daten auslesen ───────────────────────────────
  const { agentId, message, sessionId } = await req.json();

  if (!agentId || !message) {
    return NextResponse.json({ message: "Fehlende Parameter" }, { status: 400 });
  }

  // ── 3. Berechtigung prüfen (hat der Kunde diesen Agent gekauft?) ──
  const hasAccess = await checkAgentAccess(userId, agentId);
  if (!hasAccess) {
    return NextResponse.json(
      { message: "Kein Zugang zu diesem Agent" },
      { status: 403 }
    );
  }

  // Environment-ID aus den Env Vars (in Vercel hinterlegen!)
  const environmentId = process.env.ANTHROPIC_ENVIRONMENT_ID;
  if (!environmentId) {
    return NextResponse.json(
      { message: "ANTHROPIC_ENVIRONMENT_ID nicht gesetzt." },
      { status: 500 }
    );
  }

  // Agent-Definition laden (Name, etc.)
  const agentDef = getAgentDef(agentId);
  const agentName = agentDef?.name ?? "Agent";

  // ── 4. Anthropic Managed Agents API aufrufen ────────────────
  // Ein Anthropic-SDK-Client wird hier als `any` getypt, weil die Beta-
  // Felder (.beta.sessions.*) je nach SDK-Version unterschiedlich getypt
  // sind und wir gegen die Laufzeit-API gehen, nicht gegen die TS-Defs.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (anthropic as any).beta;

  try {
    let activeSessionId: string = sessionId;

    // Neue Session starten wenn noch keine vorhanden
    if (!activeSessionId) {
      const session = await beta.sessions.create({
        agent: agentId,
        environment_id: environmentId,
        title: `${agentName} — ${userId}`,
      });
      activeSessionId = session.id;

      // Session in Datenbank speichern
      await saveSession(userId, agentId, activeSessionId);
    }

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
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of eventStream) {
            // Agent-Text streamen (kommt als agent.message.delta oder agent.message)
            if (event.type === "agent.message.delta" && event.delta?.text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            } else if (event.type === "agent.message" && Array.isArray(event.content)) {
              // Volltext-Variante (kein Delta-Stream): Blöcke einzeln rausgeben
              for (const block of event.content) {
                if (block?.type === "text" && typeof block.text === "string") {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`)
                  );
                }
              }
            } else if (event.type === "agent.tool_use") {
              // Optional: Tool-Aktivität fürs UI sichtbar machen
              const note = `\n[Tool: ${event.name ?? "unknown"}]\n`;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: note })}\n\n`)
              );
            } else if (event.type === "session.status_idle") {
              // Agent ist fertig
              break;
            }
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (streamError) {
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
