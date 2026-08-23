/* Plattform-Logos als einfarbige SVG-Zeichen.

   ACHTUNG vor der Veroeffentlichung: Das sind eigene, vereinfachte
   Nachzeichnungen — keine offiziellen Markenzeichen. Die meisten
   Markenrichtlinien verlangen die Originaldateien und schreiben Abstaende,
   Mindestgroessen und erlaubte Farben vor. Vor dem Livegang die offiziellen
   SVGs aus den jeweiligen Brand-Kits einsetzen; dafuer reicht es, das `svg`
   im Eintrag unten zu tauschen. Die Struktur bleibt gleich. */

type Logo = { name: string; svg: React.ReactNode };

const s = { fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export const KANAELE: Logo[] = [
  {
    name: "Meta",
    svg: (
      <path {...s} d="M7.6 6.2c-2.9 0-5 2.6-5 5.8s2.1 5.8 5 5.8c3.6 0 4.8-11.6 8.8-11.6 2.9 0 5 2.6 5 5.8s-2.1 5.8-5 5.8c-3.6 0-4.8-11.6-8.8-11.6z" />
    ),
  },
  {
    name: "Instagram",
    svg: (
      <>
        <rect {...s} x="3" y="3" width="18" height="18" rx="5" />
        <circle {...s} cx="12" cy="12" r="4.1" />
        <circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" />
      </>
    ),
  },
  {
    name: "TikTok",
    svg: (
      <path
        fill="currentColor"
        d="M16.9 5.9A4.4 4.4 0 0 1 15.8 3h-3.2v12.6a2.6 2.6 0 1 1-1.9-2.5V9.8a6.1 6.1 0 0 0-.7 0 5.8 5.8 0 1 0 5.8 5.8V9.2a7.5 7.5 0 0 0 4.4 1.4V7.4a4.4 4.4 0 0 1-3.3-1.5z"
      />
    ),
  },
  {
    name: "Google Ads",
    svg: (
      <>
        <rect fill="currentColor" x="9.2" y="1.6" width="5.6" height="17.6" rx="2.8" transform="rotate(30 12 10.4)" />
        <rect fill="currentColor" opacity="0.55" x="9.2" y="1.6" width="5.6" height="17.6" rx="2.8" transform="rotate(-30 12 10.4)" />
        <circle fill="currentColor" cx="6.4" cy="18.3" r="3.1" />
      </>
    ),
  },
  {
    name: "LinkedIn",
    svg: (
      <>
        <rect {...s} x="3" y="3" width="18" height="18" rx="3" />
        <circle cx="7.4" cy="8" r="1.35" fill="currentColor" />
        <rect fill="currentColor" x="6.2" y="10.3" width="2.4" height="7.4" />
        <path
          fill="currentColor"
          d="M10.9 17.7v-7.4h2.3v1c.5-.8 1.4-1.2 2.4-1.2 2 0 3.2 1.3 3.2 3.5v4.1h-2.4v-3.7c0-1.2-.5-1.9-1.5-1.9s-1.7.7-1.7 1.9v3.7h-2.3z"
        />
      </>
    ),
  },
  {
    name: "Shopify",
    svg: (
      <>
        <path {...s} d="M14.2 4.4c-.4-1.3-1.2-2-2.2-2-2.1 0-3.3 2.6-3.9 5.3" />
        <path {...s} d="M5.8 6.4 4 20.4l8 1.2 8-1.2-1.9-13.6-4.5-.9-3.4.4z" />
        <path {...s} d="M13.6 10.2c-.6-.4-1.3-.6-2-.6-1.6 0-2.2.9-2.2 1.7 0 1.9 3.1 1.9 3.1 3.6 0 .9-.7 1.6-1.9 1.6-.8 0-1.5-.2-2.1-.6" />
      </>
    ),
  },
  {
    name: "WooCommerce",
    svg: (
      <>
        <path {...s} d="M2.4 6.6h19.2c.6 0 1 .5 1 1v7.6c0 .6-.4 1-1 1H13l-3.4 3.3.5-3.3H2.4c-.6 0-1-.4-1-1V7.6c0-.5.4-1 1-1z" />
        <path {...s} d="m4.6 9.6 1.5 4 1.5-4 1.5 4 1.4-4M13.6 9.4c1.2 0 2 1 2 2.3s-.8 2.3-2 2.3-2-1-2-2.3.8-2.3 2-2.3zM18.6 9.4c1.2 0 2 1 2 2.3s-.8 2.3-2 2.3-2-1-2-2.3.8-2.3 2-2.3z" />
      </>
    ),
  },
  {
    name: "Klaviyo",
    svg: (
      <path {...s} d="M3 8.6 11.2 3.4c.5-.3 1.1-.3 1.6 0L21 8.6M3 15.4l8.2 5.2c.5.3 1.1.3 1.6 0l8.2-5.2M6.6 12h10.8" />
    ),
  },
];

export const TECHNIK: Logo[] = [
  {
    name: "Stripe",
    svg: (
      <path
        fill="currentColor"
        d="M11.1 9.5c0-.7.6-1 1.5-1 1.4 0 3.1.4 4.5 1.2V5.8c-1.5-.6-3-.9-4.5-.9-3.7 0-6.1 1.9-6.1 5.1 0 5 6.9 4.2 6.9 6.4 0 .8-.7 1.1-1.7 1.1-1.5 0-3.5-.6-5-1.5v3.9c1.7.7 3.4 1 5 1 3.8 0 6.4-1.9 6.4-5.1 0-5.4-6.9-4.5-6.9-6.3z"
      />
    ),
  },
  {
    name: "Supabase",
    svg: (
      <path fill="currentColor" d="M12.4 1.7 3.2 13.2c-.6.8-.1 2 .9 2h7.4v6.5c0 1 1.2 1.4 1.8.6l9.2-11.5c.6-.8.1-2-.9-2h-7.4V2.3c0-1-1.2-1.4-1.8-.6z" />
    ),
  },
  {
    name: "Anthropic",
    svg: (
      <path fill="currentColor" d="M8.6 3 2.5 21h3.7l1.3-4.1h6.9L15.7 21h3.7L13.3 3H8.6zm-.1 10.7 2.9-8.9 2.9 8.9H8.5z" />
    ),
  },
];

export function PlattformLogo({ logo, size = 26 }: { logo: Logo; size?: number }) {
  return (
    <span className="plattform" title={logo.name}>
      <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={logo.name}>
        {logo.svg}
      </svg>
      <span className="plattform__name">{logo.name}</span>
    </span>
  );
}
