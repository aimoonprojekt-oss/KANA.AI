import { getPublishedAgents } from "@/lib/platform/supabase";
import PreiseSeite from "@/app/components/ui/PreiseSeite";

/* Die Seite wird vorgerendert. Ohne revalidate waeren die Preise auf dem
   Stand des letzten Builds — sie kommen aber aus der Datenbank und aendern
   sich dort. Fuenf Minuten sind der Kompromiss aus Aktualitaet und Last. */
export const revalidate = 300;

export const metadata = {
  title: "Preise — KANA AI",
  description: "Du zahlst pro Agent. Nicht pro Abteilung. Monatlich kündbar.",
};

export default async function PreisePage() {
  const agents = await getPublishedAgents();
  return <PreiseSeite agents={agents} />;
}
