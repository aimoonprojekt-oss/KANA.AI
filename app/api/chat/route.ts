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

    // Vercel kappt eine Anfrage hart bei maxDuration. Wird sie gekappt, laeuft
    // KEINE Zeile mehr, die hinter der Schleife steht — die Dateien werden nie
    // abgeholt, der Lauf nie abgeschlossen.
    //
    // Genau das ist am 17.08.2026 passiert: Der Lauf dauerte rund sieben
    // Minuten, beide Dateien lagen fertig bei Anthropic, im Chatfenster kam
    // nichts an. Deshalb hoeren wir 20 s vor dem Limit von SELBST auf, holen
    // was da ist und schliessen sauber. Die Session laeuft bei Anthropic
    // weiter — verloren geht nichts, es wird nur nicht mehr zugeschaut.
    const ZEITGRENZE_MS = (maxDuration - 20) * 1000;
    const beginn = Date.now();

    const stream = new ReadableStream({
      async start(controller) {
        let offen = true;
        const sende = (nutzlast: Record<string, unknown>) => {
          if (!offen) return;
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(nutzlast)}\n\n`));
          } catch {
            // Browser hat den Tab geschlossen. Kein Fehler — nur niemand mehr da.
            // Ohne dieses Fangen wuerde der Herzschlag die Funktion abstuerzen
            // lassen und die Dateiabholung mitreissen.
            offen = false;
          }
        };

        // Statuszeile des Chatfensters. Der Herzschlag wiederholt sie mit der
        // verstrichenen Zeit, damit ein langer Modellaufruf nicht wie ein
        // Absturz aussieht. Am 17.08. stand die Anzeige drei Minuten still.
        let status = "startet";
        const verstrichen = () => {
          const s = Math.floor((Date.now() - beginn) / 1000);
          return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
        };
        const herzschlag = setInterval(() => {
          sende({ tool: `${status} · ${verstrichen()}` });
        }, 10_000);

        // Dateiabholung. Wird an mehreren Stellen aufgerufen und darf deshalb
        // unter keinen Umstaenden werfen.
        const dateienSenden = async () => {
          try {
            const liste = await beta.files.list({ scope_id: activeSessionId });
            const dateien = (liste?.data ?? []).map(
              (f: { id: string; filename?: string }) => ({
                id: f.id,
                filename: f.filename ?? f.id,
              })
            );
            if (dateien.length) sende({ files: dateien });
          } catch (fehler) {
            console.warn("Files API:", fehler);
          }
        };

        let abgelaufen = false;

        try {
          const ereignisse = eventStream[Symbol.asyncIterator]();

          while (true) {
            const rest = ZEITGRENZE_MS - (Date.now() - beginn);
            if (rest <= 0) {
              abgelaufen = true;
              break;
            }

            // Auf das naechste Ereignis warten, aber hoechstens bis zur
            // Zeitgrenze — sonst haengt die Schleife im Modellaufruf fest und
            // die Plattform kappt uns mitten darin.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const naechstes: any = await Promise.race([
              ereignisse.next(),
              new Promise((r) => setTimeout(() => r({ __frist: true }), rest)),
            ]);

            if (naechstes?.__frist) {
              abgelaufen = true;
              break;
            }
            if (naechstes?.done) break;

            const event = naechstes.value;

            switch (event.type) {
              // ── Text des Agenten ─────────────────────────────────────────
              case "agent.message.delta":
                if (event.delta?.text) {
                  fullResponse += event.delta.text;
                  sende({ text: event.delta.text });
                }
                break;

              case "agent.message":
                if (Array.isArray(event.content)) {
                  for (const block of event.content) {
                    if (block?.type === "text" && typeof block.text === "string") {
                      fullResponse += block.text;
                      sende({ text: block.text });
                    }
                  }
                }
                break;

              // ── Denkschritte: NUR als Status, niemals im Wortlaut ────────
              // Der Gedankengang des Agenten ist Betriebsgeheimnis.
              // Siehe claude/18_Laufakte_und_Kundenansicht.md, Abschnitt 3.
              case "agent.thinking":
                status = "denkt nach";
                sende({ tool: status });
                break;

              // ── Werkzeuge ────────────────────────────────────────────────
              case "agent.tool_use": {
                const pfad =
                  typeof event.input?.file_path === "string" ? event.input.file_path : "";
                status =
                  event.name === "write" && pfad.startsWith("/mnt/session/outputs/")
                    ? `schreibt ${pfad.split("/").pop()}`
                    : (event.name ?? "arbeitet");
                sende({ tool: status });
                break;
              }

              // ── Unteragenten ─────────────────────────────────────────────
              // Ohne diese vier Faelle ist die gesamte Uebergabe an einen
              // Unteragenten im Chatfenster unsichtbar. Beim Lauf vom 17.08.
              // waren das vier von sieben Minuten Funkstille.
              case "session.thread_status_running":
                status = `${event.agent_name ?? "Unteragent"} uebernimmt`;
                sende({ tool: status });
                break;

              case "agent.thread_message_received":
                status = `${event.agent_name ?? "Unteragent"} hat den Auftrag`;
                sende({ tool: status });
                break;

              case "agent.thread_message_sent":
                status = "Unteragent meldet zurueck";
                sende({ tool: status });
                break;

              case "session.thread_status_idle":
                status = `${event.agent_name ?? "Unteragent"} fertig`;
                sende({ tool: status });
                break;

              default:
                break;
            }

            // Hauptagent fertig — hier und nur hier endet die Schleife regulaer.
            // NICHT bei session.thread_status_idle: das ist ein Unteragent.
            if (event.type === "session.status_idle") break;
          }

          clearInterval(herzschlag);

          // Dateien IMMER holen — auch nach Zeitueberschreitung.
          await dateienSenden();

          if (abgelaufen) {
            sende({
              text:
                `\n\n⏱ Nach ${verstrichen()} wurde die Verbindung geschlossen — ` +
                `das Zeitlimit des Hostings. Der Agent arbeitet bei Anthropic ` +
                `weiter. Alles, was bis hierhin fertig war, steht oben zum ` +
                `Herunterladen bereit.`,
            });
          }

          if (runId) {
            const zusammenfassung = fullResponse.slice(0, 500) || undefined;
            await completeRun(
              runId,
              abgelaufen ? (zusammenfassung ?? "ABGEBROCHEN: Zeitlimit") : zusammenfassung
            );
          }

          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          offen = false;
          controller.close();
        } catch (streamError) {
          clearInterval(herzschlag);
          // Auch im Fehlerfall zuerst die Dateien retten — sie sind das
          // Ergebnis, der Fehler ist nur der Transportweg.
          await dateienSenden();
          if (runId) await completeRun(runId, "ERROR").catch(() => {});
          const msg = streamError instanceof Error ? streamError.message : "Stream-Fehler";
          sende({ error: msg });
          offen = false;
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
