import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

// Node-Runtime — Edge würde nach 30s schließen, Managed Agent braucht länger
export const runtime = "nodejs";
export const maxDuration = 300;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const { message, sessionId } = await req.json();

  if (!message) {
    return Response.json({ error: "Nachricht fehlt" }, { status: 400 });
  }

  const agentId     = process.env.SUPPORT_AGENT_ID!;
  const envId       = process.env.ANTHROPIC_ENVIRONMENT_ID!;

  if (!agentId || !envId) {
    return Response.json(
      { error: "SUPPORT_AGENT_ID oder ANTHROPIC_ENVIRONMENT_ID nicht gesetzt" },
      { status: 500 }
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (anthropic as any).beta;

  try {
    // Session anlegen (nur beim ersten Turn)
    let activeSessionId: string = sessionId;
    if (!activeSessionId) {
      const session = await beta.sessions.create({
        agent: agentId,
        environment_id: envId,
        title: `Support — ${new Date().toISOString()}`,
      });
      activeSessionId = session.id;
    }

    // Stream öffnen, dann Nachricht senden (Reihenfolge wichtig!)
    const eventStream = await beta.sessions.events.stream(activeSessionId);
    await beta.sessions.events.send(activeSessionId, {
      events: [{ type: "user.message", content: [{ type: "text", text: message }] }],
    });

    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of eventStream) {
            if (event.type === "agent.message.delta" && event.delta?.text) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
              );
            } else if (event.type === "agent.message" && Array.isArray(event.content)) {
              for (const block of event.content) {
                if (block?.type === "text" && typeof block.text === "string") {
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ text: block.text })}\n\n`)
                  );
                }
              }
            } else if (event.type === "session.status_idle") {
              break;
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Stream-Fehler";
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type":  "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection":    "keep-alive",
        "X-Session-Id":  activeSessionId,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "API-Fehler";
    return Response.json({ error: msg }, { status: 500 });
  }
}
