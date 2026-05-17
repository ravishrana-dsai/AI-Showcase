"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      router.push("/admin");
    } else {
      setError(true);
    }
  };

  return (
    <main style={styles.root}>
      <div style={styles.card}>
        <div style={styles.brand}>
          <span style={styles.brandDot} />
          <span style={styles.brandName}>[Company]</span>
        </div>
        <h1 style={styles.heading}>Admin Access</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            placeholder="Enter admin PIN"
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(false); }}
            style={{
              ...styles.input,
              ...(error ? styles.inputError : {}),
            }}
            autoFocus
          />
          {error && <p style={styles.errorText}>Incorrect PIN</p>}
          <button type="submit" style={styles.btn}>
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#0F1117",
  },
  card: {
    width: 360,
    background: "#181C27",
    border: "1px solid #2A2F3D",
    borderRadius: 16,
    padding: "40px 32px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  brandDot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#00C2FF",
  },
  brandName: {
    fontSize: 13,
    fontWeight: 600,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#8B93A8",
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    color: "#F0F4FF",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  input: {
    padding: "12px 14px",
    background: "#1F2433",
    border: "1px solid #2A2F3D",
    borderRadius: 8,
    color: "#F0F4FF",
    fontSize: 15,
    outline: "none",
  },
  inputError: {
    border: "1px solid rgba(239,68,68,0.5)",
  },
  errorText: {
    fontSize: 13,
    color: "#EF4444",
  },
  btn: {
    padding: "12px",
    background: "#00C2FF",
    border: "none",
    borderRadius: 8,
    color: "#000",
    fontWeight: 700,
    fontSize: 15,
    marginTop: 4,
  },
};
