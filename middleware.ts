import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Diese Routen sind ÖFFENTLICH (kein Login nötig)
// ACHTUNG: Was hier steht, ist ohne Login aus dem Internet erreichbar.
// Routen, die Geld ausgeben (Anthropic, Apify, Gemini), gehoeren NICHT hierher.
const isPublicRoute = createRouteMatcher([
  "/",              // Landing Page
  "/preise",        // Preisseite — zeigt dieselben published Agents wie "/"
  "/ki-transparenz",// Kennzeichnung nach Art. 50 KI-VO. Muss ohne Login
                    // erreichbar sein: der Hinweis gilt auch fuer Besucher,
                    // die noch keinen Zugang haben.
  "/recht",         // Impressum und Datenschutz. MUSS ohne Login erreichbar
                    // sein: die Impressumspflicht nach § 5 DDG verlangt
                    // unmittelbare Erreichbarkeit ohne Anmeldung.
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
