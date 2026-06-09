"use client";
import Link from "next/link";
import { useState, Suspense, useEffect, useRef } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import { usePublicConfig } from "@/lib/usePublicConfig";
import { API_BASE_URL } from "@/lib/config";
import type { AuthUser } from "@/context/AuthContext";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (r: { credential: string }) => void; auto_select?: boolean }) => void;
          renderButton: (el: HTMLElement, cfg: object) => void;
          prompt: () => void;
        };
      };
    };
  }
}

function GoogleButton({ onSuccess }: { onSuccess: (token: string) => void }) {
  const { data: config } = usePublicConfig();
  const btnRef = useRef<HTMLDivElement>(null);
  const clientId = config?.googleClientId ?? config?.googleWebClientId;

  useEffect(() => {
    if (!clientId || !btnRef.current) return;
    const el = document.createElement("script");
    el.src = "https://accounts.google.com/gsi/client";
    el.async = true;
    el.onload = () => {
      if (!window.google || !btnRef.current) return;
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (r) => onSuccess(r.credential),
      });
      window.google.accounts.id.renderButton(btnRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "signin_with",
        shape: "rectangular",
        width: "100%",
      });
    };
    document.head.appendChild(el);
    return () => { document.head.removeChild(el); };
  }, [clientId, onSuccess]);

  if (!clientId) return null;
  return <div ref={btnRef} className="w-full" />;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, setUserToken } = useAuth();
  const { data: appConfig } = usePublicConfig();
  const siteName = appConfig?.siteName || "Shohure";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  const rawReturnTo = searchParams.get("returnTo") ?? "/account";
  const returnTo = rawReturnTo.startsWith("/") && !rawReturnTo.startsWith("//") ? rawReturnTo : "/account";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      await login(email.trim().toLowerCase(), password);
      router.push(returnTo);
    } catch (err: unknown) {
      setError(
        (err as { data?: { error?: string } })?.data?.error ??
          "Invalid email or password.",
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (idToken: string) => {
    setGoogleLoading(true);
    setError("");
    try {
      const data = await customFetch<{ user: AuthUser; token: string }>(
        `${API_BASE_URL}/api/auth/google`,
        {
          method: "POST",
          body: JSON.stringify({ idToken }),
          headers: { "Content-Type": "application/json" },
        },
      );
      setUserToken(data.user, data.token);
      router.push(returnTo);
    } catch (err: unknown) {
      setError((err as { data?: { error?: string } })?.data?.error ?? "Google sign-in failed. Please try again.");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="p-8 md:p-10">
      <div className="flex items-center gap-2 mb-8">
        <div className="w-8 h-8 bg-[#F0185A] rounded-lg flex items-center justify-center">
          <span className="text-white text-sm font-bold">{siteName.charAt(0).toUpperCase()}</span>
        </div>
        <span className="text-xl font-bold text-gray-900">{siteName}</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-1">Login to your account</h1>
      <p className="text-sm text-gray-500 mb-6">
        Don&apos;t have an account? <Link href="/register" className="text-[#F0185A] font-medium hover:underline">Sign up</Link>
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          {error}
        </div>
      )}

      {googleLoading && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-600 flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Signing in with Google...
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email or Phone</label>
          <input
            type="text"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Enter your email or phone"
            autoComplete="email"
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors pr-10"
            />
            <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input type="checkbox" className="accent-[#F0185A]" />
            Remember me
          </label>
          <Link href="/forgot-password" className="text-sm text-[#F0185A] hover:underline">Forgot Password?</Link>
        </div>

        <button
          type="submit"
          disabled={loading || googleLoading}
          className="w-full py-3 bg-[#F0185A] hover:bg-[#c8124a] disabled:bg-pink-300 text-white font-semibold rounded-xl transition-colors mt-2 flex items-center justify-center gap-2"
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</> : "Login"}
        </button>
      </form>

      <div className="relative my-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-gray-100" />
        <span className="text-xs text-gray-400">or sign in with</span>
        <div className="flex-1 h-px bg-gray-100" />
      </div>

      <div className="space-y-2">
        <GoogleButton onSuccess={handleGoogleSuccess} />
      </div>

      <p className="text-xs text-gray-400 text-center mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-[#F0185A] font-medium hover:underline">Sign up for free</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-w-4xl w-full bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="relative bg-gradient-to-br from-pink-500 to-rose-400 p-10 hidden md:flex flex-col justify-center items-center text-center">
          <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6">
            <span className="text-5xl">🛍️</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Welcome Back!</h2>
          <p className="text-pink-100 text-sm leading-relaxed mb-6">
            Sign in to your account to track orders, manage wishlist, and enjoy exclusive deals.
          </p>
          <div className="absolute bottom-8 flex gap-2">
            {[0,1,2].map(i => <div key={i} className={`w-2 h-2 rounded-full ${i === 0 ? "bg-white" : "bg-white/40"}`} />)}
          </div>
        </div>

        <Suspense fallback={<div className="p-8 md:p-10 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-[#F0185A]" /></div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
