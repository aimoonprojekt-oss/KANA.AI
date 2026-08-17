#!/usr/bin/env node
// K1-K6 Scoring — identisch mit lib/agents/creativeAnalyst.ts, Zeilen 185-192.
// Aendert sich die Rubrik, aendert sie sich hier. Nicht im Prompt.

const GEWICHTE = [0.30, 0.20, 0.15, 0.20, 0.10, 0.05]

const KLASSEN = [
  { ab: 4.5, bis: 5.0, name: 'Ausnahme-Ad' },
  { ab: 3.5, bis: 4.4, name: 'Starke Ad' },
  { ab: 2.5, bis: 3.4, name: 'Durchschnittliche Ad' },
  { ab: 1.5, bis: 2.4, name: 'Schwache Ad' },
  { ab: 1.0, bis: 1.4, name: 'Keine Relevanz' },
]

const werte = process.argv.slice(2).map(Number)

if (werte.length !== 6 || werte.some(w => isNaN(w) || w < 1 || w > 5)) {
  console.error('Aufruf: node score.js <K1> <K2> <K3> <K4> <K5> <K6>   (je 1 bis 5)')
  process.exit(1)
}

const score = Math.round(werte.reduce((s, w, i) => s + w * GEWICHTE[i], 0) * 100) / 100
const treffer = KLASSEN.find(k => score >= k.ab && score <= k.bis)

// Randfall: Die Klassengrenzen lassen Luecken (4.4 bis 4.5, 3.4 bis 3.5).
// Ein Score von 4.45 faellt in keine Klasse. Wir geben "Unbekannt" zurueck,
// statt still zu raten. Fachentscheidung nach der Migration.
console.log(JSON.stringify({
  score,
  klasse: treffer ? treffer.name : 'Unbekannt',
}))
