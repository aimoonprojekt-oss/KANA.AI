"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function SupportChatWidget() {
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const inputRef   = useRef<HTMLTextAreaElement>(null);

  // Begrüßung beim ersten Öffnen
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{
        role: "assistant",
        content: "Hallo! Wie kann ich Ihnen heute helfen?",
      }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Fehler");
      }

      const newSession = res.headers.get("X-Session-Id");
      if (newSession) setSessionId(newSession);

      const reader  = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const parsed = JSON.parse(data);
            if (parsed.text) {
              setMessages((prev) => {
                const updated = [...prev];
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: updated[updated.length - 1].content + parsed.text,
                };
                return updated;
              });
            }
          } catch { /* ignore parse errors */ }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Entschuldigung, ich bin gerade nicht erreichbar. Bitte versuche es gleich nochmal.",
        };
        return updated;
      });
      console.error("[SupportChat]", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* ── Chat-Fenster ── */}
      {open && (
        <div style={{
          position: "fixed", bottom: 88, right: 24,
          width: 370, maxHeight: 580,
          background: "#fff", borderRadius: 18,
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column",
          zIndex: 9998, overflow: "hidden",
          animation: "supportSlideUp .2s ease",
        }}>
          {/* Header */}
          <div style={{
            background: "linear-gradient(135deg,#1a1a2e,#16213e)",
            color: "#fff", padding: "14px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%",
                background: "rgba(255,255,255,0.15)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 15,
              }}>S</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>Support</div>
                <div style={{ fontSize: 11, opacity: .8, display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#48bb78", display: "inline-block" }} />
                  Online
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{
              background: "none", border: "none", color: "#fff",
              cursor: "pointer", fontSize: 18, opacity: .7, lineHeight: 1,
            }}>✕</button>
          </div>

          {/* Nachrichten */}
          <div style={{
            flex: 1, overflowY: "auto", padding: 14,
            display: "flex", flexDirection: "column", gap: 10,
            background: "#f8f9fa",
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "80%", padding: "9px 14px",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap",
                  background: msg.role === "user" ? "#1a1a2e" : "#fff",
                  color: msg.role === "user" ? "#fff" : "#1a1a2e",
                  boxShadow: msg.role === "assistant" ? "0 1px 4px rgba(0,0,0,0.07)" : "none",
                }}>
                  {msg.content || (loading && msg.role === "assistant"
                    ? <span style={{ opacity: .5 }}>…</span>
                    : "")}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Eingabe */}
          <form onSubmit={sendMessage} style={{
            display: "flex", gap: 8, padding: "10px 12px",
            borderTop: "1px solid #eee", background: "#fff",
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ihre Nachricht… (Enter = senden)"
              rows={1}
              disabled={loading}
              style={{
                flex: 1, border: "1px solid #e2e8f0", borderRadius: 12,
                padding: "8px 12px", fontSize: 13, outline: "none",
                resize: "none", fontFamily: "inherit",
                transition: "border-color .2s",
              }}
            />
            <button type="submit" disabled={loading || !input.trim()} style={{
              width: 38, height: 38, borderRadius: "50%",
              background: loading || !input.trim() ? "#cbd5e0" : "#1a1a2e",
              color: "#fff", border: "none", cursor: loading || !input.trim() ? "not-allowed" : "pointer",
              fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "background .2s",
            }}>➤</button>
          </form>
        </div>
      )}

      {/* ── Bubble-Button ── */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="Support Chat öffnen"
        style={{
          position: "fixed", bottom: 24, right: 24,
          width: 56, height: 56, borderRadius: "50%",
          background: open ? "#e53e3e" : "linear-gradient(135deg,#1a1a2e,#2d3748)",
          color: "#fff", border: "none", cursor: "pointer",
          fontSize: 22, boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
          zIndex: 9999, transition: "transform .2s, background .2s",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        {open ? "✕" : "💬"}
      </button>

      <style>{`
        @keyframes supportSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 420px) {
          /* Wird inline überschrieben — hier nur Ergänzungen */
        }
      `}</style>
    </>
  );
}
