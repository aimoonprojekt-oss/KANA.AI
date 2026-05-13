import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getPublishedAgents } from "@/lib/supabase";
import LandingPage from "./components/LandingPage";

// Eingeloggte User → Dashboard, nicht eingeloggte → Landing Page
export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  // Agents aus der Supabase-DB laden (published = true, nach featured sortiert)
  const agents = await getPublishedAgents();

  return <LandingPage agents={agents} />;
}
