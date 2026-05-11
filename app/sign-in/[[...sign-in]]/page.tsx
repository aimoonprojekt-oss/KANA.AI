import { SignIn } from "@clerk/nextjs";

// KANA Logo SVG als Komponente
function KanaLogo({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" fill="none">
      <defs>
        <linearGradient id="g-auth" x1="0" y1="0" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9333ea" />
          <stop offset="100%" stopColor="#1d4ed8" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="9" fill="url(#g-auth)" />
      <rect x="9.5" y="8" width="2.8" height="18" rx="1.4" fill="white" />
      <path d="M12.3 17L22 8.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M12.3 17L22 25.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export default function SignInPage() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Hintergrund-Glow */}
      <div style={{ position: "absolute", top: -200, right: -200, width: 600, height: 600, background: "radial-gradient(circle, rgba(147,51,234,.1), transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: -200, left: -200, width: 500, height: 500, background: "radial-gradient(circle, rgba(29,78,216,.08), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Logo über dem Clerk-Formular */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <KanaLogo size={48} />
          <div style={{
            fontSize: 22, fontWeight: 800, letterSpacing: "-0.3px", color: "var(--text)", marginTop: 10,
          }}>
            KANA <span style={{ fontStyle: "normal", fontWeight: 300, letterSpacing: 1, background: "linear-gradient(135deg, #9333ea, #1d4ed8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AI</span>
          </div>
          <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 4 }}>Willkommen zurück</p>
        </div>

        {/* Clerk Sign-In mit KANA-Farben */}
        <SignIn
          appearance={{
            variables: {
              colorPrimary: "#8b5cf6",
              colorBackground: "#0d0d26",
              colorInputBackground: "#07071a",
              colorText: "#f0f0ff",
              colorTextSecondary: "#9090b8",
              colorInputText: "#f0f0ff",
              colorNeutral: "#55557a",
              borderRadius: "10px",
              fontFamily: "Inter, sans-serif",
            },
            elements: {
              card: {
                background: "#0d0d26",
                border: "1px solid #2d2d70",
                borderRadius: "20px",
                boxShadow: "0 32px 80px rgba(0,0,0,.5)",
              },
              headerTitle: { color: "#f0f0ff" },
              headerSubtitle: { color: "#9090b8" },
              formButtonPrimary: {
                background: "linear-gradient(135deg, #9333ea, #1d4ed8)",
                border: "none",
              },
              footerActionLink: { color: "#a78bfa" },
              dividerLine: { background: "#1e1e4a" },
              dividerText: { color: "#55557a" },
              formFieldInput: {
                background: "#07071a",
                border: "1px solid #2d2d70",
                color: "#f0f0ff",
              },
              formFieldLabel: { color: "#9090b8" },
              identityPreviewText: { color: "#f0f0ff" },
              identityPreviewEditButton: { color: "#a78bfa" },
            },
          }}
        />
      </div>
    </div>
  );
}
