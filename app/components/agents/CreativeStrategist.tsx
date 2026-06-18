"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type LogEntry = { type: string; message: string; ts: number };

type Mode = "20" | "10" | "2";

const MODE_LABELS: Record<Mode, string> = {
  "20": "20 Briefs",
  "10": "10 Briefs",
  "2":  "2 Briefs",
};

const MODE_DESCRIPTIONS: Record<Mode, string> = {
  "20": "5 Stages · je 2 Image + 2 Video = 20 Briefs",
  "10": "5 Stages · je 1 Image + 1 Video = 10 Briefs",
  "2":  "Stage 1 · 1 Image + 1 Video = 2 Briefs",
};

export default function CreativeStrategist() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [mode, setMode] = useState<Mode>("20");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reportText, setReportText] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, []);

  const runAgent = useCallback(async (selectedMode: Mode) => {
    if (isRunning) return;
    setIsRunning(true); setLogs([]); setReportText(null);
    const collected: string[] = [];
    try {
      const res = await fetch("/api/creative-strategist/run", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: selectedMode }),
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
      const idx = full.indexOf("╔");
      if (idx !== -1) setReportText(full.slice(idx));
    } catch (err) { addLog({ type: "error", message: String(err), ts: Date.now() }); }
    finally { setIsRunning(false); }
  }, [isRunning, addLog]);

  const downloadPDF = useCallback(async () => {
    if (!reportText || pdfLoading) return;
    setPdfLoading(true);
    try {
      const { buildPDF, parseAgentOutput, THEMES } = await import("@/lib/pdf/pdfEngine");
      const now     = new Date();
      const dateStr = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
      const fileName = `SinsNLashes_Ad-Strategy-Guide_${now.toISOString().slice(0, 10)}.pdf`;

      const doc = await buildPDF({
        theme:    THEMES.strategist,
        title:    "Ad Strategy Guide",
        subtitle: MODE_DESCRIPTIONS[mode],
        date:     dateStr,
        sections: parseAgentOutput(reportText),
      });
    } catch (err) { addLog({ type: "error", message: "PDF: " + String(err), ts: Date.now() }); }
    finally { setPdfLoading(false); }
  }, [reportText, pdfLoading, mode, addLog]);

  const logIcon = (t: string) => ({ tool:"🔧", tool_done:"✅", tool_error:"❌", error:"❌", done:"🏁", start:"🎯" }[t] ?? "💬");
  const logColor = (t: string) => t === "error" || t === "tool_error" ? "rgba(239,68,68,0.8)" : t === "done" ? "rgba(201,169,110,0.9)" : t === "start" ? "rgba(201,169,110,0.9)" : t === "tool" ? "rgba(251,191,36,0.8)" : t === "tool_done" ? "rgba(34,197,94,0.8)" : "rgba(255,255,255,0.85)";

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", color:"var(--text-primary)", fontFamily:"system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"16px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => router.push("/dashboard")} style={{ background:"none", border:"none", color:"var(--text2)", fontSize:20, cursor:"pointer" }}>{"←"}</button>
        <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#c9a96e,#8b6914)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{"🎯"}</div>
        <div>
          <div style={{ fontWeight:700, fontSize:15 }}>Creative Strategist — Sins &apos;n Lashes</div>
          <div style={{ fontSize:11, color:isRunning?"var(--accent-bright)":"var(--green)", display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", display:"inline-block", background:isRunning?"var(--accent-bright)":"var(--green)", animation:isRunning?"pulseDot 1s infinite":"none" }} />
            {isRunning ? "Agent arbeitet…" : "Bereit"}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 20px" }}>

        {/* Mode Buttons */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:12 }}>
          {(["20","10","2"] as Mode[]).map(m => (
            <button key={m} onClick={() => { setMode(m); if (!isRunning) runAgent(m); }} disabled={isRunning}
              style={{ padding:"16px 8px", borderRadius:12, fontSize:13, fontWeight:700, cursor:isRunning?"not-allowed":"pointer", border: mode===m && isRunning ? "2px solid #c9a96e" : "2px solid rgba(201,169,110,0.2)", background: mode===m ? (isRunning ? "rgba(255,255,255,0.06)" : "linear-gradient(135deg,#c9a96e,#8b6914)") : "rgba(201,169,110,0.06)", color: mode===m ? (isRunning ? "var(--text3)" : "#1a1a1a") : "#c9a96e", transition:"all 0.15s", display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
              {isRunning && mode === m
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                : <span style={{ fontSize:16 }}>🎯</span>
              }
              <span>{MODE_LABELS[m]}</span>
            </button>
          ))}
        </div>

        {/* Info */}
        <div style={{ padding:"12px 16px", borderRadius:10, background:"rgba(201,169,110,0.06)", border:"1px solid rgba(201,169,110,0.15)", marginBottom:20, fontSize:12, color:"rgba(201,169,110,0.8)", lineHeight:1.6 }}>
          {isRunning ? `Agent arbeitet — ${MODE_DESCRIPTIONS[mode]}…` : `Wähle einen Modus → Agent liest Brand Knowledge + Competitor-Daten · Wendet 5 Stages Framework an · ${MODE_DESCRIPTIONS[mode]} · PDF-Download nach Abschluss`}
        </div>

        {/* PDF Download */}
        {reportText && !isRunning && (
          <button onClick={downloadPDF} disabled={pdfLoading}
            style={{ width:"100%", padding:"12px", borderRadius:10, fontSize:13, fontWeight:600, cursor:pdfLoading?"not-allowed":"pointer", border:"1px solid rgba(201,169,110,0.3)", background:pdfLoading?"rgba(255,255,255,0.03)":"rgba(201,169,110,0.08)", color:pdfLoading?"var(--text3)":"#c9a96e", transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginBottom:20 }}>
            {pdfLoading
              ? (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>PDF wird erstellt…</>)
              : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Strategy Guide als PDF herunterladen</>)}
          </button>
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
                  {[0,1,2].map(d => <span key={d} style={{ width:5, height:5, borderRadius:"50%", background:"#c9a96e", display:"inline-block", animation:"bounceDot 1.2s "+(d*0.2)+"s infinite" }} />)}
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
