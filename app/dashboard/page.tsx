import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getUserAgents } from "@/lib/supabase";
import PortalDashboard from "@/app/components/PortalDashboard";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const [user, agents] = await Promise.all([
    currentUser(),
    getUserAgents(userId),
  ]);

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : (user?.firstName?.[0] ?? user?.emailAddresses[0]?.emailAddress?.[0] ?? "?").toUpperCase();

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.emailAddresses[0]?.emailAddress ?? "Nutzer";

  const email = user?.emailAddresses[0]?.emailAddress ?? "";

  return (
    <PortalDashboard
      userAgents={agents}
      userName={displayName}
      userInitials={initials}
      userEmail={email}
    />
  );
}
