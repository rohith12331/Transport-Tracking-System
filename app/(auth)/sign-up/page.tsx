"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { Eye, EyeOff, Loader2, ArrowRight, Users, Bus, ShieldCheck, Mail, Lock, User, Phone, KeyRound } from "lucide-react";

type Role = "passenger" | "driver" | "admin";

const ROLES = [
  {
    value: "passenger" as Role,
    label: "Passenger",
    desc: "Track buses & plan trips",
    icon: Users,
    color: "#06B6D4",
  },
  {
    value: "driver" as Role,
    label: "Driver",
    desc: "Navigate & report issues",
    icon: Bus,
    color: "#22C55E",
  },
  {
    value: "admin" as Role,
    label: "Admin",
    desc: "Manage the full fleet & system",
    icon: ShieldCheck,
    color: "#A855F7",
  },
];

const inputBase: React.CSSProperties = {
  width: "100%",
  height: "46px",
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: "8px",
  color: "#F9FAFB",
  padding: "0 16px 0 44px",
  fontSize: "14px",
  outline: "none",
  transition: "border-color 0.2s, box-shadow 0.2s",
};

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName]               = useState("");
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");
  const [password, setPassword]       = useState("");
  const [adminCode, setAdminCode]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole]               = useState<Role>("passenger");
  const [error, setError]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [focusField, setFocusField]   = useState<string | null>(null);

  const focusStyle: React.CSSProperties = {
    borderColor: "#6366F1",
    boxShadow: "0 0 10px rgba(99,102,241,0.3)",
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (role === "admin" && adminCode !== "12313883") { setError("Invalid Admin Secret Code."); return; }
    setLoading(true);
    try {
      const result = await signUp.email({
        name, email, password,
        // @ts-expect-error – additional fields
        role, phone,
        callbackURL: role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/passenger",
      });
      if (result.error) { setError(result.error.message ?? "Sign up failed."); return; }
      router.push(role === "admin" ? "/admin" : role === "driver" ? "/driver" : "/passenger");
      router.refresh();
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-extrabold tracking-tight" style={{ color: "#F9FAFB" }}>
          Create account
        </h2>
        <p className="mt-2 text-sm" style={{ color: "#9CA3AF" }}>
          Join the smart transit network today
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444" }}>
          <span className="w-2 h-2 rounded-full bg-[#EF4444] shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Role Selector */}
        <div className="space-y-2">
          <label className="block text-sm font-medium" style={{ color: "#F9FAFB" }}>I am a</label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map(({ value, label, desc, icon: Icon, color }) => {
              const selected = role === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRole(value)}
                  className="flex flex-col items-start gap-1.5 p-3 rounded-xl text-left transition-all"
                  style={{
                    background: selected ? "rgba(99,102,241,0.1)" : "transparent",
                    border: `1px solid ${selected ? "#6366F1" : "#374151"}`,
                    boxShadow: selected ? "0 0 12px rgba(99,102,241,0.2)" : "none",
                    transition: "all 0.2s ease",
                    cursor: "pointer",
                  }}
                >
                  <Icon className="h-4 w-4" style={{ color: selected ? color : "#6B7280" }} />
                  <span className="text-xs font-semibold" style={{ color: selected ? "#F9FAFB" : "#9CA3AF" }}>{label}</span>
                  <span className="text-[10px] leading-tight" style={{ color: "#6B7280" }}>{desc}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Admin Secret Code */}
        {role === "admin" && (
          <div className="space-y-1.5">
            <label className="block text-sm font-medium" style={{ color: "#A855F7" }}>Admin Secret Code</label>
            <div className="relative">
              <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#A855F7" }} />
              <input
                type="password"
                placeholder="Enter system secret code"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                onFocus={() => setFocusField("adminCode")}
                onBlur={() => setFocusField(null)}
                style={{
                  ...inputBase,
                  borderColor: "#A855F7",
                  ...(focusField === "adminCode" ? { boxShadow: "0 0 10px rgba(168,85,247,0.3)" } : {}),
                }}
              />
            </div>
          </div>
        )}

        {/* Name */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: "#F9FAFB" }}>Full name</label>
          <div className="relative">
            <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#6B7280" }} />
            <input
              placeholder="John Doe"
              value={name}
              required
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setFocusField("name")}
              onBlur={() => setFocusField(null)}
              style={{ ...inputBase, ...(focusField === "name" ? focusStyle : {}) }}
            />
          </div>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: "#F9FAFB" }}>Email address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#6B7280" }} />
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
              onFocus={() => setFocusField("email")}
              onBlur={() => setFocusField(null)}
              style={{ ...inputBase, ...(focusField === "email" ? focusStyle : {}) }}
            />
          </div>
        </div>

        {/* Phone */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: "#F9FAFB" }}>
            Phone <span style={{ color: "#6B7280" }}>(optional)</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#6B7280" }} />
            <input
              type="tel"
              placeholder="+91 98765 43210"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onFocus={() => setFocusField("phone")}
              onBlur={() => setFocusField(null)}
              style={{ ...inputBase, ...(focusField === "phone" ? focusStyle : {}) }}
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium" style={{ color: "#F9FAFB" }}>Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#6B7280" }} />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Min. 8 characters"
              value={password}
              required
              minLength={8}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setFocusField("password")}
              onBlur={() => setFocusField(null)}
              style={{ ...inputBase, paddingRight: "48px", ...(focusField === "password" ? focusStyle : {}) }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
              style={{ color: "#6B7280" }}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs" style={{ color: "#6B7280" }}>Minimum 8 characters required.</p>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full h-12 rounded-lg font-semibold text-white flex items-center justify-center gap-2 mt-1 disabled:opacity-60"
          style={{
            background: loading ? "#374151" : "linear-gradient(135deg, #6366F1, #A855F7)",
            transition: "all 0.3s ease",
            cursor: loading ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
              (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(99,102,241,0.4)";
            }
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = "";
            (e.currentTarget as HTMLButtonElement).style.boxShadow = "";
          }}
        >
          {loading
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <><span>Create Account</span><ArrowRight className="h-4 w-4" /></>
          }
        </button>
      </form>

      {/* Footer */}
      <div className="text-sm text-center space-y-2" style={{ color: "#6B7280" }}>
        <p>
          Already have an account?{" "}
          <Link href="/sign-in" className="font-semibold hover:opacity-80 transition-opacity" style={{ color: "#6366F1" }}>
            Sign in
          </Link>
        </p>
        <p>
          <Link href="/" className="hover:opacity-80 transition-opacity" style={{ color: "#6B7280" }}>
            ← Back to live map
          </Link>
        </p>
      </div>
    </div>
  );
}
