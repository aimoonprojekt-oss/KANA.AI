/**
 * Kundenkopien — Modell A
 * =======================
 *
 * In Modell A hat jeder Kunde einen eigenen Anthropic-Workspace. Agenten sind
 * workspace-gebunden: Ein Agent aus dem KANA-Workspace lässt sich in der
 * Session eines Kunden nicht starten. Jeder Kunde braucht deshalb seine eigene
 * Kopie des gekauften Agenten.
 *
 * ── Master und Kopie ─────────────────────────────────────────────────────────
 *
 *   Master   im Workspace "KANA AI". Der Katalogeintrag: hat einen Preis, ist
 *            veröffentlicht, wird gekauft. In der Datenbank: organization_id
 *            IS NULL.
 *   Kopie    im Workspace des Kunden. Wird nie veröffentlicht, hat keinen
 *            Preis, und master_agent_id zeigt auf das Produkt.
 *
 * Gekauft wird der Master, gestartet wird die Kopie. `agent_access1` bleibt
 * deshalb unverändert und zeigt weiter auf den Master.
 *
 * ── Warum die Kopie beim ersten Chat entsteht, nicht beim Kauf ───────────────
 *
 * Der naheliegende Ort wäre der Stripe-Webhook. Drei Gründe dagegen:
 *
 * 1. Beim Kauf hat der Kunde womöglich noch keinen Workspace. Das Onboarding
 *    (Workspace anlegen, Schlüssel erzeugen, Ausgabenlimit setzen) ist laut
 *    scripts/workspace-anlegen.sh teilweise Handarbeit und passiert nicht in
 *    den zwei Sekunden, die Stripe auf eine Antwort wartet.
 * 2. Bestandskunden haben ihre Käufe längst hinter sich. Bei einer Anlage im
 *    Webhook bekämen sie nie eine Kopie.
 * 3. Schlägt die Anlage im Webhook fehl, ist der Kauf durch und der Zugang
 *    kaputt — und Stripe wiederholt nicht ewig.
 *
 * Beim ersten Chat ist all das entschärft: Der Workspace existiert dann oder
 * eben nicht, und im zweiten Fall läuft der Kunde übergangsweise weiter über
 * den Master im KANA-Workspace. Nichts bricht, es wird nur noch nicht getrennt.
 *
 * Die Anlage ist idempotent — sie darf beliebig oft aufgerufen werden.
 */

import { getSupabaseAdmin, type DBAgent } from "@/lib/platform/supabase";
import { anthropicKana, anthropicFuerOrganisation } from "@/lib/anthropic/mandant";

export type Laufziel = {
  /** Die Agent-ID, mit der die Session tatsächlich gestartet wird. */
  agentId: string;
  /** Die Environment-ID im selben Workspace. */
  environmentId: string;
  /** true = es läuft noch der Master im KANA-Workspace (Übergang). */
  ueberMaster: boolean;
};

/**
 * Sorgt dafür, dass es im Workspace des Kunden eine Kopie dieses Agenten gibt,
 * und liefert zurück, womit die Session zu starten ist.
 *
 * Hat der Kunde keinen eigenen Workspace, wird nichts angelegt und der Master
 * zurückgegeben — der Übergangszustand.
 */
export async function laufzielFuerKunden(
  organizationId: string,
  master: DBAgent
): Promise<Laufziel> {
  const db = getSupabaseAdmin();

  const mandant = await anthropicFuerOrganisation(organizationId);

  // Kein eigener Workspace → weiter mit dem Master. Keine Kopie anlegen:
  // Sie läge im KANA-Workspace und wäre damit genau die Vermischung, die
  // Modell A vermeiden soll.
  if (mandant.ueberKanaWorkspace) {
    return {
      agentId: master.anthropic_agent_id,
      environmentId: master.environment_id,
      ueberMaster: true,
    };
  }

  // ── 1. Gibt es die Kopie schon? ───────────────────────────────────────────
  const { data: vorhanden } = await db
    .from("agents")
    .select("anthropic_agent_id, environment_id, archived")
    .eq("organization_id", organizationId)
    .eq("master_agent_id", master.id)
    .maybeSingle();

  if (vorhanden && !vorhanden.archived) {
    return {
      agentId: vorhanden.anthropic_agent_id as string,
      environmentId: vorhanden.environment_id as string,
      ueberMaster: false,
    };
  }

  // ── 2. Master-Konfiguration lesen — aus dem KANA-Workspace ────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kanaBeta = (anthropicKana() as any).beta;
  const masterKonfig = await kanaBeta.agents.retrieve(master.anthropic_agent_id);

  // ── 3. Umgebung im Kundenworkspace sicherstellen ──────────────────────────
  // Sie wird nicht neu erfunden, sondern von der Umgebung des Masters
  // abgeschrieben. Damit hat die Kopie exakt dieselben Netzrechte wie das
  // Original — nicht mehr und nicht weniger.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kundenBeta = (mandant.client as any).beta;
  const environmentId = await umgebungSicherstellen(
    kanaBeta,
    kundenBeta,
    master.environment_id
  );

  // ── 4. Kopie anlegen ──────────────────────────────────────────────────────
  const kopie = await kundenBeta.agents.create({
    name: masterKonfig.name,
    model: masterKonfig.model,
    description: masterKonfig.description ?? "",
    system: masterKonfig.system ?? "",
    tools: masterKonfig.tools ?? [],
    skills: masterKonfig.skills ?? [],
    mcp_servers: masterKonfig.mcp_servers ?? [],
    // Damit in der Console erkennbar ist, woher diese Kopie stammt. Ohne das
    // steht dort irgendwann ein Dutzend gleichnamiger Agenten ohne Herkunft.
    metadata: {
      kana_master: master.anthropic_agent_id,
      kana_organisation: organizationId,
    },
  });

  // ── 5. In der Datenbank festhalten ────────────────────────────────────────
  // repo_ordner wird mitgenommen: Die Werkzeugskripte sind dieselben.
  // vault_ids und memory_store_ids bewusst NICHT — die gehören dem Kunden und
  // werden beim Onboarding gesetzt, nicht vom Master geerbt.
  const { error } = await db.from("agents").insert({
    anthropic_agent_id: kopie.id,
    environment_id:     environmentId,
    name:               master.name,
    slug:               `${master.slug}-${organizationId.slice(0, 8)}`,
    description:        master.description,
    category:           master.category,
    workspace:          mandant.workspaceId,
    repo_ordner:        master.repo_ordner,
    organization_id:    organizationId,
    master_agent_id:    master.id,
    published:          false,
    featured:           false,
    price_eur:          0,
    archived:           false,
    last_seen_at:       new Date().toISOString(),
  });

  if (error) {
    // Wettlauf: Zwei gleichzeitige erste Nachrichten. Der eindeutige Index aus
    // Migration 0007 lässt nur eine Kopie zu — die andere landet hier. Dann
    // die vorhandene lesen statt scheitern.
    console.warn(
      `[kundenkopie] Insert fehlgeschlagen (${error.message}) — lese vorhandene Kopie.`
    );
    const { data: doch } = await db
      .from("agents")
      .select("anthropic_agent_id, environment_id")
      .eq("organization_id", organizationId)
      .eq("master_agent_id", master.id)
      .maybeSingle();

    if (doch) {
      return {
        agentId: doch.anthropic_agent_id as string,
        environmentId: doch.environment_id as string,
        ueberMaster: false,
      };
    }
    throw new Error(`Kundenkopie konnte nicht gespeichert werden: ${error.message}`);
  }

  console.log(
    `[kundenkopie] ${master.name} für Organisation ${organizationId} ` +
      `in Workspace ${mandant.workspaceId} angelegt: ${kopie.id}`
  );

  return { agentId: kopie.id, environmentId, ueberMaster: false };
}

/**
 * Legt im Kundenworkspace eine Umgebung mit derselben Konfiguration an wie die
 * des Masters — oder findet die bereits vorhandene.
 *
 * Erkannt wird sie am Namen. Der ist innerhalb eines Workspace eindeutig genug,
 * und er macht in der Console sichtbar, wozu die Umgebung gehört.
 */
async function umgebungSicherstellen(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kanaBeta: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  kundenBeta: any,
  masterEnvironmentId: string
): Promise<string> {
  const vorlage = await kanaBeta.environments.retrieve(masterEnvironmentId);
  const name = vorlage.name as string;

  for await (const umgebung of kundenBeta.environments.list()) {
    if (umgebung?.name === name) return umgebung.id as string;
  }

  const neu = await kundenBeta.environments.create({
    name,
    description: vorlage.description ?? null,
    config: vorlage.config
      ? { type: "cloud", networking: vorlage.config.networking }
      : undefined,
  });

  console.log(`[kundenkopie] Umgebung "${name}" im Kundenworkspace angelegt: ${neu.id}`);
  return neu.id as string;
}
