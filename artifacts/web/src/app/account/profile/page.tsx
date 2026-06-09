"use client";
import { useState, useEffect } from "react";
import { Camera, Save, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { customFetch } from "@workspace/api-client-react";
import { API_BASE_URL } from "@/lib/config";

export default function ProfilePage() {
  const { user, token, refreshUser } = useAuth();

  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    phone: "", gender: "male", birthday: "",
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) {
      const parts = user.name.split(" ");
      setForm(f => ({
        ...f,
        firstName: parts[0] ?? "",
        lastName: parts.slice(1).join(" "),
        email: user.email,
        phone: (user as any).phone ?? "",
        gender: (user as any).gender ?? "male",
        birthday: (user as any).birthday ?? "",
      }));
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await customFetch(`${API_BASE_URL}/api/auth/me`, {
        method: "PATCH",
        body: JSON.stringify({
          name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          phone: form.phone.trim() || undefined,
          gender: form.gender || undefined,
          birthday: form.birthday || undefined,
        }),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      await refreshUser();
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err: unknown) {
      setError((err as { data?: { error?: string } })?.data?.error ?? "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const initial = user?.name?.charAt(0).toUpperCase() ?? "U";

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">My Profile</h2>
      <div className="bg-white rounded-2xl border border-gray-100 p-4 sm:p-6">
        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative">
            <div className="w-20 h-20 sm:w-24 sm:h-24 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center overflow-hidden">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name ?? ""} className="w-full h-full object-cover" />
              ) : (
                <span className="text-white text-2xl sm:text-3xl font-bold">{initial}</span>
              )}
            </div>
            <button className="absolute bottom-0 right-0 w-7 h-7 sm:w-8 sm:h-8 bg-[#F0185A] rounded-full flex items-center justify-center border-2 border-white">
              <Camera className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
            </button>
          </div>
          <p className="text-sm font-bold text-gray-900 mt-3">{user?.name ?? "—"}</p>
          <p className="text-xs text-gray-400">{user?.email ?? ""}</p>
        </div>

        {error   && <div className="mb-4 p-3 bg-red-50   border border-red-100   rounded-xl text-sm text-red-600">{error}</div>}
        {success && <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-600">{success}</div>}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">First Name</label>
              <input
                type="text"
                value={form.firstName}
                onChange={e => setForm({ ...form, firstName: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Last Name</label>
              <input
                type="text"
                value={form.lastName}
                onChange={e => setForm({ ...form, lastName: e.target.value })}
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Email Address</label>
            <input
              type="email"
              value={form.email}
              disabled
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-gray-50 text-gray-400 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Phone Number</label>
            <input
              type="tel"
              value={form.phone}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="+880 1X XXXX XXXX"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Birthday</label>
            <input
              type="date"
              value={form.birthday}
              onChange={e => setForm({ ...form, birthday: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#F0185A] transition-colors"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Gender</label>
            <div className="flex gap-2 sm:gap-3">
              {["male", "female", "other"].map(g => (
                <label
                  key={g}
                  className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 cursor-pointer capitalize text-xs sm:text-sm transition-all ${
                    form.gender === g ? "border-[#F0185A] bg-pink-50 text-[#F0185A]" : "border-gray-200 text-gray-600"
                  }`}
                >
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={form.gender === g}
                    onChange={() => setForm({ ...form, gender: g })}
                    className="accent-[#F0185A]"
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#F0185A] hover:bg-[#c8124a] disabled:bg-pink-300 text-white px-8 py-3 rounded-xl font-semibold transition-colors"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Changes</>}
          </button>
        </form>
      </div>
    </div>
  );
}
