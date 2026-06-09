"use client";
import Link from "next/link";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { customFetch } from "@workspace/api-client-react";
import { API_BASE_URL } from "@/lib/config";
import { useAuth } from "@/context/AuthContext";
import type { AuthUser } from "@/context/AuthContext";
import { usePublicConfig } from "@/lib/usePublicConfig";

export default function RegisterPage() {
  const router = useRouter();
  const { setUserToken } = useAuth();
  const { data: appConfig } = usePublicConfig();
  const siteName = appConfig?.siteName || "Shohure";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [referralCode, setReferralCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) { setError("Passwords do not match."); return; }
    setError("");
    setLoading(true);

    if (!otpSent) {
      try {
        await customFetch(`${API_BASE_URL}/api/auth/send-verification`, {
          method: "POST",
          body: JSON.stringify({ email: email.trim().toLowerCase() }),
          headers: { "Content-Type": "application/json" },
        });
        setOtpSent(true);
      } catch (err: unknown) {
        setError((err as { data?: { error?: string } })?.data?.error ?? "Failed to send verification code.");
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const data = await customFetch<{ user: AuthUser; token: string }>(
        `${API_BASE_URL}/api/auth/register`,
        {
          method: "POST",
          body: JSON.stringify({
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            email: email.trim().toLowerCase(),
            password,
            phone: phone.trim() || undefined,
            verificationCode: otp.trim(),
            referralCode: referralCode.trim() || undefined,
          }),
          headers: { "Content-Type": "application/json" },
        },
      );
      setUserToken(data.user, data.token);
      router.push("/account");
    } catch (err: unknown) {
      setError((err as { data?: { error?: string } })?.data?.error ?? "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 max-w-4xl w-full bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="p-8 md:p-10">
          <div className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-[#F0185A] rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">{siteName.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-xl font-bold text-gray-900">{siteName}</span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create Account</h1>
          <p className="text-sm text-gray-500 mb-6">
            Already have an account? <Link href="/login" className="text-[#F0185A] font-medium hover:underline">Sign in</Link>
          </p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">First Name</label>
                <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} required placeholder="John" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Name</label>
                <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+880 1X XXXX XXXX" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
              <input type="email" value={email} onChange={e => { setEmail(e.target.value); setOtpSent(false); }} required placeholder="john@example.com" disabled={otpSent} className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors disabled:bg-gray-50 disabled:text-gray-400" />
            </div>

            {otpSent && (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  Verification Code <span className="text-gray-400 font-normal">— sent to {email}</span>
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  required
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors tracking-widest text-center font-bold"
                />
                <button type="button" onClick={() => setOtpSent(false)} className="text-xs text-[#F0185A] hover:underline mt-1">
                  Change email
                </button>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder="Create a strong password" autoComplete="new-password" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors pr-10" />
                <button type="button" onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm Password</label>
              <div className="relative">
                <input type={showConfirm ? "text" : "password"} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required placeholder="Confirm your password" autoComplete="new-password" className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors pr-10" />
                <button type="button" onClick={() => setShowConfirm(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                Referral Code <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={referralCode}
                onChange={e => setReferralCode(e.target.value.toUpperCase())}
                placeholder="Enter referral code"
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors tracking-widest"
              />
              <p className="text-xs text-gray-400 mt-1">Have a friend&apos;s referral code? Both of you earn bonus coins!</p>
            </div>

            <label className="flex items-start gap-2 text-xs text-gray-500 cursor-pointer">
              <input type="checkbox" required className="accent-[#F0185A] mt-0.5" />
              <span>I agree to {siteName}&apos;s <Link href="/terms" className="text-[#F0185A]">Terms of Service</Link> and <Link href="/privacy" className="text-[#F0185A]">Privacy Policy</Link></span>
            </label>
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#F0185A] hover:bg-[#c8124a] disabled:bg-pink-300 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {otpSent ? "Creating Account..." : "Sending Code..."}</>
              ) : (
                otpSent ? "Sign Up" : "Send Verification Code"
              )}
            </button>
          </form>

          <div className="relative my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">or sign up with</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <div className="flex gap-3">
            {[
              { name: "Google", icon: "G", bg: "bg-red-50 border-red-100 text-red-600" },
              { name: "Facebook", icon: "f", bg: "bg-blue-50 border-blue-100 text-blue-600" },
            ].map(s => (
              <button key={s.name} className={`flex-1 py-2.5 border rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:opacity-80 transition-opacity ${s.bg}`}>
                <span className="font-bold">{s.icon}</span>
                {s.name}
              </button>
            ))}
          </div>
        </div>

        <div className="relative bg-gradient-to-br from-pink-500 to-rose-400 p-10 hidden md:flex flex-col justify-center items-center text-center">
          <div className="w-28 h-28 bg-white/20 rounded-full flex items-center justify-center mb-6">
            <span className="text-6xl">🛒</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-3">Join {siteName}!</h2>
          <p className="text-pink-100 text-sm leading-relaxed mb-4">
            Create your free account and enjoy exclusive deals, fast delivery, and easy returns.
          </p>
          <div className="grid grid-cols-2 gap-3 w-full mt-2">
            {[
              { label: "10M+", sub: "Happy Customers" },
              { label: "50K+", sub: "Products" },
              { label: "500+", sub: "Brands" },
              { label: "100%", sub: "Authentic" },
            ].map((s, i) => (
              <div key={i} className="bg-white/20 rounded-xl p-3">
                <p className="text-lg font-bold text-white">{s.label}</p>
                <p className="text-xs text-pink-100">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
