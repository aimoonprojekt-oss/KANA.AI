"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type LogEntry = { type: string; message: string; ts: number };

export default function CreativeAnalyst() {
  const router = useRouter();
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [summary, setSummary] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, []);

  const runAgent = useCallback(async () => {
    if (isRunning) return;
    setIsRunning(true); setLogs([]); setSummary(null);
    const collected: string[] = [];
    try {
      const res = await fetch("/api/creative-analyst/run", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: "{}",
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
      const idx = full.indexOf("✅ SNL Creative Analyst");
      if (idx !== -1) setSummary(full.slice(idx));
      else if (full.includes("KEINE_BREAKDOWNS") || full.includes("ALLE_ANALYSIERT")) setSummary(full.slice(full.lastIndexOf("\n\n") + 2) || full);
    } catch (err) { addLog({ type: "error", message: String(err), ts: Date.now() }); }
    finally { setIsRunning(false); }
  }, [isRunning, addLog]);

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

        {/* Ergebnis-Zusammenfassung */}
        {summary && !isRunning && (
          <div style={{ padding:"16px", borderRadius:10, background:"rgba(59,130,246,0.08)", border:"1px solid rgba(59,130,246,0.25)", marginBottom:20 }}>
            <div style={{ fontSize:11, color:"rgba(147,197,253,0.7)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>Ergebnis</div>
            <pre style={{ fontSize:12, color:"rgba(255,255,255,0.85)", whiteSpace:"pre-wrap", wordBreak:"break-word", margin:0, lineHeight:1.6 }}>{summary}</pre>
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
