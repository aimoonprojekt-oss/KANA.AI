import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { checkAgentAccess, getAgentById, saveSession } from "@/lib/supabase";
import { getAgentById as getAgentDef } from "@/lib/agents";

// Anthropic SDK — API Key NUR hier auf dem Server
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
  defaultHeaders: {
    // Beta-Header für Managed Agents (Pflicht!)
    "anthropic-beta": "managed-agents-2026-04-01",
  },
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

  // Agent-Definition laden (Name, etc.)
  const agentDef = getAgentDef(agentId);
  const agentName = agentDef?.name ?? "Agent";

  // ── 4. Anthropic Managed Agents API aufrufen ────────────────
  try {
    let activeSessionId = sessionId;

    // Neue Session starten wenn noch keine vorhanden
    if (!activeSessionId) {
      // @ts-expect-error — Managed Agents Beta API
      const session = await anthropic.beta.managedAgents.sessions.create({
        agent_id: agentId,
      });
      activeSessionId = session.id;

      // Session in Datenbank speichern
      await saveSession(userId, agentId, activeSessionId);
    }

    // Streaming-Response aufsetzen
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Nachricht an die Session schicken und streamen
          // @ts-expect-error — Managed Agents Beta API
          const eventStream = await anthropic.beta.managedAgents.sessions.events.stream(
            activeSessionId,
            { content: message }
          );

          for await (const event of eventStream) {
            // Text-Chunks streamen (SSE Format)
            if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
              const chunk = `data: ${JSON.stringify({ text: event.delta.text })}\n\n`;
              controller.enqueue(encoder.encode(chunk));
            }
          }

          // Stream beenden
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
        // Session ID und Agent-Name für das Frontend mitgeben
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
