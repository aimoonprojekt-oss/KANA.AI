# Rubriken für Outcomes

Stand 23.08.2026. Die Dateien hier sind fertig, aber **noch nicht scharf
geschaltet** — bewusst, siehe unten.

## Was ein Outcome ist

Ohne Outcome ist eine Session ein Gespräch: der Agent liefert einmal ab, und
ob das Ergebnis stimmt, prüft niemand. Mit Outcome wird sie zu einem Auftrag —
die Plattform lässt einen zweiten, unabhängigen Grader jede Fassung gegen die
Rubrik bewerten und schickt den Agenten mit den konkreten Lücken zurück an die
Arbeit, bis die Rubrik erfüllt ist oder `max_iterations` erreicht sind.

Alle sieben bisherigen Sessions liefen mit `outcome_evaluations: []`. Bei einem
Guide, der 20 Briefs enthalten soll, prüfte bisher nichts, ob es wirklich 20
sind — nur die Selbstauskunft des Agenten am Ende.

## Wie man sie einschaltet

Outcomes sind **kein Feld am Agenten** und keines an `sessions.create`. Sie
werden als Event gesendet. Statt der bisherigen `user.message` in
`app/api/chat/route.ts`:

```ts
await client.beta.sessions.events.send({
  session_id: session.id,
  events: [{
    type: "user.define_outcome",
    description: auftragstext,                    // der bisherige Nachrichtentext
    rubric: { type: "text", content: rubrikText }, // Inhalt der passenden Datei
    max_iterations: 3,
  }],
});
```

Wichtig: **keine zusätzliche `user.message` senden.** Der Agent startet mit
dem Empfang des Outcome-Events. Beides zu senden startet ihn doppelt.

Alternativ die Rubrik einmalig über die Files API hochladen und per
`rubric: { type: "file", file_id }` referenzieren — spart es, den Text bei
jedem Lauf mitzuschicken.

## Warum noch nicht aktiv

Ein Outcome verändert das Kostenprofil grundlegend. `max_iterations` ist
standardmäßig 3, erlaubt bis 20 — jede Iteration ist ein vollständiger
Agentenlauf plus ein Graderlauf. Ein Guide, der heute bei rund 250 Cent liegt,
kann mit drei Iterationen das Dreifache kosten.

Das ist eine Geschäftsentscheidung, keine technische. Vor dem Einschalten:

1. Deckel prüfen — `ANTHROPIC_MAX_LIST_COST_CENT` muss `max_iterations` mal
   den Einzellauf abdecken, sonst bricht die Session mitten in der Schleife ab.
2. Mit `max_iterations: 2` anfangen, nicht mit 3.
3. Einen Lauf beobachten und die `span.outcome_evaluation_end`-Ereignisse
   mitlesen. `result: failed` heisst, dass Rubrik und Auftrag sich
   widersprechen — dann ist die Rubrik falsch, nicht der Agent.

## Dateien

| Datei | Für | Platzhalter |
|---|---|---|
| `strategy-guide.md` | Creative Strategist | `<N>`, `<VERTEILUNG>` aus dem Modus einsetzen |
| `ad-analyse.md` | Creative Analyst | keine |

Die Platzhalter in `strategy-guide.md` müssen vor dem Senden ersetzt werden —
aus derselben Quelle, aus der auch der AUFTRAG kommt (`creative-strategist/modes/`).
Eine Rubrik, die "genau `<N>` Briefs" fordert, ist für den Grader nicht prüfbar.
