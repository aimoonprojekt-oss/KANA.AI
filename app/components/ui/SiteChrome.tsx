"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import KanaMark, { KanaLogo } from "./KanaMark";

/* Kopf- und Fusszeile der oeffentlichen Seiten. Liegt an einer Stelle,
   damit Landingpage, Preise und Recht nicht auseinanderlaufen. */

type NavAktiv = "preise" | "recht" | null;

export function SiteNav({ aktiv = null }: { aktiv?: NavAktiv }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav className={`landing-nav${scrolled ? " is-scrolled" : ""}`}>
      <Link href="/" aria-label="KANA AI — Startseite">
        <KanaLogo size={26} fontSize={19} />
      </Link>
      <ul className="nav-links">
        <li><Link href="/#ablauf">So funktioniert es</Link></li>
        <li><Link href="/#ausbaustufen">Abteilungen</Link></li>
        <li>
          <Link href="/preise" className={aktiv === "preise" ? "is-current" : undefined}>Preise</Link>
        </li>
        <li><Link href="/sign-in">Anmelden</Link></li>
      </ul>
      <div className="nav-actions">
        <Link href="/sign-up" className="btn btn-outline">Kostenlos starten</Link>
      </div>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="landing-footer">
      <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <KanaMark size={18} />
        <span>© {new Date().getFullYear()} KANA AI. Alle Rechte vorbehalten.</span>
      </span>
      <span className="footer-links">
        <Link href="/preise">Preise</Link>
        <Link href="/ki-transparenz">KI-Transparenz</Link>
        <Link href="/recht?doc=impressum">Impressum</Link>
        <Link href="/recht?doc=datenschutz">Datenschutz</Link>
      </span>
    </footer>
  );
}
