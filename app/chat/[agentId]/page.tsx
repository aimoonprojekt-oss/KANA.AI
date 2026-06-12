"use client";

import { useUser } from "@clerk/nextjs";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useState, useRef, useEffect, useCallback, Suspense } from "react";
import ResearchAgent from "@/app/components/agents/ResearchAgent";
import BrandExpert from "@/app/components/agents/BrandExpert";

type Message = { role: "user" | "assistant"; content: string };
type OutputFile = { id: string; filename: string };

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
          color: "#a78bfa", textDecoration: "underline",
          textDecorationColor: "rgba(167,139,250,0.4)",
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
          background: "rgba(255,255,255,0.12)", padding: "1px 6px",
          borderRadius: 4, fontFamily: "monospace", fontSize: "0.88em",
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
          background: "rgba(0,0,0,0.4)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8, padding: "12px 16px", overflowX: "auto",
          margin: "10px 0", fontSize: 12.5,
        }}>
          <code style={{ color: "#e2e8f0", fontFamily: "monospace", whiteSpace: "pre" }}>
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
      nodes.push(<div key={k++} style={{ height: 1, background: "rgba(255,255,255,0.12)", margin: "10px 0" }} />);
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
              <span style={{ color: "#a78bfa", flexShrink: 0, marginTop: 2 }}>•</span>
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
function ChatPageInner() {
  const { user } = useUser();
  const { agentId } = useParams<{ agentId: string }>();

  // Custom Research Agent — eigene UI statt Chat
  if (agentId === "custom_creative_researcher") return <ResearchAgent />;
  if (agentId === "custom_brand_expert") return <BrandExpert />;
  const router = useRouter();
  const searchParams = useSearchParams();

  const taskFromUrl    = searchParams.get("task");
  const sessionFromUrl = searchParams.get("session");

  const [messages, setMessages]       = useState<Message[]>([]);
  const [input, setInput]             = useState("");
  const [isLoading, setIsLoading]     = useState(false);
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [sessionId, setSessionId]     = useState<string | null>(sessionFromUrl);
  const [agentName, setAgentName]     = useState("KANA Agent");
  const [outputFiles, setOutputFiles] = useState<OutputFile[]>([]);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const hasSentInitial = useRef(false);
  const sendFnRef      = useRef<((msg: string) => Promise<void>) | null>(null);

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentTool]);

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

  return (
    <div className="chat-wrapper">

      {/* ── Header (Fix 3: Ladeindikator) ── */}
      <div className="chat-header">
        <button
          onClick={() => router.push("/dashboard")}
          style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer", marginRight: 4 }}
        >←</button>

        <svg width="28" height="28" viewBox="0 0 34 34" fill="none">
          <defs>
            <linearGradient id="g-chat" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#9333ea"/>
              <stop offset="100%" stopColor="#1d4ed8"/>
            </linearGradient>
          </defs>
          <rect width="34" height="34" rx="9" fill="url(#g-chat)"/>
          <rect x="9.5" y="8" width="2.8" height="18" rx="1.4" fill="white"/>
          <path d="M12.3 17L22 8.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M12.3 17L22 25.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>

        <div style={{ marginLeft: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{agentName}</div>
          <div style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4,
            color: isLoading ? "var(--accent-bright)" : "var(--green)" }}>
            {isLoading ? (
              <>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--accent-bright)",
                  display: "inline-block", animation: "pulseDot 1s infinite",
                }} />
                {currentTool ? `Tool: ${currentTool}` : "Arbeitet…"}
              </>
            ) : (
              <>
                <span style={{
                  width: 6, height: 6, borderRadius: "50%",
                  background: "var(--green)", boxShadow: "0 0 6px var(--green)",
                  display: "inline-block",
                }} />
                Online · bereit
              </>
            )}
          </div>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "linear-gradient(135deg,#9333ea,#1d4ed8)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, fontWeight: 700, color: "#fff",
          }}>{initials}</div>
          <span style={{ fontSize: 13, color: "var(--text2)" }}>{user?.firstName}</span>
        </div>
      </div>

      {/* ── Nachrichten (Fix 2: Markdown, Fix 3: Loading-Dots) ── */}
      <div className="chat-messages">
        {messages.length === 0 && !isLoading && (
          <div style={{ textAlign: "center", marginTop: 60, color: "var(--text3)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <p style={{ fontSize: 15, color: "var(--text2)" }}>Starte die Konversation mit deinem Agent.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Er ist bereit und wartet auf deine erste Nachricht.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}>
            <div className={`bubble ${msg.role === "user" ? "bubble-user" : "bubble-assistant"}`}>
              {msg.role === "assistant" && !msg.content && isLoading ? (
                // Fix 3: Animierte Dots während Agent nachdenkt
                <span style={{ opacity: 0.6, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ display: "flex", gap: 4 }}>
                    {[0, 1, 2].map(d => (
                      <span key={d} style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "currentColor", display: "inline-block",
                        animation: `bounceDot 1.2s ${d * 0.2}s infinite`,
                      }} />
                    ))}
                  </span>
                  Denkt nach…
                </span>
              ) : msg.role === "assistant" ? (
                // Fix 2: Markdown rendern
                <MarkdownMsg text={msg.content} />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {/* Fix 3 + Fix 4: Tool-Use Status (sichtbar während Agent Tools nutzt) */}
        {isLoading && currentTool && (
          <div style={{ display: "flex", justifyContent: "flex-start", padding: "4px 16px 8px" }}>
            <div style={{
              fontSize: 11, color: "var(--text3)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 20, padding: "4px 12px",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              {currentTool}
            </div>
          </div>
        )}

        {/* ── Output-Dateien vom Agent ── */}
        {outputFiles.length > 0 && (
          <div style={{ padding: "8px 16px 12px" }}>
            <div style={{
              background: "rgba(99,102,241,0.08)",
              border: "1px solid rgba(99,102,241,0.25)",
              borderRadius: 12, padding: "14px 16px",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent-bright)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                Erstellte Dateien
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {outputFiles.map(f => (
                  <a key={f.id}
                    href={`/api/files/${f.id}`}
                    download={f.filename}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", borderRadius: 8,
                      background: "rgba(99,102,241,0.12)",
                      border: "1px solid rgba(99,102,241,0.2)",
                      color: "var(--text-primary)", textDecoration: "none",
                      fontSize: 13, fontWeight: 600,
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(99,102,241,0.22)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "rgba(99,102,241,0.12)")}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-bright)" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="7 10 12 15 17 10"/>
                      <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.filename}</span>
                    <span style={{ fontSize: 11, color: "var(--accent-bright)", fontWeight: 700, flexShrink: 0 }}>↓ Download</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Eingabe ── */}
      <form
        onSubmit={e => { e.preventDefault(); sendMessage(); }}
        className="chat-input-bar"
      >
        <textarea
          className="chat-textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Schreibe eine Nachricht… (Enter = Senden, Shift+Enter = neue Zeile)"
          rows={2}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
              style={{ animation: "spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
          ) : "Senden →"}
        </button>
      </form>

      <style>{`
        @keyframes bounceDot {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}

/* ─── Suspense Wrapper (required for useSearchParams in Next.js 15) ──────── */
export default function ChatPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "var(--text2)" }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
          style={{ animation: "spin 1s linear infinite", marginRight: 10 }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Laden…
      </div>
    }>
      <ChatPageInner />
    </Suspense>
  );
}
