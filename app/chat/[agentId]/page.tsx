import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getDBAgentById, getUserAccessedAgents } from "@/lib/platform/supabase";
import ChatSeite from "./ChatSeite";

/* Der Chat war bisher vollstaendig eine Client-Komponente und kannte vom
   Agenten nur den Namen, den die Chat-Route als Kopfzeile zurueckschickt.
   Beschreibung, Fakten und Startprompts stehen aber in der Datenbank —
   deshalb laedt jetzt eine Server-Komponente davor und reicht sie durch.
   Die Seitenleiste braucht ausserdem die uebrigen Agenten des Kunden. */

interface PageProps {
  params: Promise<{ agentId: string }>;
}

export default async function ChatPage({ params }: PageProps) {
  const { agentId } = await params;
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [agent, meineAgents] = await Promise.all([
    getDBAgentById(agentId),
    getUserAccessedAgents(userId),
  ]);

  return <ChatSeite agentId={agentId} agent={agent} meineAgents={meineAgents} />;
}
