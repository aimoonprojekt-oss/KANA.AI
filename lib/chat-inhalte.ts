/* Fakten und Startprompts aus den jsonb-Spalten lesen.

   Die beiden Spalten werden von Hand befuellt. jsonb nimmt alles an, und
   frueher oder spaeter steht dort eine andere Form als gedacht — ein Objekt
   statt einer Liste, ein Feldname anders geschrieben, ein blosser String.
   Vorher hat der Chat in dem Fall die ganze Seite mit
   "chat_fakten.map is not a function" abgeraeumt.

   Deshalb hier: alles annehmen, was sich sinnvoll deuten laesst, und alles
   uebrige still verwerfen. Ein leerer Block ist ein akzeptabler Anblick,
   eine weisse Fehlerseite nicht. */

function istText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

/** Erwartet [["Liefert","…"], …]. Nimmt auch {"Liefert":"…"} und
    [{"k":"Liefert","v":"…"}] bzw. {schluessel,wert} entgegen. */
export function faktenAus(roh: unknown): [string, string][] {
  if (!roh) return [];

  // Objektform: { "Liefert": "…", "Braucht": "…" }
  if (typeof roh === "object" && !Array.isArray(roh)) {
    return Object.entries(roh as Record<string, unknown>)
      .filter(([k, v]) => istText(k) && istText(v))
      .map(([k, v]) => [k, v as string]);
  }

  if (!Array.isArray(roh)) return [];

  return roh.flatMap((eintrag): [string, string][] => {
    if (Array.isArray(eintrag) && istText(eintrag[0]) && istText(eintrag[1])) {
      return [[eintrag[0], eintrag[1]]];
    }
    if (eintrag && typeof eintrag === "object") {
      const o = eintrag as Record<string, unknown>;
      const k = [o.k, o.key, o.schluessel, o.label, o.name].find(istText);
      const v = [o.v, o.value, o.wert, o.text].find(istText);
      if (k && v) return [[k, v]];
    }
    return [];
  });
}

/** Erwartet [{"kurz":"Hooks","text":"…"}]. Nimmt auch {"Hooks":"…"},
    ["…"] und {short,label,title} statt kurz entgegen. */
export function promptsAus(roh: unknown): { kurz: string; text: string }[] {
  if (!roh) return [];

  // Objektform: { "Hooks": "Welche Hooks …?" }
  if (typeof roh === "object" && !Array.isArray(roh)) {
    return Object.entries(roh as Record<string, unknown>)
      .filter(([k, v]) => istText(k) && istText(v))
      .map(([k, v]) => ({ kurz: k, text: v as string }));
  }

  if (!Array.isArray(roh)) return [];

  return roh.flatMap((eintrag): { kurz: string; text: string }[] => {
    // Blosser String: das Kuerzel wird aus den ersten Woertern gebildet.
    if (istText(eintrag)) {
      return [{ kurz: eintrag.split(" ").slice(0, 2).join(" "), text: eintrag }];
    }
    if (eintrag && typeof eintrag === "object") {
      const o = eintrag as Record<string, unknown>;
      const text = [o.text, o.prompt, o.value, o.v].find(istText);
      if (!text) return [];
      const kurz = [o.kurz, o.short, o.label, o.title, o.k].find(istText)
        ?? text.split(" ").slice(0, 2).join(" ");
      return [{ kurz, text }];
    }
    return [];
  });
}
