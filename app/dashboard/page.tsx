import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getUserAccessedAgents,
  getLockedAgentsForUser,
  getUserUsageStats,
} from "@/lib/supabase";
import PortalDashboard from "@/app/components/PortalDashboard";

interface PageProps {
  searchParams: Promise<{ purchased?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const params = await searchParams;

  const [user, userAgents, lockedAgents, usage] = await Promise.all([
    currentUser(),
    getUserAccessedAgents(userId),
    getLockedAgentsForUser(userId),
    getUserUsageStats(userId),
  ]);

  const initials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`
    : (user?.firstName?.[0] ?? user?.emailAddresses[0]?.emailAddress?.[0] ?? "?").toUpperCase();

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.emailAddresses[0]?.emailAddress ?? "Nutzer";

  const email = user?.emailAddresses[0]?.emailAddress ?? "";

  // Admin-Check: userId muss in ADMIN_USER_IDS stehen (oder Liste ist leer → alle sind Admin)
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const isAdmin  = adminIds.length === 0 || adminIds.includes(userId);

  return (
    <PortalDashboard
      userAgents={userAgents}
      lockedAgents={lockedAgents}
      userName={displayName}
      userInitials={initials}
      userEmail={email}
      usage={usage}
      purchasedSlug={params.purchased}
      isAdmin={isAdmin}
    />
  );
}
