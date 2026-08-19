"use client";

import { useUser, SignOutButton } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useState, useRef, useEffect, useCallback, Suspense } from "react";
import ResearchAgent from "@/app/components/agents/ResearchAgent";
import BrandExpert from "@/app/components/agents/BrandExpert";
import CreativeStrategist from "@/app/components/agents/CreativeStrategist";
import CreativeAnalyst from "@/app/components/agents/CreativeAnalyst";
import KanaMark, { KanaLogo } from "@/app/components/ui/KanaMark";
import type { DBAgent } from "@/lib/platform/supabase";
import { faktenAus, promptsAus } from "@/lib/chat-inhalte";

type Message = { role: "user" | "assistant"; content: string };
type OutputFile = { id: string; filename: string };

interface Props {
  agentId: string;
  agent: DBAgent | null;
  meineAgents: DBAgent[];
}

/** mm:ss — die Statuszeile soll auf einen Blick sagen, wie lange es laeuft. */
function laufzeit(sekunden: number) {
  const m = Math.floor(sekunden / 60);
  const s = sekunden % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Typkuerzel aus dem Dateinamen — der Entwurf zeigt es als Abzeichen. */
function dateiTyp(name: string) {
  const t = name.split(".").pop();
  return t && t.length <= 4 ? t.toUpperCase() : "DATEI";
}

/* ─── Inline Markdown Parser ─────────────────────────────────────────────── */
function parseInline(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  // Order matters: links before bold/italic so [**text**](url) works
  const regex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`\n]+)`/g;
  let last = 0, k = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[1] !== undefined && m[2] !== undefined)
      // Markdown link [label](url)
      parts.push(
        <a key={k++} href={m[2]} target="_blank" rel="noopener noreferrer" style={{
          color: "var(--dark-accent)", textDecoration: "underline",
          textDecorationColor: "rgba(127,179,168,0.4)",
          fontWeight: 600, wordBreak: "break-all",
        }}>{m[1]}</a>
      );
    else if (m[3] !== undefined)
      parts.push(<strong key={k++} style={{ fontWeight: 700 }}>{m[3]}</strong>);
    else if (m[4] !== undefined)
      parts.push(<em key={k++}>{m[4]}</em>);
    else if (m[5] !== undefined)
      parts.push(
        <code key={k++} style={{
          background: "rgba(233,238,236,0.10)", padding: "1px 6px",
          borderRadius: 0, fontFamily: "var(--font-mono)", fontSize: "0.88em",
        }}>{m[5]}</code>
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function MarkdownMsg({ text }: { text: string }) {
  const nodes: React.ReactNode[] = [];
  const lines = text.split("\n");
  let k = 0, i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Code block
    if (line.trimStart().startsWith("```")) {
      const codeArr: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) codeArr.push(lines[i++]);
      nodes.push(
        <pre key={k++} style={{
          background: "rgba(10,16,15,0.6)", border: "1px solid var(--dark-hairline)",
          borderRadius: 0, padding: "12px 16px", overflowX: "auto",
          margin: "10px 0", fontSize: 12.5,
        }}>
          <code style={{ color: "var(--dark-text)", fontFamily: "var(--font-mono)", whiteSpace: "pre" }}>
            {codeArr.join("\n")}
          </code>
        </pre>
      );
      i++; continue;
    }

    // Headings
    if (line.startsWith("# "))   { nodes.push(<div key={k++} style={{ fontWeight: 800, fontSize: 18, margin: "14px 0 6px" }}>{parseInline(line.slice(2))}</div>);   i++; continue; }
    if (line.startsWith("## "))  { nodes.push(<div key={k++} style={{ fontWeight: 700, fontSize: 16, margin: "12px 0 5px" }}>{parseInline(line.slice(3))}</div>);  i++; continue; }
    if (line.startsWith("### ")) { nodes.push(<div key={k++} style={{ fontWeight: 700, fontSize: 14, margin: "10px 0 4px", opacity: 0.9 }}>{parseInline(line.slice(4))}</div>); i++; continue; }

    // Horizontal rule
    if (line.trim() === "---" || line.trim() === "***") {
      nodes.push(<div key={k++} style={{ height: 1, background: "var(--dark-hairline)", margin: "10px 0" }} />);
      i++; continue;
    }

    // Bullet list
    if (line.startsWith("- ") || line.startsWith("* ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i].startsWith("- ") || lines[i].startsWith("* ")))
        items.push(lines[i++].slice(2));
      nodes.push(
        <ul key={k++} style={{ margin: "6px 0", padding: 0, listStyle: "none" }}>
          {items.map((it, j) => (
            <li key={j} style={{ display: "flex", gap: 8, padding: "2px 0", alignItems: "flex-start" }}>
              <span style={{ color: "var(--dark-accent)", flexShrink: 0, marginTop: 2 }}>•</span>
              <span>{parseInline(it)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list
    if (/^\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\. /.test(lines[i]))
        items.push(lines[i++].replace(/^\d+\. /, ""));
      nodes.push(
        <ol key={k++} style={{ margin: "6px 0", paddingLeft: 20 }}>
          {items.map((it, j) => <li key={j} style={{ padding: "2px 0" }}>{parseInline(it)}</li>)}
        </ol>
      );
      continue;
    }

    // Empty line
    if (line.trim() === "") { nodes.push(<div key={k++} style={{ height: 6 }} />); i++; continue; }

    // Paragraph
    nodes.push(<div key={k++} style={{ lineHeight: 1.65, padding: "1px 0" }}>{parseInline(line)}</div>);
    i++;
  }

  return <>{nodes}</>;
}

/* ─── Chat Page ──────────────────────────────────────────────────────────── */
function ChatPageInner({ agentId, agent, meineAgents }: Props) {
  const { user } = useUser();

  // Custom Research Agent — eigene UI statt Chat
  if (agentId === "custom_creative_researcher") return <ResearchAgent />;
  if (agentId === "custom_brand_expert") return <BrandExpert />;
  if (agentId === "custom_creative_strategist") return <CreativeStrategist />;
  if (agentId === "custom_creative_analyst") return <CreativeAnalyst />;
  const router = useRouter();
  const searchParams = useSearchParams();

  const taskFromUrl    = searchParams.get("task");
  const sessionFromUrl = searchParams.get("session");

  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [isLoading, setIsLoading]     = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [sessionId, setSessionId]     = useState<string | null>(sessionFromUrl);
  const [agentName, setAgentName]     = useState(agent?.name ?? "KANA Agent");
  /* Sekunden seit dem Absenden — traegt die Statuszeile "denkt · 2:14". */
  const [sekunden, setSekunden]       = useState(0);
  const [outputFiles, setOutputFiles] = useState<OutputFile[]>([]);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const hasSentInitial = useRef(false);
  const sendFnRef      = useRef<((msg: string) => Promise<void>) | null>(null);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentTool]);

  /* Verstrichene Zeit waehrend eines Laufs. Ein Agentenlauf dauert Minuten —
     ohne diese Anzeige wirkt er wie abgestuerzt. */
  useEffect(() => {
    if (!isLoading) { setSekunden(0); return; }
    const id = setInterval(() => setSekunden((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  // Load saved messages for resumed session (Fix 5)
  useEffect(() => {
    if (!sessionFromUrl) return;
    try {
      const saved = localStorage.getItem(`chat_${sessionFromUrl}`);
      if (saved) setMessages(JSON.parse(saved));
    } catch { /* ignore */ }
  }, [sessionFromUrl]);

  // Persist messages to localStorage (Fix 5)
  useEffect(() => {
    if (!sessionId || messages.length === 0) return;
    try { localStorage.setItem(`chat_${sessionId}`, JSON.stringify(messages)); } catch { /* ignore */ }
  }, [messages, sessionId]);

  // Core send function
  const sendMessage = useCallback(async (direct?: string) => {
    const text = (direct ?? input).trim();
    if (!text || isLoading) return;
    if (!direct) setInput("");
    setIsLoading(true);
    setCurrentTool(null);

    setMessages(prev => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "" },
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, message: text, sessionId }),
      });
      if (!res.ok) throw new Error((await res.json()).message || "Fehler");

      const newSid = res.headers.get("X-Session-Id");
      if (newSid) setSessionId(prev => prev ?? newSid);
      const name = res.headers.get("X-Agent-Name");
      if (name) setAgentName(name);

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";

      outer: while (true) {
        const { done, value } = await reader.read();

        // Flush remaining buffer on stream end; otherwise append new chunk
        if (done) {
          // Process whatever is left in buf (catches last line without trailing \n)
          if (buf.trim()) {
            const line = buf.trim();
            if (line.startsWith("data: ")) {
              const raw = line.slice(6).trim();
              if (raw !== "[DONE]") {
                try {
                  const ev = JSON.parse(raw);
                  if (ev.text) {
                    setCurrentTool(null);
                    setMessages(prev => {
                      const u = [...prev];
                      u[u.length - 1] = { role: "assistant", content: u[u.length - 1].content + ev.text };
                      return u;
                    });
                  }
                } catch { /* ignore */ }
              }
            }
          }
          break;
        }

        // Strip carriage returns (some proxies use CRLF)
        buf += dec.decode(value, { stream: true }).replace(/\r/g, "");
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";  // save incomplete last line for next chunk

        for (const line of parts) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (raw === "[DONE]") break outer;
          try {
            const ev = JSON.parse(raw);
            if (ev.text) {
              setCurrentTool(null);
              setMessages(prev => {
                const u = [...prev];
                u[u.length - 1] = {
                  role: "assistant",
                  content: u[u.length - 1].content + ev.text,
                };
                return u;
              });
            } else if (ev.tool) {
              // Fix 4: Tool-Use als Status anzeigen, nicht als Chat-Text
              setCurrentTool(ev.tool);
            } else if (ev.files && Array.isArray(ev.files)) {
              // Output-Dateien vom Agent empfangen
              setOutputFiles(prev => [...prev, ...ev.files]);
            } else if (ev.error) {
              setMessages(prev => {
                const u = [...prev];
                u[u.length - 1] = { role: "assistant", content: `❌ ${ev.error}` };
                return u;
              });
              break outer;
            }
          } catch { /* ignore malformed JSON */ }
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      setMessages(prev => {
        const u = [...prev];
        u[u.length - 1] = { role: "assistant", content: `❌ ${msg}` };
        return u;
      });
    } finally {
      setIsLoading(false);
      setCurrentTool(null);
    }
  }, [input, isLoading, agentId, sessionId]);

  // Keep ref current for auto-send
  useEffect(() => { sendFnRef.current = sendMessage; }, [sendMessage]);

  // Fix 1: Auto-send task from URL on mount
  useEffect(() => {
    if (!taskFromUrl || hasSentInitial.current) return;
    hasSentInitial.current = true;
    const t = setTimeout(() => sendFnRef.current?.(taskFromUrl), 400);
    return () => clearTimeout(t);
  }, [taskFromUrl]);

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "?";

  /* Beides kommt aus handbefuellten jsonb-Spalten. Die Umwandlung deutet,
     was sich deuten laesst, und verwirft den Rest — statt die Seite an einer
     unerwarteten Form scheitern zu lassen. */
  const fakten  = faktenAus(agent?.chat_fakten);
  const prompts = promptsAus(agent?.chat_prompts);
  const leer    = messages.length === 0 && !isLoading;

  return (
    <div className="chat">

      {/* ══ Seitenleiste ══ */}
      <aside className="chat-sidebar">
        <div className="chat-sidebar__logo">
          <KanaLogo size={22} fontSize={17} dark />
        </div>

        {/* Der Rueckweg gehoert nach oben, dorthin wo man ihn sucht. */}
        <div className="chat-sidebar__zurueck">
          <Link href="/dashboard" className="btn btn-dark-outline btn-full btn-sm">
            <span className="mono-num" style={{ color: "var(--dark-accent)" }}>←</span>
            Zurück zum Portal
          </Link>
        </div>

        <div className="chat-sidebar__block">
          <span className="mono-sm chat-sidebar__rubrik">{agent?.category ?? "Agents"}</span>
          {meineAgents.map((a) => {
            const aktiv = a.anthropic_agent_id === agentId;
            return (
              <button
                key={a.id}
                type="button"
                className={`chat-agent${aktiv ? " is-active" : ""}`}
                onClick={() => router.push(`/chat/${a.anthropic_agent_id}`)}
              >
                <span className="chat-agent__name">
                  <span className={`chat-agent__dot${aktiv && isLoading ? " is-running" : ""}`} />
                  {a.name}
                </span>
                {aktiv && isLoading && (
                  <span className="mono-num chat-agent__meta">{laufzeit(sekunden)}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="chat-sidebar__block">
          <Link href="/dashboard" className="chat-nav">Alle Abteilungen</Link>
          <Link href="/dashboard" className="chat-nav">Verlauf</Link>
          <Link href="/dashboard" className="chat-nav">Verbrauch</Link>
        </div>

        <div className="chat-sidebar__fuss">
          <span className="chat-avatar">{initials}</span>
          <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span className="chat-nutzer">{user?.firstName ?? "Nutzer"}</span>
            <SignOutButton redirectUrl="/">
              <button type="button" className="chat-abmelden">Abmelden</button>
            </SignOutButton>
          </span>
        </div>
      </aside>

      {/* ══ Hauptbereich ══ */}
      <main className="chat-main">
        <header className="chat-topbar">
          <span className="mono-num chat-brotkrumen">
            <Link href="/dashboard" style={{ color: "var(--dark-accent)" }}>← Portal</Link>
            {agent?.category ? ` / ${agent.category}` : ""} / {agentName}
            {sessionId ? "" : " · neue Sitzung"}
          </span>
          <Link href="/dashboard" className="chat-topbar__link">Verlauf ansehen</Link>
        </header>

        <div className="chat-messages">
          {/* ── Leerer Start: Beschreibung und Startprompts ── */}
          {leer && (
            <div className="chat-start">
              <div className="chat-start__kopf">
                <KanaMark size={62} variant="dark" motion="spin" breathe />
                <div className="chat-start__text">
                  <span className="chat-start__name">{agentName}</span>
                  {agent?.description && <p className="chat-start__desc">{agent.description}</p>}
                  {fakten.length > 0 && (
                    <div className="chat-start__fakten">
                      {fakten.map(([k, v], idx) => (
                        <span key={`${k}-${idx}`} className="chat-fakt">{k}: {v}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {prompts.length > 0 && (
                <div className="chat-start__prompts">
                  <span className="mono-sm" style={{ color: "var(--dark-text-meta)" }}>
                    Womit soll er anfangen?
                  </span>
                  <div className="chat-prompt-raster">
                    {prompts.map((p, idx) => (
                      <button
                        key={`${p.kurz}-${idx}`}
                        type="button"
                        className={`chat-prompt${input === p.text ? " is-active" : ""}`}
                        onClick={() => setInput(p.text)}
                      >
                        <span className="mono-sm chat-prompt__kurz">{p.kurz}</span>
                        <span className="chat-prompt__text">{p.text}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}>
              {msg.role === "assistant" && (
                <span className="chat-bubble__zeichen"><KanaMark size={22} variant="dark" /></span>
              )}
              <div className={`bubble ${msg.role === "user" ? "bubble-user" : "bubble-assistant"}`}>
                {msg.role === "assistant" && !msg.content && isLoading
                  ? <span style={{ color: "var(--dark-text-meta)" }}>…</span>
                  : msg.role === "assistant"
                    ? <MarkdownMsg text={msg.content} />
                    : msg.content}
              </div>
            </div>
          ))}

          {/* ── Statuszeile mit verstrichener Zeit ──
              Bewusst so ausfuehrlich: ein Lauf dauert Minuten, und ohne
              Zeitstand und Hinweis wirkt das Fenster wie eingefroren. */}
          {isLoading && (
            <div className="chat-status">
              <KanaMark size={18} variant="dark" motion="busy" />
              <span className="chat-status__wort">{currentTool ? currentTool : "denkt"}</span>
              <span className="mono-num chat-status__zeit">{laufzeit(sekunden)}</span>
              <span className="chat-status__hinweis">
                Lange Läufe sind normal, du kannst das Fenster schließen.
              </span>
              <span className="chat-status__balken"><span /></span>
            </div>
          )}

          {/* ── Erzeugte Dateien ──
              Das ?session= im Link ist kein Schmuck: ohne den Parameter weist
              /api/files mit 400 ab, und ohne die Pruefung dahinter koennte
              jeder eingeloggte Kunde fremde Dateien laden. Nicht entfernen. */}
          {outputFiles.length > 0 && (
            <div className="chat-dateien">
              <span className="mono-sm" style={{ color: "var(--dark-text-meta)" }}>Erstellte Dateien</span>
              {outputFiles.map((f) => (
                <a
                  key={f.id}
                  href={`/api/files/${f.id}?session=${encodeURIComponent(sessionId ?? "")}`}
                  download={f.filename}
                  className="chat-datei"
                >
                  <span className="chat-datei__typ">{dateiTyp(f.filename)}</span>
                  <span className="chat-datei__name">{f.filename}</span>
                  <span className="chat-datei__laden">Laden</span>
                </a>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ══ Eingabe ══ */}
        <form className="chat-eingabe" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
          <div className="chat-eingabe__feld">
            <textarea
              className="chat-textarea"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
              placeholder={`Nachricht an ${agentName}`}
              rows={2}
              disabled={isLoading}
            />
            <div className="chat-eingabe__fuss">
              <span className="mono-num chat-eingabe__hinweis">
                Umschalt + Enter für Zeilenumbruch
              </span>
              <button type="submit" className="chat-send-btn" disabled={isLoading || !input.trim()}>
                {isLoading ? "Läuft…" : "Senden"}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

/* ─── Suspense Wrapper (required for useSearchParams in Next.js 15) ──────── */
export default function ChatSeite(props: Props) {
  return (
    <Suspense fallback={
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
        height: "100vh", background: "var(--dark-bg)", color: "var(--dark-text-muted)",
      }}>
        <KanaMark size={22} variant="dark" motion="busy" />
        Laden…
      </div>
    }>
      <ChatPageInner {...props} />
    </Suspense>
  );
}
