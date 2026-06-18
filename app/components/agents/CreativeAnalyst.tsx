"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";

type LogEntry = { type: string; message: string; ts: number };
type Session = { id: string; product: string; ad_format: string; ad_count: number; created_at: string };

export default function CreativeAnalyst() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const [fullAnalysis, setFullAnalysis] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/research/sessions")
      .then(r => r.json())
      .then(data => { setSessions(Array.isArray(data) ? data : []); setSessionsLoading(false); })
      .catch(() => setSessionsLoading(false));
  }, []);

  const toggleSession = (id: string) => {
    setSelectedSessions(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, []);

  const runAgent = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true); setLogs([]); setSummary(null); setFullAnalysis(null);
    const collected: string[] = [];
    const sessionIds = selectedSessions.size > 0 ? Array.from(selectedSessions) : [];
    try {
      const res = await fetch("/api/creative-analyst/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionIds }),
      });
      if (!res.ok) { const e = await res.json(); addLog({ type: "error", message: e.error ?? "Fehler", ts: Date.now() }); return; }
      const reader = res.body!.getReader();
      const dec = new TextDecoder(); let buf = "";
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        buf += dec.decode(value, { stream: true }).replace(/\r/g, "");
        const parts = buf.split("\n"); buf = parts.pop() ?? "";
        for (const line of parts) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          try {
            const ev = JSON.parse(raw);
            if (ev.type && ev.message) {
              addLog({ type: ev.type, message: ev.message, ts: Date.now() });
              if (ev.type === "progress") collected.push(ev.message);
            }
          } catch { /* ignore */ }
        }
      }
      const full = collected.join("\n");
      setFullAnalysis(full);
      const idx = full.indexOf("✅ SNL Creative Analyst");
      if (idx !== -1) setSummary(full.slice(idx));
      else if (full.includes("KEINE_BREAKDOWNS") || full.includes("ALLE_ANALYSIERT")) setSummary(full.slice(full.lastIndexOf("\n\n") + 2) || full);
    } catch (err) { addLog({ type: "error", message: String(err), ts: Date.now() }); }
    finally { setIsRunning(false); }
  }, [isRunning, addLog, selectedSessions]);

  const downloadPdf = useCallback(async () => {
    if (!fullAnalysis) return;
    try {
      const { buildPDF, parseAgentOutput, THEMES } = await import("@/lib/pdf/pdfEngine");
      const now  = new Date();
      const date = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
      const sessionLabel = selectedSessions.size > 0 ? `_${Array.from(selectedSessions)[0].slice(0, 8)}` : "";
      const doc = await buildPDF({
        theme:    THEMES.analyst,
        title:    "Creative Analyst Report",
        subtitle: `K1-K6 Scoring · Competitor-Analyse · ${date}`,
        date,
        sections: parseAgentOutput(fullAnalysis),
      });
      doc.save(`SNL_Creative_Analyst_${now.toISOString().slice(0, 10)}${sessionLabel}.pdf`);
    } catch (err) { addLog({ type: "error", message: "PDF: " + String(err), ts: Date.now() }); }
  }, [fullAnalysis, selectedSessions, addLog]);

  const logIcon = (t: string) => ({ tool:"🔧", tool_done:"✅", tool_error:"❌", error:"❌", done:"🏁", start:"🔬" }[t] ?? "💬");
  const logColor = (t: string) => t === "error" || t === "tool_error" ? "rgba(239,68,68,0.8)" : t === "done" ? "rgba(96,165,250,0.9)" : t === "start" ? "rgba(96,165,250,0.9)" : t === "tool" ? "rgba(251,191,36,0.8)" : t === "tool_done" ? "rgba(34,197,94,0.8)" : "rgba(255,255,255,0.85)";

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", color:"var(--text-primary)", fontFamily:"system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"16px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => router.push("/dashboard")} style={{ background:"none", border:"none", color:"var(--text2)", fontSize:20, cursor:"pointer" }}>{"←"}</button>
        <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#3b82f6,#1e40af)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{"🔬"}</div>
        <div>
          <div style={{ fontWeight:700, fontSize:15 }}>Creative Analyst — Sins &apos;n Lashes</div>
          <div style={{ fontSize:11, color:isRunning?"var(--accent-bright)":"var(--green)", display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", display:"inline-block", background:isRunning?"var(--accent-bright)":"var(--green)", animation:isRunning?"pulseDot 1s infinite":"none" }} />
            {isRunning ? "Analysiert…" : "Bereit"}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 20px" }}>

        {/* Session-Auswahl */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: "var(--text2)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Research Sessions
            {selectedSessions.size > 0 && (
              <span style={{ marginLeft: 8, background: "rgba(59,130,246,0.3)", color: "#93c5fd", padding: "2px 8px", borderRadius: 20, fontSize: 11 }}>
                {selectedSessions.size} ausgewählt
              </span>
            )}
          </div>

          {sessionsLoading ? (
            <div style={{ fontSize: 13, color: "var(--text3)", padding: "12px 0" }}>Lade Sessions…</div>
          ) : sessions.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text3)", padding: "12px 16px", borderRadius: 10, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              Noch keine Research Sessions vorhanden — starte zuerst den Creative Researcher.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {sessions.map(s => {
                const selected = selectedSessions.has(s.id);
                const date = new Date(s.created_at);
                const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
                const timeStr = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={s.id} onClick={() => !isRunning && toggleSession(s.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "12px 14px",
                      borderRadius: 10, cursor: isRunning ? "not-allowed" : "pointer",
                      background: selected ? "rgba(59,130,246,0.12)" : "rgba(255,255,255,0.03)",
                      border: `1px solid ${selected ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                      transition: "all 0.15s",
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 5, border: `2px solid ${selected ? "#3b82f6" : "rgba(255,255,255,0.2)"}`,
                      background: selected ? "#3b82f6" : "transparent", display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0, fontSize: 11,
                    }}>
                      {selected && "✓"}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{s.product}</div>
                      <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 2 }}>
                        {dateStr} · {timeStr} · {s.ad_format} · {s.ad_count} {s.ad_count === 1 ? "Ad" : "Ads"}
                      </div>
                    </div>
                  </div>
                );
              })}
              {selectedSessions.size === 0 && (
                <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
                  Keine Session ausgewählt → alle unanalysierten Ads werden verarbeitet
                </div>
              )}
            </div>
          )}
        </div>

        {/* Main Button */}
        <button onClick={runAgent} disabled={isRunning}
          style={{ width:"100%", padding:"20px", borderRadius:12, fontSize:15, fontWeight:700, cursor:isRunning?"not-allowed":"pointer", border:"none", background:isRunning?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#3b82f6,#1e40af)", color:isRunning?"var(--text3)":"#fff", transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:12 }}>
          {isRunning
            ? (<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Analyse läuft — bitte warten…</>)
            : (<>🔬 Breakdowns analysieren</>)}
        </button>

        {/* Info */}
        <div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(59,130,246,0.06)", border:"1px solid rgba(59,130,246,0.2)", marginBottom:20, fontSize:12, color:"rgba(147,197,253,0.9)", lineHeight:1.6 }}>
          Liest Competitor-Breakdowns aus der Datenbank · Führt K1-K6 Scoring durch · Analysiert Hook, Copy, Format, Trust, CTA · Speichert Ergebnisse für den Creative Strategist
        </div>

        {/* Ergebnis-Zusammenfassung + PDF-Button */}
        {summary && !isRunning && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ padding:"16px", borderRadius:10, background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.25)", marginBottom:10 }}>
              <div style={{ fontSize:11, color:"rgba(147,197,253,0.7)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>Ergebnis</div>
              <pre style={{ fontSize:12, color:"rgba(255,255,255,0.85)", whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0, lineHeight:1.6 }}>{summary}</pre>
            </div>
            {fullAnalysis && (
              <button onClick={downloadPdf}
                style={{ width:"100%", padding:"14px", borderRadius:10, fontSize:14, fontWeight:700, cursor:"pointer", border:"1px solid rgba(59,130,246,0.4)", background:"rgba(59,130,246,0.12)", color:"#93c5fd", display:"flex", alignItems:"center", justifyContent:"center", gap:8, transition:"all 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(59,130,246,0.22)")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(59,130,246,0.12)")}>
                📄 Analyse als PDF herunterladen
              </button>
            )}
          </div>
        )}

        {/* Live Log */}
        {logs.length > 0 && (
          <div>
            <div style={{ fontSize:11, color:"var(--text3)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>Live-Log</div>
            <div ref={logRef} style={{ background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"12px 14px", maxHeight:500, overflowY:"auto", display:"flex", flexDirection:"column", gap:5 }}>
              {logs.map((log, i) => (
                <div key={i} style={{ display:"flex", gap:7, alignItems:"flex-start", fontSize:12 }}>
                  <span style={{ flexShrink:0, marginTop:1 }}>{logIcon(log.type)}</span>
                  <span style={{ color:logColor(log.type), lineHeight:1.55, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{log.message}</span>
                </div>
              ))}
              {isRunning && (
                <div style={{ display:"flex", gap:4, paddingTop:4, opacity:0.5 }}>
                  {[0,1,2].map(d => <span key={d} style={{ width:5, height:5, borderRadius:"50%", background:"#3b82f6", display:"inline-block", animation:"bounceDot 1.2s "+(d*0.2)+"s infinite" }} />)}
                </div>
              )}
            </div>
          </div>
        )}

      </div>
      <style>{`
        @keyframes pulseDot { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes bounceDot { 0%,60%,100%{transform:translateY(0)} 30%{transform:translateY(-4px)} }
        @keyframes spin { to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
