import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import {
  checkAgentAccess,
  saveSession,
  getDBAgentById,
  createRun,
  completeRun,
  sessionGehoertNutzer,
} from "@/lib/platform/supabase";
import { sessionDateienAnhaengen } from "@/lib/agents/sessionRessourcen";
import {
  wissenProjizieren,
  analysenUebernehmen,
  wissenUebernehmen,
  lieferungenUebernehmen,
} from "@/lib/agents/speicherProjektion";
import { anthropicFuerNutzer } from "@/lib/anthropic/mandant";
import { laufzielFuerKunden } from "@/lib/anthropic/kundenkopie";

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

// Modell A: KEIN Client auf Modulebene mehr. Der Schluessel haengt am Kunden,
// nicht am Server — er wird pro Anfrage aus dessen Organisation geholt.
// Siehe lib/anthropic/mandant.ts.

export async function POST(req: NextRequest) {
  // ── 1. Authentifizierung prüfen ────────────────────────────────────────────
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ message: "Nicht eingeloggt" }, { status: 401 });
  }

  // ── 2. Request-Daten auslesen ──────────────────────────────────────────────
  // `kontext` ist optional und trägt die Auftragsparameter, aus denen L2 die
  // Datei auftrag.json baut (Produkt, Anzahl, Format, Grenzwerte). Welcher
  // Agent daraus was macht, steht in lib/agents/sessionRessourcen.ts.
  const { agentId, message, sessionId, kontext } = await req.json();

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

  // Modell A (18.08.2026): Der Kunde arbeitet in SEINEM Workspace, und Agenten
  // sind workspace-gebunden. Gestartet wird deshalb nicht der Master aus dem
  // KANA-Katalog, sondern die Kopie im Workspace des Kunden. Existiert sie noch
  // nicht, wird sie hier angelegt — idempotent, siehe lib/anthropic/kundenkopie.ts.
  //
  // Der frühere Kommentar an dieser Stelle ("keine Kundenkopien mehr",
  // Entscheidung vom 16.08.) galt für Modell B und ist überholt. Er stimmte
  // ohnehin nie mit dem Stripe-Webhook überein, der seit jeher Kopien anlegte.
  if (!agentDef) {
    return NextResponse.json(
      { message: "Agent nicht im Katalog gefunden." },
      { status: 404 }
    );
  }

  // Vaults liefern dem Agent seine Credentials (z.B. APIFY_API_TOKEN für den
  // Researcher). Vault-IDs lassen sich nur beim Anlegen der Session anhängen.
  // Agents ohne Credentials bekommen eine leere Liste.
  //
  // Die Umgebungsvariable ist nur noch ein Notnagel für den Fall, dass an einem
  // Agenten nichts hinterlegt ist — sie gilt für ALLE Agenten und alle Mandanten
  // und ist damit das Gegenteil dessen, was wir wollen.
  const umgebungsListe = (name: string): string[] =>
    process.env[name]?.split(",").map((s) => s.trim()).filter(Boolean) ?? [];

  const vaultIds = agentDef?.vault_ids?.length
    ? agentDef.vault_ids
    : umgebungsListe("ANTHROPIC_VAULT_IDS");

  // Memory-Stores tragen das Kundenwissen. Sie werden als Verzeichnis unter
  // /mnt/memory/<name>/ eingehängt.
  //
  // read_only ist Absicht: Nur der Datenpfleger schreibt hinein, und zwar
  // über das Backend mit Validierung. Ein Agent, der die Wissensbasis eines
  // Mandanten überschreiben kann, ist ein Agent zu viel.
  // Zwei Speicher mit unterschiedlichem Zugriff — die Trennung ist der Grund,
  // warum es zwei sind und nicht einer:
  //
  //   kana-wissen      read_only   Markenwissen, Referenzen, Werkzeuge
  //   kana-ergebnisse  read_write  Analysen und Guides des Laufs
  //
  // Ein Agent, der die Wissensbasis eines Mandanten ueberschreiben kann, ist
  // ein Agent zu viel. Deshalb bekommt er Schreibrecht nur dort, wo seine
  // eigenen Ergebnisse landen. Siehe docs/speicherorte.md.
  const wissensStoreId =
    process.env.ANTHROPIC_WISSENS_STORE_ID ??
    agentDef?.memory_store_ids?.[0] ??
    umgebungsListe("ANTHROPIC_MEMORY_STORE_IDS")[0] ??
    "";
  const ergebnisStoreId = process.env.ANTHROPIC_ERGEBNIS_STORE_ID ?? "";

  // ── 5. Anthropic Managed Agents API aufrufen ───────────────────────────────
  // Modell A: der Client gehoert dem Workspace DIESES Kunden. Wirft, wenn ein
  // Workspace hinterlegt ist, der Schluessel dazu aber fehlt — ein stiller
  // Rueckfall auf KANA waere genau das Datenteilen, das wir vermeiden wollen.
  let mandant;
  try {
    mandant = await anthropicFuerNutzer(userId);
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    console.error("[chat] Mandant nicht aufloesbar:", text);
    return NextResponse.json(
      { message: "Dein Arbeitsbereich ist nicht vollstaendig eingerichtet. Bitte an den Support wenden." },
      { status: 503 }
    );
  }

  // Welcher Agent wird tatsächlich gestartet — Kopie oder (übergangsweise)
  // Master? Und in welcher Umgebung? Beides gehört zusammen: Eine Kopie im
  // Kundenworkspace lässt sich nicht mit der Environment-ID aus dem
  // KANA-Workspace starten.
  let laufziel;
  try {
    laufziel = await laufzielFuerKunden(mandant.organizationId, agentDef);
  } catch (fehler) {
    const text = fehler instanceof Error ? fehler.message : String(fehler);
    console.error("[chat] Kundenkopie nicht bereitstellbar:", text);
    return NextResponse.json(
      { message: "Der Agent konnte in deinem Arbeitsbereich nicht bereitgestellt werden." },
      { status: 503 }
    );
  }

  const activeAgentId = laufziel.agentId;
  const environmentId = laufziel.environmentId;

  // Beta-Felder werden als `any` getypt, da die SDK-TS-Definitionen je nach
  // Version unterschiedlich sind und wir direkt gegen die Laufzeit-API gehen.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const beta = (mandant.client as any).beta;

  // M2: Die sessionId kommt vom Client. Ohne Pruefung koennte man mit einer
  // fremden Session-ID in eine fremde Konversation hineinschreiben und deren
  // Antworten mitlesen. Eine unbekannte oder fremde ID wird abgewiesen statt
  // stillschweigend als "neue Session" behandelt — sonst waere der Fehler
  // fuer den Nutzer unsichtbar.
  if (sessionId && !(await sessionGehoertNutzer(userId, sessionId))) {
    return NextResponse.json(
      { message: "Diese Sitzung gehoert nicht zu deinem Konto." },
      { status: 403 }
    );
  }

  try {
    let activeSessionId: string = sessionId;
    let dbSessionId = "";

    // Neue Session starten wenn noch keine vorhanden
    if (!activeSessionId) {
      // L2: Werkzeugskripte und erzeugte Auftragsdateien in den Container legen.
      // Ohne diesen Schritt findet ein Agent unter /mnt/session/uploads/ nichts
      // vor und bricht ab — belegt im Testlauf vom 17.08.2026.
      // Agenten ohne Dateien bekommen eine leere Liste.
      const dateiRessourcen = await sessionDateienAnhaengen(
        beta,
        agentDef,
        (kontext ?? {}) as Record<string, unknown>
      );

      // Vor der Sitzung: Markenwissen und offene Breakdowns aus Supabase in
      // den Wissensspeicher schreiben. Der Agent hat keinen Datenbankzugang —
      // was er nicht hier vorfindet, sieht er nicht.
      //
      // Ein Fehlschlag bricht den Lauf NICHT ab: der Agent meldet selbst, wenn
      // ihm eine Datei fehlt, und diese Meldung ist fuer den Nutzer
      // verstaendlicher als ein 500er aus dem Backend.
      if (wissensStoreId) {
        try {
          await wissenProjizieren(beta, wissensStoreId, (kontext ?? {}) as Record<string, unknown>);
        } catch (fehler) {
          console.warn("[chat] Projektion fehlgeschlagen:", fehler);
        }
      }

      const memoryRessourcen = [
        ...(wissensStoreId
          ? [{
              type: "memory_store" as const,
              memory_store_id: wissensStoreId,
              access: "read_only" as const,
            }]
          : []),
        ...(ergebnisStoreId
          ? [{
              type: "memory_store" as const,
              memory_store_id: ergebnisStoreId,
              access: "read_write" as const,
            }]
          : []),
      ];

      const ressourcen = [...memoryRessourcen, ...dateiRessourcen];

      const session = await beta.sessions.create({
        agent: activeAgentId,
        environment_id: environmentId,
        ...(vaultIds.length ? { vault_ids: vaultIds } : {}),
        ...(ressourcen.length ? { resources: ressourcen } : {}),
        // Harter Kostendeckel je Lauf, in ganzen CENT als String.
        // Ohne ihn ist eine Endlosschleife im Agenten ein unbegrenztes
        // Kostenrisiko.
        //
        // Gemessene Laeufe Strategy Guide mit 20 Briefs (sonnet-4-6/medium):
        //   17.08. 40 · 61 · 85 · 117 Cent   21.08. 68 Cent
        // Seit 23.08. laeuft der Strategist auf claude-opus-5 mit effort high.
        // Opus 5 kostet rund das 1,7-fache je Token und denkt laenger, der
        // teuerste bekannte Lauf landet damit grob bei 250-300 Cent — genau am
        // alten Deckel. Default deshalb auf 800 angehoben.
        //
        // Beim ersten Lauf auf Opus 5 die tatsaechlichen Kosten aus
        // session.usage.list_cost ablesen und diesen Wert hier nachziehen.
        //
        // OFFEN (18.08.2026): `budget` kommt im SDK-Typ SessionCreateParams
        // (@anthropic-ai/sdk 0.95.2) NICHT vor — die ganze Datei geht ueber
        // einen any-Cast, deshalb faellt das dem Compiler nicht auf. Dass die
        // API das Feld nicht ablehnt, ist belegt (Sessions werden angelegt);
        // dass sie es auch DURCHSETZT, ist es nicht. Vor dem ersten zahlenden
        // Kunden einmal messen: Deckel klein setzen, teuren Lauf starten, sehen
        // ob er abbricht. Bis dahin gilt der Deckel als unbestaetigt.
        budget: {
          type: "limit",
          max_list_cost: {
            amount: process.env.ANTHROPIC_MAX_LIST_COST_CENT ?? "800",
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
        //
        // Frueher wurden hier nur die file_ids ans Chatfenster gemeldet — der
        // Browser kann damit nichts anfangen, er hat keinen API-Schluessel.
        // Jetzt laden wir die Dateien herunter, legen sie mandantengetrennt in
        // Supabase Storage ab und schicken einen signierten Link. Die Files API
        // ist eine Schleuse, kein Ablageort: sie wird danach geleert.
        let dateienGeholt = false;
        const dateienSenden = async () => {
          if (dateienGeholt) return;
          try {
            const lieferungen = await lieferungenUebernehmen(
              beta,
              activeSessionId,
              mandant.organizationId,
              runId || activeSessionId
            );
            if (lieferungen.length) {
              dateienGeholt = true;
              sende({
                files: lieferungen.map((l) => ({
                  filename: l.dateiname,
                  url: l.url,
                  bytes: l.bytes,
                })),
              });
            }
          } catch (fehler) {
            console.warn("Lieferungen:", fehler);
          }
        };

        // Ergebnisse des Analysten aus dem Ergebnisspeicher nach Supabase.
        // Getrennt von den Lieferungen: das eine sind Daten, das andere sind
        // Dateien fuer den Kunden.
        const analysenSichern = async () => {
          if (!ergebnisStoreId) return;
          try {
            await analysenUebernehmen(beta, ergebnisStoreId);
            await wissenUebernehmen(beta, ergebnisStoreId);
          } catch (fehler) {
            console.warn("Ergebnisuebernahme:", fehler);
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
          await analysenSichern();

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
          await analysenSichern();
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
