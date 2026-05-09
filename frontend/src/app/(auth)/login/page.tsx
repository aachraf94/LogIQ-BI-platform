"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Eye, EyeOff, LogIn, AlertCircle } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Mock auth — any @yalidine.dz email with 6+ char password works
    await new Promise((r) => setTimeout(r, 800));

    if (email.endsWith("@yalidine.dz") && password.length >= 6) {
      const name = email.split("@")[0].replace(".", " ").replace(/\b\w/g, (c) => c.toUpperCase());
      login(email, name, "Admin");
      router.push("/overview");
    } else {
      setError("Use a @yalidine.dz email with at least 6 characters password.");
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="w-full max-w-md"
    >
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[400px] rounded-full bg-secondary/5 blur-3xl" />
      </div>

      <div className="relative bg-[#1E2030] border border-[#2D3050] rounded-2xl p-8 shadow-2xl">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-4 shadow-lg shadow-primary/30">
            <span className="text-white font-black text-2xl">L</span>
          </div>
          <h1 className="text-2xl font-bold text-white">LOGIQ</h1>
          <p className="text-slate-400 text-sm mt-1">Logistics Intelligence Platform</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@yalidine.dz"
              required
              className="w-full bg-[#252840] border border-[#2D3050] rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#252840] border border-[#2D3050] rounded-xl px-4 py-3 pr-11 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary transition-colors"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs"
            >
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/80 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {loading ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <LogIn size={16} />
            )}
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-slate-600 mt-6">
          Demo credentials: any @yalidine.dz email + 6+ chars password
        </p>
      </div>
    </motion.div>
  );
}
