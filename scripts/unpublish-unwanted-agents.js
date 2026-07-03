/**
 * Setzt 4 unerwünschte Agents auf published=false in Supabase.
 * Ausführen NACH dem Resumieren des Supabase-Projekts:
 *   node scripts/unpublish-unwanted-agents.js
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const AGENTS_TO_HIDE = [
  "Sprint retro facilitator",
  "Incident commander",
  "snl-brand-expert",
];

// Zusätzlich: Duplikate des SNL Creative Research Agent — wir lassen den
// mit der neuesten anthropic_agent_id stehen und deaktivieren alle anderen.

async function main() {
  console.log("Fetching all agents...");
  const { data: all, error } = await supabase
    .from("agents")
    .select("id, name, anthropic_agent_id, published, created_at")
    .order("created_at");

  if (error) {
    console.error("Error fetching agents:", error.message);
    process.exit(1);
  }

  console.log(`Found ${all.length} agents total:\n`);
  all.forEach((a) => console.log(`  [${a.published ? "✅" : "❌"}] ${a.name} (${a.anthropic_agent_id})`));

  // Agents by name die weg sollen
  const toHide = all.filter((a) => AGENTS_TO_HIDE.includes(a.name));

  // Duplikate: mehrere "SNL Creative Research Agent" → ältere deaktivieren
  const researchAgents = all.filter((a) => a.name === "SNL Creative Research Agent");
  if (researchAgents.length > 1) {
    // Neueste behalten (letzter in der nach created_at sortierten Liste)
    const toDeactivate = researchAgents.slice(0, -1);
    toHide.push(...toDeactivate);
  }

  if (toHide.length === 0) {
    console.log("\nKeine Agents zum Deaktivieren gefunden.");
    return;
  }

  console.log(`\nDeaktiviere ${toHide.length} Agents:`);
  for (const agent of toHide) {
    console.log(`  → ${agent.name} (${agent.anthropic_agent_id})`);
    const { error: updateErr } = await supabase
      .from("agents")
      .update({ published: false })
      .eq("id", agent.id);
    if (updateErr) {
      console.error(`    FEHLER: ${updateErr.message}`);
    } else {
      console.log(`    ✅ published=false gesetzt`);
    }
  }

  console.log("\nFertig! Seite neu laden → Agents verschwinden.");
}

main();
