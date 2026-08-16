/**
 * Console-Workspaces
 * ==================
 *
 * Ein Anthropic-API-Schlüssel gehört zu genau EINEM Workspace. Wer Agenten
 * aus mehreren Workspaces sehen will, braucht deshalb je Workspace einen
 * eigenen Schlüssel.
 *
 * Hier steht, welche Workspaces es gibt und aus welcher Umgebungsvariablen
 * der jeweilige Schlüssel kommt. Bewusst als Liste im Code statt als
 * geparster Sammel-String: Ein neuer Workspace ist eine Zeile hier plus
 * eine Variable in Vercel — beides sichtbar im Pull Request.
 *
 * Aufteilung nach der Architekturentscheidung vom 16.08.2026:
 *
 *   KANA AI          Produktkatalog. Die verkaufbaren Master-Agenten.
 *                    Nur was hier liegt, kann im Shop erscheinen.
 *
 *   Sins 'n Lashes   Bestand des Erstkunden, solange die Agenten noch
 *                    hartcodiert sind. Erscheint NICHT im Katalog.
 *
 * Langfristig gilt weiter: ein Master-Agent je Produkt, Mandantentrennung
 * zur Laufzeit über den übergebenen Kontext. Kundenworkspaces sind ein
 * Übergang, kein Zielbild — Anthropic erlaubt maximal 100 je Organisation.
 */

export type WorkspaceConfig = {
  /** Anzeigename. Landet als `workspace` in der agents-Tabelle. */
  name: string;
  /** Name der Umgebungsvariablen mit dem API-Schlüssel dieses Workspace. */
  keyEnv: string;
  /** Dürfen Agenten aus diesem Workspace im Shop verkauft werden? */
  verkaeuflich: boolean;
};

export const WORKSPACES: WorkspaceConfig[] = [
  { name: "KANA AI",        keyEnv: "ANTHROPIC_API_KEY",     verkaeuflich: true  },
  { name: "Sins 'n Lashes", keyEnv: "ANTHROPIC_API_KEY_SNL", verkaeuflich: false },
];

/**
 * Die Workspaces, für die tatsächlich ein Schlüssel hinterlegt ist.
 * Fehlt ein Schlüssel, wird der Workspace beim Sync stillschweigend
 * übersprungen — und, wichtiger, seine Agenten werden NICHT archiviert.
 * Sonst würde ein vergessener Schlüssel den halben Katalog abräumen.
 */
export function konfigurierteWorkspaces(): (WorkspaceConfig & { apiKey: string })[] {
  return WORKSPACES
    .map(w => ({ ...w, apiKey: process.env[w.keyEnv] ?? "" }))
    .filter(w => w.apiKey.length > 0);
}

/** Ist dieser Workspace grundsätzlich verkäuflich? Unbekannt → nein. */
export function istVerkaeuflich(workspaceName: string | null): boolean {
  if (!workspaceName) return false;
  return WORKSPACES.find(w => w.name === workspaceName)?.verkaeuflich ?? false;
}
