"use client";

import { useEffect } from "react";

// Ildiz layout ishlamay qolganda: o‘z <html>/<body> va inline uslublar bilan.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="uz">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "#F7F7F2",
          color: "#17392E",
          fontFamily: 'Inter, "Segoe UI", Roboto, system-ui, sans-serif',
        }}
      >
        <title>Xato · Eco Point</title>
        <main style={{ maxWidth: 440, margin: "0 auto", padding: "48px 16px" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Ilovani ochib bo‘lmadi</h1>
          <p style={{ margin: "0 0 20px", lineHeight: 1.5 }}>
            Kutilmagan xato yuz berdi. Internet aloqasini tekshiring va «Qayta urinish»ni bosing.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              minHeight: 48,
              padding: "0 20px",
              borderRadius: 12,
              border: "none",
              background: "#176947",
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Qayta urinish
          </button>
        </main>
      </body>
    </html>
  );
}
