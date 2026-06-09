"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Eye, EyeOff, Loader2, CheckCircle } from "lucide-react";
import { API_BASE_URL } from "@/lib/config";

type Step = "email" | "reset" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) { setError("Please enter your email address."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to send reset code."); return; }
      setStep("reset");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim()) { setError("Please enter the reset code."); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (!/[A-Z]/.test(newPassword)) { setError("Password must contain at least one uppercase letter."); return; }
    if (!/[0-9]/.test(newPassword)) { setError("Password must contain at least one number."); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), code: code.trim(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to reset password."); return; }
      setStep("done");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-sm text-center">

          {step === "done" ? (
            <>
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-12 h-12 text-green-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h1>
              <p className="text-sm text-gray-500 mb-8">Your password has been updated successfully. You can now log in.</p>
              <Link href="/login" className="block w-full py-3 bg-[#F0185A] hover:bg-[#c8124a] text-white font-semibold rounded-xl transition-colors text-sm">
                Back to Login
              </Link>
            </>
          ) : step === "reset" ? (
            <>
              <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <KeyRound className="w-12 h-12 text-[#F0185A]" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Enter Reset Code</h1>
              <p className="text-sm text-gray-500 mb-8">
                We sent a 6-digit code to <strong>{email}</strong>. Enter it below along with your new password.
              </p>
              <form onSubmit={handleReset} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Reset Code</label>
                  <input
                    type="text"
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors tracking-widest text-center font-mono text-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      placeholder="Min 8 chars, 1 uppercase, 1 number"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors pr-12"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm Password</label>
                  <input
                    type="password"
                    placeholder="Repeat new password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors"
                  />
                </div>
                {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#F0185A] hover:bg-[#c8124a] disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Reset Password
                </button>
              </form>
              <button
                onClick={() => { setStep("email"); setError(""); setCode(""); setNewPassword(""); setConfirmPassword(""); }}
                className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#F0185A] transition-colors mt-6"
              >
                <ArrowLeft className="w-4 h-4" />
                Change email
              </button>
            </>
          ) : (
            <>
              <div className="w-24 h-24 bg-pink-50 rounded-full flex items-center justify-center mx-auto mb-6">
                <KeyRound className="w-12 h-12 text-[#F0185A]" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
              <p className="text-sm text-gray-500 mb-8">
                Enter your email address and we&apos;ll send you a PIN to reset your password.
              </p>
              <form onSubmit={handleSendCode} className="space-y-4 text-left">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
                  <input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F0185A] transition-colors"
                  />
                </div>
                {error && <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#F0185A] hover:bg-[#c8124a] disabled:opacity-60 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Reset Code
                </button>
              </form>
              <Link href="/login" className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#F0185A] transition-colors mt-6">
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </Link>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
