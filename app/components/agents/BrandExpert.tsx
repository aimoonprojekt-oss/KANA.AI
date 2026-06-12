"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

type LogEntry = { type: string; message: string; ts: number };

export default function BrandExpert() {
  const router = useRouter();
  const [mode, setMode] = useState("brand-setup");
  const [inputText, setInputText] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reportText, setReportText] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  const needsInput = mode === "brand-check" || mode === "brand-update";
  const isMainMode = mode === "brand-setup" || mode === "weekly-update";

  const addLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev, entry]);
    setTimeout(() => logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }), 50);
  }, []);

  const runAgent = useCallback(async () => {
    if (isRunning || (needsInput && !inputText.trim())) return;
    setIsRunning(true); setLogs([]); setReportText(null);
    const collected: string[] = [];
    try {
      const res = await fetch("/api/brand-expert/run", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, input: inputText.trim() || undefined }),
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
          const raw = line.slice(6).trim(); if (raw === "[DONE]") break;
          try {
            const ev = JSON.parse(raw);
            if (ev.type && ev.message) {
              addLog({ type: ev.type, message: ev.message, ts: Date.now() });
              if (ev.type === "progress") collected.push(ev.message);
            }
          } catch { /* ignore */ }
        }
      }
      if (isMainMode) {
        const full = collected.join("\n");
        const idx = full.indexOf("╔");
        if (idx !== -1) setReportText(full.slice(idx));
      }
    } catch (err) { addLog({ type: "error", message: String(err), ts: Date.now() }); }
    finally { setIsRunning(false); }
  }, [mode, inputText, isRunning, needsInput, isMainMode, addLog]);

  const downloadPDF = useCallback(async () => {
    if (!reportText || pdfLoading) return;
    setPdfLoading(true);
    try {
      const res = await fetch("/api/brand-expert/pdf", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportText, reportDate: new Date().toISOString(), mode }),
      });
      if (!res.ok) throw new Error("PDF-Fehler: " + res.status);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const prefix = mode === "brand-setup" ? "Brand_Setup_Report" : "Brand_Weekly_Update";
      a.download = prefix + "_" + new Date().toISOString().slice(0, 10) + ".pdf";
      a.click(); URL.revokeObjectURL(url);
    } catch (err) { addLog({ type: "error", message: "PDF: " + String(err), ts: Date.now() }); }
    finally { setPdfLoading(false); }
  }, [reportText, pdfLoading, mode, addLog]);

  const logIcon = (t: string) => ({ tool:"🔧", tool_done:"✅", tool_error:"❌", error:"❌", done:"🏁", start:"🚀" }[t] ?? "💬");
  const logColor = (t: string) => t === "error" || t === "tool_error" ? "rgba(239,68,68,0.8)" : t === "done" ? "rgba(34,197,94,0.9)" : t === "start" ? "rgba(167,139,250,0.9)" : t === "tool" ? "rgba(251,191,36,0.8)" : t === "tool_done" ? "rgba(34,197,94,0.8)" : "rgba(255,255,255,0.85)";
  const canStart = !isRunning && (!needsInput || !!inputText.trim());

  const btnLabel = mode === "brand-setup" ? "🚀 Brand Setup starten" : mode === "weekly-update" ? "🔄 Weekly Update starten" : mode === "brand-check" ? "✅ Brand Check starten" : "💾 Brand Update starten";

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", color:"var(--text-primary)", fontFamily:"system-ui,sans-serif" }}>

      {/* Header */}
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.08)", padding:"16px 20px", display:"flex", alignItems:"center", gap:12 }}>
        <button onClick={() => router.push("/dashboard")} style={{ background:"none", border:"none", color:"var(--text2)", fontSize:20, cursor:"pointer" }}>{"←"}</button>
        <div style={{ width:36, height:36, borderRadius:10, background:"linear-gradient(135deg,#9333ea,#ec4899)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{"💅"}</div>
        <div>
          <div style={{ fontWeight:700, fontSize:15 }}>Brand Expert — Sins &apos;n Lashes</div>
          <div style={{ fontSize:11, color:isRunning?"var(--accent-bright)":"var(--green)", display:"flex", alignItems:"center", gap:4 }}>
            <span style={{ width:6, height:6, borderRadius:"50%", display:"inline-block", background:isRunning?"var(--accent-bright)":"var(--green)", boxShadow:isRunning?"none":"0 0 6px var(--green)", animation:isRunning?"pulseDot 1s infinite":"none" }} />
            {isRunning ? "Agent arbeitet…" : "Bereit"}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"24px 20px" }}>

        {/* Haupt-Buttons: Brand Setup + Weekly Update */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:12 }}>

          {/* Brand Setup */}
          <button onClick={() => { setMode("brand-setup"); setInputText(""); }} disabled={isRunning}
            style={{ textAlign:"left", padding:"16px", borderRadius:12, cursor:"pointer", border:mode==="brand-setup"?"1px solid rgba(147,51,234,0.6)":"1px solid rgba(255,255,255,0.08)", background:mode==="brand-setup"?"linear-gradient(135deg,rgba(147,51,234,0.15),rgba(236,72,153,0.08))":"rgba(255,255,255,0.03)", color:"var(--text-primary)", transition:"all 0.15s", opacity:isRunning?0.5:1 }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{"🚀"}</div>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>Brand Setup</div>
            <div style={{ fontSize:10, color:"var(--text3)", lineHeight:1.5 }}>Einmalig · Von 0 auf 100 · Komplette Wissensbasis aufbauen</div>
            {mode==="brand-setup" && <div style={{ marginTop:6, width:20, height:2, background:"#9333ea", borderRadius:1 }} />}
          </button>

          {/* Weekly Update */}
          <button onClick={() => { setMode("weekly-update"); setInputText(""); }} disabled={isRunning}
            style={{ textAlign:"left", padding:"16px", borderRadius:12, cursor:"pointer", border:mode==="weekly-update"?"1px solid rgba(34,197,94,0.5)":"1px solid rgba(255,255,255,0.08)", background:mode==="weekly-update"?"rgba(34,197,94,0.08)":"rgba(255,255,255,0.03)", color:"var(--text-primary)", transition:"all 0.15s", opacity:isRunning?0.5:1 }}>
            <div style={{ fontSize:22, marginBottom:6 }}>{"🔄"}</div>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>Weekly Update</div>
            <div style={{ fontSize:10, color:"var(--text3)", lineHeight:1.5 }}>Jede Woche · Änderungen werden im PDF markiert</div>
            {mode==="weekly-update" && <div style={{ marginTop:6, width:20, height:2, background:"#22c55e", borderRadius:1 }} />}
          </button>

        </div>

        {/* Legende für Weekly Update */}
        {mode === "weekly-update" && (
          <div style={{ display:"flex", gap:12, marginBottom:14, padding:"8px 12px", borderRadius:8, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}>
              <span style={{ background:"#14532d", color:"#22c55e", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:3 }}>NEU</span>
              <span style={{ color:"var(--text3)" }}>Neu seit letztem Update</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11 }}>
              <span style={{ background:"#431407", color:"#f97316", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:3 }}>GEÄNDERT</span>
              <span style={{ color:"var(--text3)" }}>Geänderter Wert</span>
            </div>
          </div>
        )}

        {/* Sekundäre Tools */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
          {[
            { v:"brand-check",  label:"✅ Brand Check",  desc:"Prüft ob Text/Claim on-brand ist", ph:"z.B. \"Klinisch bewiesen in 7 Tagen\"" },
            { v:"brand-update", label:"💾 Brand Update", desc:"Neue Info in die Datenbank speichern", ph:"z.B. Neues Produkt: Lash Serum XL €49,99" },
          ].map(m => (
            <button key={m.v} onClick={() => { setMode(m.v); setInputText(""); }} disabled={isRunning}
              style={{ textAlign:"left", padding:"10px 12px", borderRadius:9, cursor:"pointer", border:mode===m.v?"1px solid rgba(167,139,250,0.4)":"1px solid rgba(255,255,255,0.07)", background:mode===m.v?"rgba(167,139,250,0.07)":"rgba(255,255,255,0.02)", color:"var(--text-primary)", transition:"all 0.15s", opacity:isRunning?0.5:1 }}>
              <div style={{ fontWeight:600, fontSize:12, marginBottom:2 }}>{m.label}</div>
              <div style={{ fontSize:10, color:"var(--text3)", lineHeight:1.4 }}>{m.desc}</div>
            </button>
          ))}
        </div>

        {/* Text-Input */}
        {needsInput && (
          <div style={{ marginBottom:16 }}>
            <textarea value={inputText} onChange={e => setInputText(e.target.value)}
              placeholder={mode === "brand-check" ? "z.B. \"Klinisch bewiesen in 7 Tagen\"" : "z.B. Neues Produkt: Lash Serum XL €49,99 ab 15. Juni"}
              disabled={isRunning} rows={3}
              style={{ width:"100%", padding:"12px 14px", borderRadius:10, resize:"vertical", border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.04)", color:"var(--text-primary)", fontSize:14, outline:"none", fontFamily:"system-ui,sans-serif" }} />
          </div>
        )}

        {/* Start */}
        <button onClick={runAgent} disabled={!canStart}
          style={{ width:"100%", padding:"14px", borderRadius:10, fontSize:14, fontWeight:700, cursor:canStart?"pointer":"not-allowed", border:"none", background:canStart ? (mode==="weekly-update"?"linear-gradient(135deg,#16a34a,#15803d)":"linear-gradient(135deg,#9333ea,#ec4899)") : "rgba(255,255,255,0.06)", color:canStart?"#fff":"var(--text3)", transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
          {isRunning ? (<><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>Agent arbeitet — bitte warten…</>) : btnLabel}
        </button>

        {/* PDF-Download nach abgeschlossenem Report */}
        {reportText && !isRunning && (
          <button onClick={downloadPDF} disabled={pdfLoading}
            style={{ width:"100%", padding:"12px", borderRadius:10, fontSize:13, fontWeight:600, cursor:pdfLoading?"not-allowed":"pointer", border:"1px solid rgba(34,197,94,0.3)", background:pdfLoading?"rgba(255,255,255,0.03)":"rgba(34,197,94,0.07)", color:pdfLoading?"var(--text3)":"#22c55e", transition:"all 0.15s", display:"flex", alignItems:"center", justifyContent:"center", gap:8, marginTop:10 }}>
            {pdfLoading ? (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation:"spin 1s linear infinite" }}><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>PDF wird erstellt…</>) : (<><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Report als PDF herunterladen</>)}
          </button>
        )}

        {/* Live-Log */}
        {logs.length > 0 && (
          <div style={{ marginTop:24 }}>
            <div style={{ fontSize:11, color:"var(--text3)", marginBottom:8, textTransform:"uppercase", letterSpacing:"0.08em" }}>Live-Log</div>
            <div ref={logRef} style={{ background:"rgba(0,0,0,0.35)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"12px 14px", maxHeight:460, overflowY:"auto", display:"flex", flexDirection:"column", gap:5 }}>
              {logs.map((log, i) => (
                <div key={i} style={{ display:"flex", gap:7, alignItems:"flex-start", fontSize:12 }}>
                  <span style={{ flexShrink:0, marginTop:1 }}>{logIcon(log.type)}</span>
                  <span style={{ color:logColor(log.type), lineHeight:1.55, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{log.message}</span>
                </div>
              ))}
              {isRunning && (
                <div style={{ display:"flex", gap:4, paddingTop:4, opacity:0.5 }}>
                  {[0,1,2].map(d => <span key={d} style={{ width:5, height:5, borderRadius:"50%", background:"var(--accent-bright)", display:"inline-block", animation:"bounceDot 1.2s "+(d*0.2)+"s infinite" }} />)}
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
        textarea:focus { border-color:rgba(167,139,250,0.4)!important; }
      `}</style>
    </div>
  );
}
