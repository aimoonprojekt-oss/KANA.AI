"use client";

import { useUser } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";

type Message = { role: "user" | "assistant"; content: string };

export default function ChatPage() {
  const { user } = useUser();
  const { agentId } = useParams<{ agentId: string }>();
  const router = useRouter();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState("KANA Agent");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);

    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, message: userMessage, sessionId }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || "Fehler");
      }

      const newSessionId = response.headers.get("X-Session-Id");
      if (newSessionId) setSessionId(newSessionId);
      const name = response.headers.get("X-Agent-Name");
      if (name) setAgentName(name);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (line.startsWith("data: ")) {
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
            } catch { /* ignore */ }
          }
        }
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = { role: "assistant", content: `❌ ${msg}` };
        return updated;
      });
    } finally {
      setIsLoading(false);
    }
  }

  const initials = user?.firstName
    ? `${user.firstName[0]}${user.lastName?.[0] ?? ""}`.toUpperCase()
    : "?";

  return (
    <div className="chat-wrapper">

      {/* ── Chat Header ── */}
      <div className="chat-header">
        <button onClick={() => router.push("/dashboard")}
          style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer", marginRight: 4 }}>
          ←
        </button>

        {/* KANA Logo Mini */}
        <svg width="28" height="28" viewBox="0 0 34 34" fill="none">
          <defs><linearGradient id="g-chat" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse"><stop offset="0%" stopColor="#9333ea"/><stop offset="100%" stopColor="#1d4ed8"/></linearGradient></defs>
          <rect width="34" height="34" rx="9" fill="url(#g-chat)"/>
          <rect x="9.5" y="8" width="2.8" height="18" rx="1.4" fill="white"/>
          <path d="M12.3 17L22 8.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M12.3 17L22 25.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>

        <div style={{ marginLeft: 4 }}>
          <div style={{ fontWeight: 700, fontSize: 15 }}>{agentName}</div>
          <div style={{ fontSize: 11, color: "var(--green)", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", boxShadow: "0 0 6px var(--green)", display: "inline-block" }} />
            Online · bereit
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

      {/* ── Nachrichten ── */}
      <div className="chat-messages">
        {messages.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 60, color: "var(--text3)" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>💬</div>
            <p style={{ fontSize: 15, color: "var(--text2)" }}>Starte die Konversation mit deinem Agent.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Er ist bereit und wartet auf deine erste Nachricht.</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={msg.role === "user" ? "chat-bubble-user" : "chat-bubble-assistant"}>
            <div className={`bubble ${msg.role === "user" ? "bubble-user" : "bubble-assistant"}`}>
              {msg.content || (isLoading && msg.role === "assistant"
                ? <span style={{ opacity: 0.5, display: "flex", alignItems: "center", gap: 6 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    Denkt nach…
                  </span>
                : ""
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Eingabe ── */}
      <form onSubmit={sendMessage} className="chat-input-bar">
        <textarea
          className="chat-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage(e as unknown as React.FormEvent);
            }
          }}
          placeholder="Schreibe eine Nachricht… (Enter zum Senden, Shift+Enter für neue Zeile)"
          rows={2}
          disabled={isLoading}
        />
        <button
          type="submit"
          className="chat-send-btn"
          disabled={isLoading || !input.trim()}
        >
          {isLoading ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
          ) : "Senden →"}
        </button>
      </form>
    </div>
  );
}
