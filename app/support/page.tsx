"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function SupportPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hallo! Wie kann ich Ihnen heute helfen?" },
  ]);
  const [input, setInput]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

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

      if (!res.ok) throw new Error("Anfrage fehlgeschlagen");

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
                const u = [...prev];
                u[u.length - 1] = {
                  role: "assistant",
                  content: u[u.length - 1].content + parsed.text,
                };
                return u;
              });
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setMessages((prev) => {
        const u = [...prev];
        u[u.length - 1] = {
          role: "assistant",
          content: "Entschuldigung, ich bin gerade nicht erreichbar. Bitte versuche es gleich nochmal.",
        };
        return u;
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)",
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "24px 16px",
      fontFamily: "Inter, sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: 720,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 24,
        display: "flex", flexDirection: "column",
        height: "min(700px, 90vh)",
        backdropFilter: "blur(20px)",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "linear-gradient(135deg,#667eea,#764ba2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20,
          }}>🛍️</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 17 }}>Support</div>
            <div style={{ color: "#48bb78", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#48bb78", display: "inline-block" }} />
              Online · Antwortet sofort
            </div>
          </div>
        </div>

        {/* Nachrichten */}
        <div style={{
          flex: 1, overflowY: "auto", padding: "20px 24px",
          display: "flex", flexDirection: "column", gap: 14,
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "75%",
                padding: "11px 16px",
                borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
                background: msg.role === "user"
                  ? "linear-gradient(135deg,#667eea,#764ba2)"
                  : "rgba(255,255,255,0.08)",
                color: "#fff",
                border: msg.role === "assistant" ? "1px solid rgba(255,255,255,0.1)" : "none",
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
        <div style={{
          padding: "16px 24px",
          borderTop: "1px solid rgba(255,255,255,0.08)",
        }}>
          <form onSubmit={sendMessage} style={{ display: "flex", gap: 10 }}>
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
              placeholder="Ihre Nachricht… (Enter = senden, Shift+Enter = neue Zeile)"
              rows={2}
              disabled={loading}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.15)",
                borderRadius: 14,
                padding: "10px 16px",
                color: "#fff",
                fontSize: 14,
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                padding: "0 20px",
                borderRadius: 14,
                background: loading || !input.trim()
                  ? "rgba(255,255,255,0.1)"
                  : "linear-gradient(135deg,#667eea,#764ba2)",
                color: loading || !input.trim() ? "rgba(255,255,255,0.3)" : "#fff",
                border: "none",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 600,
                transition: "all .2s",
                whiteSpace: "nowrap",
              }}
            >
              {loading ? "…" : "Senden →"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
