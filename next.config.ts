import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },

  // L2: lib/agents/sessionRessourcen.ts liest die Werkzeugskripte zur Laufzeit
  // mit fs.readFile aus agents/<slug>/werkzeuge/. Next.js packt ins Lambda nur
  // ein, was es ueber Importe erreicht — ein zusammengesetzter Pfad zaehlt nicht
  // dazu. Ohne diesen Eintrag laeuft es lokal und schlaegt auf Vercel fehl.
  outputFileTracingIncludes: {
    "/api/chat": ["./agents/**/werkzeuge/**"],
  },
};

export default nextConfig;
