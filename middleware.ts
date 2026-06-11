import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Diese Routen sind ÖFFENTLICH (kein Login nötig)
const isPublicRoute = createRouteMatcher([
  "/",              // Landing Page
  "/sign-in(.*)",   // Login
  "/sign-up(.*)",   // Registrierung
  "/api/webhooks/stripe", // Stripe Webhook (muss ohne Auth erreichbar sein)
  "/api/research/(.*)",  // Research Agent (intern, Auth im Frontend)
]);

// Alle anderen Routen sind GESCHÜTZT
// Wer nicht eingeloggt ist, wird zur Login-Seite weitergeleitet
export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
