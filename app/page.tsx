import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

// Landing Page: Eingeloggte User → Dashboard, Rest → Sign-In
export default async function HomePage() {
  const { userId } = await auth();

  if (userId) {
    redirect("/dashboard");
  } else {
    redirect("/sign-in");
  }
}
