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
      const { jsPDF } = await import("jspdf");
      const now      = new Date();
      const dateStr  = now.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
      const fileName = `SinsNLashes_Ad-Strategy-Guide_${now.toISOString().slice(0, 10)}.pdf`;

      const doc = new jsPDF({ orientation: "p", unit: "pt", format: "a4" });
      const PW = 595, PH = 842, M = 50, CW = PW - M * 2;

      const dark    = [26, 26, 26] as const;
      const gold    = [201, 169, 110] as const;
      const offwhite= [249, 246, 241] as const;
      const white   = [255, 255, 255] as const;
      const muted   = [120, 120, 120] as const;
      const red     = [139, 0, 0] as const;
      const blue    = [30, 58, 95] as const;
      const green   = [45, 74, 45] as const;

      const fill = (c: readonly [number,number,number]) => doc.setFillColor(c[0], c[1], c[2]);
      const ink  = (c: readonly [number,number,number]) => doc.setTextColor(c[0], c[1], c[2]);
      const rect = (x:number,y:number,w:number,h:number, c: readonly [number,number,number]) => { fill(c); doc.rect(x,y,w,h,"F"); };

      const wrap = (text: string, maxW: number): string[] => {
        const words = text.split(" "); const lines: string[] = []; let cur = "";
        for (const w of words) {
          const t = cur ? cur+" "+w : w;
          if (doc.getTextWidth(t) <= maxW) { cur = t; } else { if (cur) lines.push(cur); cur = w; }
        }
        if (cur) lines.push(cur);
        return lines.length ? lines : [text];
      };

      // ── COVER ──────────────────────────────────────────────────────
      rect(0, 0, PW, PH, dark);
      // Gold accent bars
      rect(0, 0, PW, 8, gold);
      rect(0, PH-8, PW, 8, gold);
      // Gold side bar
      rect(0, 0, 5, PH, gold);

      // Brand name
      doc.setFont("helvetica","bold"); doc.setFontSize(10); ink(gold);
      doc.text("SINS 'N LASHES", PW/2, 80, { align:"center" });

      // Title
      doc.setFontSize(32); ink(white);
      doc.text("Ad Strategy Guide", PW/2, 130, { align:"center" });

      // Subtitle
      doc.setFont("helvetica","normal"); doc.setFontSize(14); ink(gold);
      doc.text(MODE_DESCRIPTIONS[mode], PW/2, 162, { align:"center" });

      // Divider
      rect(M+40, 185, CW-80, 1, gold);

      // Date
      doc.setFontSize(10); ink(muted);
      doc.text(`Erstellt: ${dateStr}  ·  KANA.AI Creative Strategist`, PW/2, 205, { align:"center" });

      // Stage legend
      const stages = [
        { name:"Stage 1 — Aware", col: red },
        { name:"Stage 2 — Product Aware", col: blue },
        { name:"Stage 3 — Solution Aware", col: blue },
        { name:"Stage 4 — Problem Aware", col: green },
        { name:"Stage 5 — Unaware", col: green },
      ];
      let sy = 270;
      doc.setFont("helvetica","bold"); doc.setFontSize(9); ink(gold);
      doc.text("DEPLOYMENT-PHASEN", PW/2, sy-20, { align:"center" });
      for (const s of stages) {
        rect(M+40, sy-10, 10, 10, s.col);
        doc.setFont("helvetica","normal"); doc.setFontSize(9); ink(white);
        doc.text(s.name, M+58, sy, {});
        sy += 22;
      }

      // ── CONTENT PAGES ──────────────────────────────────────────────
      doc.addPage();
      let page = doc.getCurrentPageInfo().pageNumber;
      let y = PH;

      const stageColor = (text: string): readonly [number,number,number] => {
        if (text.includes("STAGE 1")) return red;
        if (text.includes("STAGE 2") || text.includes("STAGE 3")) return blue;
        return green;
      };

      const initPage = () => {
        rect(0, 0, PW, PH, offwhite);
        rect(0, 0, PW, 5, gold);
        rect(0, PH-5, PW, 5, gold);
        rect(0, 0, 4, PH, gold);
        doc.setFont("helvetica","normal"); doc.setFontSize(7.5); ink(muted);
        doc.text(`Sins 'n Lashes · Ad Strategy Guide · ${dateStr}`, PW/2, 22, { align:"center" });
        rect(M, 30, CW, 0.5, gold);
        y = PH - 44;
      };

      const ensureSpace = (needed: number) => {
        if (y - needed < 50) {
          doc.setFontSize(8); ink(muted);
          doc.text(String(page), PW/2, PH-20, { align:"center" });
          page++;
          doc.addPage();
          initPage();
        }
      };

      initPage();

      const lines = reportText.split("\n");
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { y -= 6; continue; }

        // Stage header (─── STAGE)
        if (trimmed.match(/^─{3,}\s+STAGE/i) || trimmed.match(/^─{3,}\s+BRAND/i) || trimmed.match(/^─{3,}\s+SCRIPT/i)) {
          ensureSpace(36);
          const col = trimmed.match(/STAGE/) ? stageColor(trimmed.toUpperCase()) : gold;
          rect(M-10, y-20, CW+20, 30, col);
          doc.setFont("helvetica","bold"); doc.setFontSize(10); ink(white);
          const label = trimmed.replace(/^─+\s*/, "").replace(/\s*─+$/, "").trim();
          doc.text(label, M, y, {});
          y -= 38;
          continue;
        }

        // Title box lines
        if (trimmed.match(/^[╔╗╚╝║]/)) { continue; }

        // Brief header (=== IMAGE / VIDEO CREATIVE BRIEF ===)
        if (trimmed.match(/^===.*BRIEF.*===/)) {
          ensureSpace(28);
          rect(M, y-18, CW, 24, dark);
          doc.setFont("helvetica","bold"); doc.setFontSize(9); ink(gold);
          doc.text(trimmed.replace(/=/g,"").trim(), M+8, y, {});
          y -= 32;
          continue;
        }

        // Section label (BRIEF-ID:, Stage:, etc.)
        if (trimmed.match(/^(BRIEF-ID|Stage|Format|Deployment|STRATEGISCHES|ZIELGRUPPEN|HOOK|KERNBOTSCHAFT|COPY|VISUAL|CTA|LANDING|GUARDRAILS|MARKET|ACT|FORMAT-RICHTUNG)[\s:-]/)) {
          ensureSpace(16);
          const colon = trimmed.indexOf(":");
          if (colon > -1) {
            const label = trimmed.slice(0, colon+1);
            const value = trimmed.slice(colon+1).trim();
            doc.setFont("helvetica","bold"); doc.setFontSize(8.5); ink(dark);
            doc.text(label, M, y, {});
            const lw = doc.getTextWidth(label+" ");
            const wrapped = wrap(value, CW - lw - 2);
            doc.setFont("helvetica","normal"); ink([50,50,50]);
            for (let i = 0; i < wrapped.length; i++) {
              if (i === 0) { doc.text(wrapped[i], M + lw, y, {}); }
              else { ensureSpace(13); y -= 13; doc.text(wrapped[i], M + lw, y, {}); }
            }
          } else {
            doc.setFont("helvetica","bold"); doc.setFontSize(8.5); ink(dark);
            doc.text(trimmed, M, y, {});
          }
          y -= 14;
          continue;
        }

        // Bullet / dash items
        if (trimmed.match(/^[-•·]/)) {
          const content = trimmed.replace(/^[-•·]\s*/, "");
          const wrapped = wrap(content, CW - 14);
          ensureSpace(13 * wrapped.length);
          fill(muted); doc.circle(M+3, y-3, 2, "F");
          doc.setFont("helvetica","normal"); doc.setFontSize(8.5); ink([60,60,60]);
          for (let i = 0; i < wrapped.length; i++) {
            doc.text(wrapped[i], M+10, y - i*13, {});
          }
          y -= 13 * wrapped.length;
          continue;
        }

        // [ ] checklist
        if (trimmed.startsWith("[ ]") || trimmed.startsWith("[x]")) {
          const content = trimmed.slice(3).trim();
          const wrapped = wrap(content, CW - 18);
          ensureSpace(13 * wrapped.length);
          doc.setFont("helvetica","normal"); doc.setFontSize(8.5); ink([60,60,60]);
          doc.text("☐", M, y, {});
          for (let i = 0; i < wrapped.length; i++) {
            doc.text(wrapped[i], M+14, y - i*13, {});
          }
          y -= 13 * wrapped.length;
          continue;
        }

        // Normal text
        const wrapped = wrap(trimmed, CW);
        ensureSpace(12 * wrapped.length);
        doc.setFont("helvetica","normal"); doc.setFontSize(8.5); ink([60,60,60]);
        for (let i = 0; i < wrapped.length; i++) {
          doc.text(wrapped[i], M, y - i*12, {});
        }
        y -= 12 * wrapped.length + 1;
      }

      // Final page number
      doc.setFontSize(8); ink(muted);
      doc.text(String(page), PW/2, PH-20, { align:"center" });

      doc.save(fileName);
    } catch (err) { addLog({ type: "error", message: "PDF: " + String(err), ts: Date.now() }); }
    finally { setPdfLoading(false); }
  }, [reportText, pdfLoading, addLog]);

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
