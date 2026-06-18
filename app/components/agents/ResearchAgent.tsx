"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

const PRODUCTS = [
  "Wimpernserum",
  "Augenbrauenserum",
  "Haarserum",
  "Haaröl",
  "Vitamin Growth Mascara",
  "Wimpernlifting Box",
  "Reines Rosmarinöl",
];

type LogEntry = { type: string; message: string };

export default function ResearchAgent() {
  const router = useRouter();
  const [product, setProduct]   = useState(PRODUCTS[0]);
  const [adCount, setAdCount]   = useState(3);
  const [adType, setAdType]     = useState<"VIDEO" | "IMAGE">("VIDEO");
  const [minImpressions, setMinImpressions] = useState(0);
  const [maxVideoDuration, setMaxVideoDuration] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [startDateMin, setStartDateMin] = useState("");
  const [startDateMax, setStartDateMax] = useState("");
  const [running, setRunning]   = useState(false);
  const [log, setLog]           = useState<LogEntry[]>([]);
  const [done, setDone]         = useState(false);
  const bottomRef               = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [log]);

  async function startResearch() {
    setRunning(true);
    setDone(false);
    setLog([{ type: "start", message: `🔍 Starte Research für ${product}...` }]);

    try {
      const res = await fetch("/api/research/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetProduct: product, adCount, adType, minImpressions, maxVideoDuration, startDateMin: startDateMin || undefined, startDateMax: startDateMax || undefined }),
      });

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;

        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";

        for (const line of parts) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6));
            setLog(prev => [...prev, ev]);
            if (ev.type === "done") setDone(true);
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setLog(prev => [...prev, { type: "error", message: `❌ Fehler: ${String(err)}` }]);
    } finally {
      setRunning(false);
    }
  }

  function getIcon(type: string) {
    if (type === "start")     return "🚀";
    if (type === "progress")  return "💬";
    if (type === "tool")      return "⚙️";
    if (type === "tool_done") return "✅";
    if (type === "tool_error") return "❌";
    if (type === "done")      return "🎉";
    if (type === "error")     return "❌";
    return "•";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg)", color: "var(--text-primary)" }}>

      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12, padding: "16px 20px",
        borderBottom: "1px solid rgba(255,255,255,0.08)", background: "var(--surface)",
      }}>
        <button onClick={() => router.push("/dashboard")}
          style={{ background: "none", border: "none", color: "var(--text2)", fontSize: 20, cursor: "pointer" }}>
          ←
        </button>
        <div style={{ fontSize: 22 }}>🔍</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15 }}>SNL Creative Research Agent</div>
          <div style={{ fontSize: 11, color: running ? "#a78bfa" : "var(--green)" }}>
            {running ? "⏳ Research läuft..." : "Bereit"}
          </div>
        </div>
      </div>

      {/* Formular */}
      <div style={{
        padding: "20px", borderBottom: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(255,255,255,0.02)", display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end",
      }}>
        {/* Produkt */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 180 }}>
          <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>Produkt</label>
          <select value={product} onChange={e => setProduct(e.target.value)} disabled={running}
            style={{
              background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)",
              fontSize: 14, cursor: "pointer",
            }}>
            {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>

        {/* Anzahl */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 120 }}>
          <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>Anzahl Ads</label>
          <select value={adCount} onChange={e => setAdCount(Number(e.target.value))} disabled={running}
            style={{
              background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 14,
            }}>
            {[2, 3, 5, 7, 10].map(n => <option key={n} value={n}>{n} Ads</option>)}
          </select>
        </div>

        {/* Format */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 140 }}>
          <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>Format</label>
          <select value={adType} onChange={e => setAdType(e.target.value as "VIDEO" | "IMAGE")} disabled={running}
            style={{
              background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 14,
            }}>
            <option value="VIDEO">Video-Ads</option>
            <option value="IMAGE">Image-Ads</option>
          </select>
        </div>

        {/* Min. Impressionen */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 160 }}>
          <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>Min. Impressionen</label>
          <select value={minImpressions} onChange={e => setMinImpressions(Number(e.target.value))} disabled={running}
            style={{
              background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 14,
            }}>
            <option value={0}>Keine Grenze</option>
            <option value={10000}>10.000+</option>
            <option value={50000}>50.000+</option>
            <option value={150000}>150.000+</option>
            <option value={300000}>300.000+</option>
          </select>
        </div>

        {/* Max. Videolänge — nur bei VIDEO */}
        {adType === "VIDEO" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 160 }}>
            <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>Max. Videolänge</label>
            <select value={maxVideoDuration} onChange={e => setMaxVideoDuration(Number(e.target.value))} disabled={running}
              style={{
                background: "var(--surface)", border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 14,
              }}>
              <option value={0}>Keine Grenze</option>
              <option value={20}>max. 20 Sek.</option>
              <option value={30}>max. 30 Sek.</option>
              <option value={45}>max. 45 Sek.</option>
              <option value={60}>max. 60 Sek.</option>
              <option value={90}>max. 90 Sek.</option>
            </select>
          </div>
        )}

        {/* Zeitraum-Button */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6, position: "relative" }}>
          <label style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600 }}>Zeitraum</label>
          <button
            onClick={() => setShowDatePicker(v => !v)}
            disabled={running}
            style={{
              background: (startDateMin || startDateMax) ? "rgba(147,51,234,0.2)" : "var(--surface)",
              border: `1px solid ${(startDateMin || startDateMax) ? "rgba(147,51,234,0.6)" : "rgba(255,255,255,0.12)"}`,
              borderRadius: 8, padding: "8px 14px", color: "var(--text-primary)",
              fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            }}>
            📅 {startDateMin && startDateMax
              ? `${startDateMin} – ${startDateMax}`
              : startDateMin
              ? `ab ${startDateMin}`
              : startDateMax
              ? `bis ${startDateMax}`
              : "Alle Zeiträume"}
          </button>

          {showDatePicker && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", left: 0, zIndex: 100,
              background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: 12, padding: 20, minWidth: 300,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>
                📅 Zeitraum auswählen
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>VON</label>
                  <input type="date" value={startDateMin} onChange={e => setStartDateMin(e.target.value)}
                    style={{
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 14,
                      colorScheme: "dark",
                    }} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11, color: "var(--text2)", fontWeight: 600 }}>BIS</label>
                  <input type="date" value={startDateMax} onChange={e => setStartDateMax(e.target.value)}
                    style={{
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8, padding: "8px 12px", color: "var(--text-primary)", fontSize: 14,
                      colorScheme: "dark",
                    }} />
                </div>

                {/* Quick-Select Buttons */}
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 8, fontWeight: 600 }}>SCHNELLAUSWAHL</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {[
                      { label: "Black Friday 2024", from: "2024-11-18", to: "2024-11-30" },
                      { label: "Q4 2024",           from: "2024-10-01", to: "2024-12-31" },
                      { label: "Q1 2025",           from: "2025-01-01", to: "2025-03-31" },
                      { label: "Letzter Monat",     from: new Date(new Date().setMonth(new Date().getMonth()-1, 1)).toISOString().slice(0,10), to: new Date(new Date().setDate(0)).toISOString().slice(0,10) },
                    ].map(({ label, from, to }) => (
                      <button key={label} onClick={() => { setStartDateMin(from); setStartDateMax(to); }}
                        style={{
                          background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                          borderRadius: 6, padding: "5px 10px", color: "var(--text-primary)",
                          fontSize: 12, cursor: "pointer",
                        }}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12 }}>
                  <button onClick={() => { setStartDateMin(""); setStartDateMax(""); setShowDatePicker(false); }}
                    style={{
                      background: "none", border: "1px solid rgba(255,255,255,0.15)",
                      borderRadius: 8, padding: "7px 16px", color: "var(--text2)", fontSize: 13, cursor: "pointer",
                    }}>
                    Zurücksetzen
                  </button>
                  <button onClick={() => setShowDatePicker(false)}
                    style={{
                      background: "linear-gradient(135deg,#9333ea,#1d4ed8)",
                      border: "none", borderRadius: 8, padding: "7px 16px",
                      color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>
                    Übernehmen
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Button */}
        <button onClick={startResearch} disabled={running}
          style={{
            padding: "9px 24px", borderRadius: 8, border: "none", cursor: running ? "not-allowed" : "pointer",
            background: running ? "rgba(167,139,250,0.3)" : "linear-gradient(135deg,#9333ea,#1d4ed8)",
            color: "#fff", fontWeight: 700, fontSize: 14, opacity: running ? 0.7 : 1,
            display: "flex", alignItems: "center", gap: 8,
          }}>
          {running ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Läuft...
            </>
          ) : "▶ Research starten"}
        </button>
      </div>

      {/* Live Log */}
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {log.length === 0 && (
          <div style={{ textAlign: "center", marginTop: 60, color: "var(--text3)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p style={{ fontSize: 15, color: "var(--text2)" }}>Wähle dein Produkt und starte die Research.</p>
            <p style={{ fontSize: 13, marginTop: 6, color: "var(--text3)" }}>Claude sucht automatisch Competitor-Ads und speichert alles in Supabase.</p>
          </div>
        )}

        {log.map((entry, i) => (
          <div key={i} style={{
            display: "flex", gap: 10, alignItems: "flex-start",
            padding: "10px 14px", borderRadius: 10,
            background: entry.type === "tool_error" || entry.type === "error"
              ? "rgba(239,68,68,0.08)"
              : entry.type === "done"
              ? "rgba(34,197,94,0.08)"
              : entry.type === "tool" || entry.type === "tool_done"
              ? "rgba(167,139,250,0.06)"
              : "rgba(255,255,255,0.03)",
            border: `1px solid ${
              entry.type === "tool_error" || entry.type === "error" ? "rgba(239,68,68,0.2)"
              : entry.type === "done" ? "rgba(34,197,94,0.2)"
              : "rgba(255,255,255,0.06)"}`,
          }}>
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{getIcon(entry.type)}</span>
            <span style={{
              fontSize: 13, lineHeight: 1.6, color: "var(--text-primary)",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {entry.message}
            </span>
          </div>
        ))}

        {done && (
          <div style={{
            marginTop: 12, padding: "14px 16px", borderRadius: 10,
            background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)",
            fontSize: 13, color: "#4ade80", fontWeight: 600,
          }}>
            ✅ Research abgeschlossen — die Ergebnisse sind in Supabase unter <code style={{ background: "rgba(0,0,0,0.3)", padding: "1px 6px", borderRadius: 4 }}>ad_research</code> gespeichert.
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
