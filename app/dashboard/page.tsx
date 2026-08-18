import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import {
  getUserAccessedAgents,
  getLockedAgentsForUser,
  getUserUsageStats,
  isAdminUser,
} from "@/lib/platform/supabase";
import PortalDashboard from "@/app/components/dashboard/PortalDashboard";
import SupportChatWidget from "@/app/components/ui/SupportChatWidget";

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

  // Admin-Check über zentrale Funktion aus lib/supabase.ts
  const isAdmin = isAdminUser(userId);

  /* Die Support-Blase hing bisher im Wurzel-Layout und erschien deshalb auch
     auf der oeffentlichen Landingpage — dort ohne Funktion, weil
     /api/support-chat nicht als oeffentliche Route eingetragen ist. Sie sitzt
     jetzt im Kundenbereich, wo sie hingehoert. */
  return (
    <>
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
    <SupportChatWidget />
    </>
  );
}
