export default function AnimatedBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* FIX 1: Stronger orbs — increased opacity and chroma so they're actually visible */}
      {/* Orb 1 — indigo, top-right */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          right: "-5%",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, oklch(0.68 0.18 265 / 0.28) 0%, transparent 68%)",
          filter: "blur(50px)",
          animation: "orb-float-1 18s ease-in-out infinite",
        }}
      />
      {/* Orb 2 — sky blue, bottom-left */}
      <div
        style={{
          position: "absolute",
          bottom: "-15%",
          left: "-10%",
          width: "56vw",
          height: "56vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, oklch(0.74 0.16 222 / 0.22) 0%, transparent 68%)",
          filter: "blur(65px)",
          animation: "orb-float-2 22s ease-in-out infinite",
        }}
      />
      {/* Orb 3 — violet, center-right */}
      <div
        style={{
          position: "absolute",
          top: "30%",
          right: "8%",
          width: "32vw",
          height: "32vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, oklch(0.70 0.17 292 / 0.18) 0%, transparent 68%)",
          filter: "blur(55px)",
          animation: "orb-float-3 16s ease-in-out infinite",
        }}
      />
      {/* Orb 4 — pale emerald, center-left */}
      <div
        style={{
          position: "absolute",
          top: "55%",
          left: "8%",
          width: "28vw",
          height: "28vw",
          borderRadius: "50%",
          background:
            "radial-gradient(circle, oklch(0.72 0.14 162 / 0.16) 0%, transparent 68%)",
          filter: "blur(50px)",
          animation: "orb-float-4 20s ease-in-out infinite",
        }}
      />
    </div>
  );
}
