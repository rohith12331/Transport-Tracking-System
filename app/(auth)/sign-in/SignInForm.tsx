"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { signIn, authClient } from "@/lib/auth-client";
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react";

function getRoleDashboard(role?: string): string {
  if (role === "admin") return "/admin";
  if (role === "driver") return "/driver";
  return "/passenger";
}

export default function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get("redirect");

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [focusField, setFocusField]     = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn.email({ email, password });
      if (result.error) {
        setError(result.error.message ?? "Sign in failed.");
        return;
      }
      const session = await authClient.getSession();
      const role = (session.data?.user as { role?: string } | undefined)?.role;
      router.push(redirectParam ?? getRoleDashboard(role));
      router.refresh();
    } catch {
      setError("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const glowInputStyle = (field: string): React.CSSProperties => ({
    width: "100%",
    height: "50px",
    background: "rgba(0, 255, 255, 0.04)",
    border: `1px solid ${focusField === field ? "#06B6D4" : "rgba(6, 182, 212, 0.25)"}`,
    borderRadius: "8px",
    color: "#e2f8ff",
    padding: "0 16px",
    fontSize: "14px",
    outline: "none",
    transition: "all 0.25s ease",
    boxShadow: focusField === field ? "0 0 14px rgba(6, 182, 212, 0.3), inset 0 0 8px rgba(6, 182, 212, 0.05)" : "none",
    letterSpacing: "0.5px",
  });

  return (
    // Outer centered card
    <div
      style={{
        width: "100%",
        maxWidth: "780px",
        borderRadius: "20px",
        overflow: "hidden",
        boxShadow: "0 0 60px rgba(6,182,212,0.08), 0 20px 50px rgba(0,0,0,0.6)",
        border: "1px solid rgba(6,182,212,0.12)",
        display: "flex",
        minHeight: "440px",
      }}
    >
      {/* LEFT — Form Panel */}
      <div
        style={{
          flex: "1",
          background: "linear-gradient(160deg, #0d1a2a 0%, #0a1525 100%)",
          padding: "44px 48px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        {/* Back to home */}
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            color: "rgba(6,182,212,0.7)",
            fontSize: "13px",
            textDecoration: "none",
            marginBottom: "28px",
            transition: "color 0.2s",
          }}
        >
          <ArrowLeft size={14} /> Back to Home
        </Link>

        {/* Title */}
        <div style={{ marginBottom: "32px" }}>
          <h1
            style={{
              fontSize: "42px",
              fontWeight: "900",
              letterSpacing: "6px",
              textTransform: "uppercase",
              color: "#06B6D4",
              textShadow: "0 0 20px rgba(6,182,212,0.5), 0 0 40px rgba(6,182,212,0.25)",
              lineHeight: 1,
              marginBottom: "8px",
            }}
          >
            LOGIN
          </h1>
          <p style={{ color: "rgba(6,182,212,0.5)", fontSize: "13px", letterSpacing: "2px" }}>
            Welcome back, Commander.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            style={{
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#EF4444",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            required
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setFocusField("email")}
            onBlur={() => setFocusField(null)}
            style={glowInputStyle("email")}
          />

          <div style={{ position: "relative" }}>
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusField("password")}
              onBlur={() => setFocusField(null)}
              style={{ ...glowInputStyle("password"), paddingRight: "48px" }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: "absolute",
                right: "14px",
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                color: "rgba(6,182,212,0.5)",
                cursor: "pointer",
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%",
              height: "50px",
              borderRadius: "8px",
              background: loading
                ? "rgba(6,182,212,0.3)"
                : "linear-gradient(90deg, #06B6D4, #0891B2)",
              border: "none",
              color: "#fff",
              fontWeight: "700",
              fontSize: "14px",
              letterSpacing: "4px",
              textTransform: "uppercase",
              cursor: loading ? "not-allowed" : "pointer",
              boxShadow: "0 0 20px rgba(6,182,212,0.35)",
              transition: "all 0.3s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              marginTop: "4px",
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 30px rgba(6,182,212,0.55)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.transform = "";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(6,182,212,0.35)";
            }}
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : "INITIATE LOGIN"}
          </button>
        </form>

        {/* Footer */}
        <p style={{ marginTop: "20px", fontSize: "13px", color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
          New User?{" "}
          <Link
            href="/sign-up"
            style={{ color: "#06B6D4", textDecoration: "none", fontWeight: "600" }}
          >
            Initialize Protocol
          </Link>
        </p>
      </div>

      {/* RIGHT — Branding Panel */}
      <div
        style={{
          width: "280px",
          flexShrink: 0,
          background: "linear-gradient(160deg, #091523 0%, #0c1e30 100%)",
          borderLeft: "1px solid rgba(6,182,212,0.1)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 30px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Decorative glow circle */}
        <div style={{
          position: "absolute",
          width: "300px",
          height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
        }} />

        {/* Corner brackets */}
        <div style={{ position: "absolute", top: "20px", left: "20px", width: "20px", height: "20px", borderTop: "2px solid rgba(6,182,212,0.6)", borderLeft: "2px solid rgba(6,182,212,0.6)" }} />
        <div style={{ position: "absolute", top: "20px", right: "20px", width: "20px", height: "20px", borderTop: "2px solid rgba(6,182,212,0.6)", borderRight: "2px solid rgba(6,182,212,0.6)" }} />
        <div style={{ position: "absolute", bottom: "20px", left: "20px", width: "20px", height: "20px", borderBottom: "2px solid rgba(6,182,212,0.6)", borderLeft: "2px solid rgba(6,182,212,0.6)" }} />
        <div style={{ position: "absolute", bottom: "20px", right: "20px", width: "20px", height: "20px", borderBottom: "2px solid rgba(6,182,212,0.6)", borderRight: "2px solid rgba(6,182,212,0.6)" }} />

        <div style={{ position: "relative", textAlign: "center" }}>
          <p
            style={{
              fontSize: "38px",
              fontWeight: "900",
              letterSpacing: "8px",
              textTransform: "uppercase",
              color: "#06B6D4",
              textShadow: "0 0 25px rgba(6,182,212,0.6), 0 0 60px rgba(6,182,212,0.25)",
              lineHeight: "1.15",
            }}
          >
            SYSTEM<br />SECURE
          </p>
          <div style={{ width: "60px", height: "2px", background: "linear-gradient(90deg, transparent, #06B6D4, transparent)", margin: "20px auto 0" }} />
          <p style={{ color: "rgba(6,182,212,0.4)", fontSize: "11px", letterSpacing: "3px", marginTop: "14px", textTransform: "uppercase" }}>
            TransitTrack v2.0
          </p>
        </div>
      </div>
    </div>
  );
}
