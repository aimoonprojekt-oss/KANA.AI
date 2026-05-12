import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import LandingPage from "./components/LandingPage";

// Eingeloggte User → Dashboard, nicht eingeloggte → Landing Page
export default async function HomePage() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");
  return <LandingPage />;
}
