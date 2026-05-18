import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getAllAgents } from "@/lib/supabase";
import AdminDashboard from "@/app/components/AdminDashboard";

export default async function AdminPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  // Admin-Prüfung
  const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (adminIds.length > 0 && !adminIds.includes(userId)) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 8 }}>Kein Zugriff</h1>
          <p style={{ color: "#666" }}>Du bist kein Admin. Deine User-ID: <code>{userId}</code></p>
        </div>
      </div>
    );
  }

  const agents = await getAllAgents();

  return <AdminDashboard agents={agents} />;
}
