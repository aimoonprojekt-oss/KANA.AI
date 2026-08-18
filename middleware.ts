import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Diese Routen sind ÖFFENTLICH (kein Login nötig)
// ACHTUNG: Was hier steht, ist ohne Login aus dem Internet erreichbar.
// Routen, die Geld ausgeben (Anthropic, Apify, Gemini), gehoeren NICHT hierher.
const isPublicRoute = createRouteMatcher([
  "/",              // Landing Page
  "/sign-in(.*)",   // Login
  "/sign-up(.*)",   // Registrierung
  "/api/webhooks/stripe", // Stripe Webhook (muss ohne Auth erreichbar sein)
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
