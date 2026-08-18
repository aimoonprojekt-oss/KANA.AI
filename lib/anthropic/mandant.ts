/**
 * Mandanten-Client — Modell A
 * ===========================
 *
 * Entscheidung vom 18.08.2026: ein Anthropic-Workspace je Kunde. Die Trennung
 * der Kundendaten macht damit Anthropic, nicht unser Code.
 *
 * Das funktioniert aber nur, solange jeder kundenbezogene Aufruf tatsächlich
 * mit dem Schlüssel des richtigen Workspace erfolgt. Ein Schlüssel gehört zu
 * genau einem Workspace — nimmt eine Route versehentlich den KANA-Schlüssel,
 * landet die Session im falschen Workspace. Die API beanstandet das nicht.
 * Es fällt niemandem auf, bis jemand die Daten sucht.
 *
 * Deshalb gibt es genau diese eine Stelle, an der ein kundenbezogener Client
 * entsteht. Vor dem Umbau waren es elf verstreute `new Anthropic({ apiKey:
 * process.env.ANTHROPIC_API_KEY })`.
 *
 * ── Die Regel ────────────────────────────────────────────────────────────────
 *
 *   Etwas für EINEN KUNDEN?      → anthropicFuerNutzer(userId)
 *   Etwas für KANA selbst?       → anthropicKana()
 *
 * Betrieblich sind: der Katalog-Sync, Admin-Werkzeuge, der Stripe-Webhook, der
 * eigene Support-Chat. Die laufen im KANA-Workspace, und dort gehören sie hin.
 *
 * ── Warum es an einer Stelle laut scheitert und an anderer nicht ─────────────
 *
 * Solange ein Kunde noch keinen eigenen Workspace hat, läuft er weiter über
 * KANA. Das ist der Übergangszustand und beabsichtigt — sonst wäre die Website
 * ab dem Einspielen dieser Änderung für alle bestehenden Konten tot.
 *
 * Ist aber ein Workspace hinterlegt und der Schlüssel fehlt, bricht es hart ab.
 * Ein stiller Rückfall auf KANA wäre in dem Moment genau das Datenteilen, das
 * Modell A verhindern soll.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getSupabaseAdmin, getOrCreateOrganization } from "@/lib/platform/supabase";

export type Mandant = {
  client: Anthropic;
  organizationId: string;
  /** Workspace des Kunden, oder null solange er noch über KANA läuft. */
  workspaceId: string | null;
  /** true = läuft (noch) im KANA-Workspace. Für Protokollierung. */
  ueberKanaWorkspace: boolean;
};

/** Der KANA-eigene Workspace. Für alles Betriebliche. */
export function anthropicKana(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY fehlt. In Vercel unter Settings → Environment Variables setzen."
    );
  }
  return new Anthropic({ apiKey });
}

/**
 * Der Client für die Arbeit im Namen eines Kunden.
 *
 * Wirft, wenn ein Workspace hinterlegt ist, aber kein Schlüssel dazu gefunden
 * wird. Fällt auf KANA zurück, solange gar kein Workspace hinterlegt ist.
 */
export async function anthropicFuerNutzer(userId: string): Promise<Mandant> {
  const organizationId = await getOrCreateOrganization(userId);

  const { data, error } = await getSupabaseAdmin()
    .from("organizations")
    .select("anthropic_workspace_id, anthropic_key_secret_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Organisation nicht lesbar: ${error.message}`);
  }

  const workspaceId = (data?.anthropic_workspace_id as string | null) ?? null;

  // Übergangsfall: noch kein eigener Workspace → weiter über KANA.
  if (!workspaceId) {
    console.warn(
      `[mandant] Organisation ${organizationId} hat keinen eigenen Workspace — läuft über KANA. ` +
        `Das ist der Übergangszustand, nicht das Ziel.`
    );
    return {
      client: anthropicKana(),
      organizationId,
      workspaceId: null,
      ueberKanaWorkspace: true,
    };
  }

  // Ab hier ist ein Workspace hinterlegt. Jetzt MUSS der Schlüssel passen.
  if (!data?.anthropic_key_secret_id) {
    throw new Error(
      `Organisation ${organizationId} ist Workspace ${workspaceId} zugeordnet, ` +
        `aber es ist kein Schlüssel hinterlegt (organizations.anthropic_key_secret_id ist leer). ` +
        `Kein Rückfall auf KANA — das wäre der falsche Workspace.`
    );
  }

  // Der Schlüssel liegt im Vault und ist über PostgREST nicht direkt erreichbar.
  // public.workspace_schluessel() ist die einzige Tür dorthin, nur für
  // service_role freigegeben. Siehe Migration 0006.
  const { data: schluessel, error: rpcFehler } = await getSupabaseAdmin().rpc(
    "workspace_schluessel",
    { p_organization_id: organizationId }
  );

  if (rpcFehler) {
    throw new Error(
      `Workspace-Schlüssel für ${organizationId} nicht lesbar: ${rpcFehler.message}`
    );
  }
  if (!schluessel || typeof schluessel !== "string") {
    throw new Error(
      `Workspace-Schlüssel für ${organizationId} ist leer. ` +
        `Verweis in organizations.anthropic_key_secret_id zeigt ins Nichts?`
    );
  }

  return {
    client: new Anthropic({ apiKey: schluessel }),
    organizationId,
    workspaceId,
    ueberKanaWorkspace: false,
  };
}

/**
 * Wie anthropicFuerNutzer, aber für Wege ohne Clerk-Login — heute das
 * Shop-Widget, das sich über seinen Widget-Token ausweist und dessen
 * Organisation direkt aus widget_configs kommt.
 */
export async function anthropicFuerOrganisation(
  organizationId: string
): Promise<Mandant> {
  const { data } = await getSupabaseAdmin()
    .from("organizations")
    .select("user_id")
    .eq("id", organizationId)
    .maybeSingle();

  // Der Umweg über die user_id hält die Logik an einer Stelle. Organisationen
  // ohne Login (ein Kunde, der noch keinen Portalzugang hat) gibt es in
  // Modell A durchaus — dann direkt weiterarbeiten.
  if (data?.user_id) return anthropicFuerNutzer(data.user_id as string);

  const { data: org } = await getSupabaseAdmin()
    .from("organizations")
    .select("anthropic_workspace_id, anthropic_key_secret_id")
    .eq("id", organizationId)
    .maybeSingle();

  const workspaceId = (org?.anthropic_workspace_id as string | null) ?? null;
  if (!workspaceId) {
    return {
      client: anthropicKana(),
      organizationId,
      workspaceId: null,
      ueberKanaWorkspace: true,
    };
  }

  const { data: schluessel } = await getSupabaseAdmin().rpc("workspace_schluessel", {
    p_organization_id: organizationId,
  });
  if (!schluessel || typeof schluessel !== "string") {
    throw new Error(`Workspace-Schlüssel für Organisation ${organizationId} fehlt.`);
  }

  return {
    client: new Anthropic({ apiKey: schluessel }),
    organizationId,
    workspaceId,
    ueberKanaWorkspace: false,
  };
}
