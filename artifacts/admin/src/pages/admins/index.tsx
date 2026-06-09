import React, { useState, useEffect } from "react";
import { useListUsers, useUpdateUserRole, getListUsersQueryKey } from "@workspace/api-client-react";
import { API_URL } from "@/lib/api-url";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCog, Shield, KeyRound, Mail, X, SlidersHorizontal, Check } from "lucide-react";

const TOKEN_KEY = "shohure_admin_token";
function getToken() { return localStorage.getItem(TOKEN_KEY) ?? ""; }

const roleColors: Record<string, string> = {
  owner: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  customer: "bg-gray-100 text-gray-700",
};

const PERMISSION_GROUPS = [
  {
    label: "Main Menu",
    items: [
      { key: "dashboard", label: "Dashboard" },
      { key: "orders", label: "Orders" },
      { key: "customers", label: "Customers" },
      { key: "chat", label: "Chat" },
    ],
  },
  {
    label: "Products",
    items: [
      { key: "products", label: "Products" },
      { key: "stock", label: "Stock" },
      { key: "categories", label: "Categories" },
      { key: "brands", label: "Brands" },
      { key: "reviews", label: "Reviews" },
    ],
  },
  {
    label: "Marketing",
    items: [
      { key: "coupons", label: "Coupons" },
      { key: "banners", label: "Banners" },
      { key: "flashSales", label: "Flash Sales" },
      { key: "promoCards", label: "Promo Cards" },
      { key: "notifications", label: "Notifications" },
    ],
  },
  {
    label: "Admin",
    items: [
      { key: "shipping", label: "Shipping Zones" },
      { key: "stores", label: "Stores" },
    ],
  },
];

const ALL_KEYS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key));

function buildDefaultPermissions(existing: Record<string, boolean> | null): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const key of ALL_KEYS) {
    result[key] = existing ? (existing[key] !== false) : true;
  }
  return result;
}

function PermissionsModal({ manager, onClose }: { manager: { id: number; name: string }; onClose: () => void }) {
  const { toast } = useToast();
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${API_URL}/api/users/${manager.id}/permissions`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.json())
      .then(data => {
        setPerms(buildDefaultPermissions(data.permissions ?? null));
      })
      .catch(() => {
        setPerms(buildDefaultPermissions(null));
      })
      .finally(() => setLoading(false));
  }, [manager.id]);

  const toggle = (key: string) => {
    setPerms(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const setAll = (value: boolean) => {
    const next: Record<string, boolean> = {};
    for (const key of ALL_KEYS) next[key] = value;
    setPerms(next);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/${manager.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ permissions: perms }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save");
      }
      toast({ title: `Permissions updated for ${manager.name}` });
      onClose();
    } catch (err: any) {
      toast({ title: err.message ?? "Failed to save permissions", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const allOn = ALL_KEYS.every(k => perms[k] !== false);
  const allOff = ALL_KEYS.every(k => perms[k] === false);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <SlidersHorizontal className="h-5 w-5 text-blue-600" />
              Manage Permissions
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Control what <span className="font-medium text-gray-700">{manager.name}</span> can access
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Quick actions */}
        <div className="px-6 py-3 border-b bg-gray-50 flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-gray-500 font-medium mr-1">Quick select:</span>
          <button
            onClick={() => setAll(true)}
            disabled={allOn}
            className="text-xs px-3 py-1 rounded-full border border-blue-300 text-blue-600 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Allow All
          </button>
          <button
            onClick={() => setAll(false)}
            disabled={allOff}
            className="text-xs px-3 py-1 rounded-full border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Deny All
          </button>
        </div>

        {/* Permission groups */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {loading ? (
            <div className="text-center py-10 text-gray-400 text-sm">Loading permissions…</div>
          ) : (
            PERMISSION_GROUPS.map(group => (
              <div key={group.label}>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{group.label}</h4>
                <div className="bg-gray-50 rounded-lg border divide-y divide-gray-100">
                  {group.items.map(item => {
                    const enabled = perms[item.key] !== false;
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggle(item.key)}
                      >
                        <span className="text-sm font-medium text-gray-700">{item.label}</span>
                        <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${enabled ? "bg-blue-600" : "bg-gray-300"}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-1"}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          {/* Note about owner-only sections */}
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
            <strong>Note:</strong> Settings and Manage Admins are always restricted to owners only and cannot be granted to managers.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex gap-2 flex-shrink-0">
          <Button onClick={handleSave} disabled={saving || loading} className="flex-1 gap-1.5">
            {saving ? "Saving…" : <><Check className="h-4 w-4" /> Save Permissions</>}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      toast({ title: "Password must be at least 8 characters with one uppercase letter and one number", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Password changed successfully" });
      onClose();
    } catch (err: any) {
      toast({ title: err.message ?? "Failed to change password", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-blue-600" /> Change Password
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min. 8 chars, 1 uppercase, 1 number" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat new password" required />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">{loading ? "Saving…" : "Change Password"}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ChangeEmailModal({ currentEmail, onClose }: { currentEmail: string; onClose: () => void }) {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !currentPassword) {
      toast({ title: "All fields are required", variant: "destructive" });
      return;
    }
    if (newEmail.toLowerCase() === currentEmail.toLowerCase()) {
      toast({ title: "New email is the same as current email", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/auth/change-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword, newEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast({ title: "Email changed successfully. Logging you out…" });
      onClose();
      setTimeout(() => logout(), 1500);
    } catch (err: any) {
      toast({ title: err.message ?? "Failed to change email", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Mail className="h-5 w-5 text-blue-600" /> Change Email
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
        </div>
        <p className="text-sm text-gray-500">Current email: <span className="font-medium text-gray-700">{currentEmail}</span></p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Email Address</label>
            <Input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="new@example.com" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password (to confirm)</label>
            <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter your password" required />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">{loading ? "Saving…" : "Change Email"}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Admins() {
  const { data, isLoading } = useListUsers();
  const updateRole = useUpdateUserRole();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [permissionsManager, setPermissionsManager] = useState<{ id: number; name: string } | null>(null);

  const handleRoleChange = (id: number, role: string) => {
    updateRole.mutate({ id, data: { role: role as any } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast({ title: "Role updated" });
      },
      onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
    });
  };

  const users = ((data as any)?.users ?? []).filter((u: any) => u.role !== "customer");

  return (
    <div className="space-y-6">
      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showEmailModal && (
        <ChangeEmailModal
          currentEmail={currentUser?.email ?? ""}
          onClose={() => setShowEmailModal(false)}
        />
      )}
      {permissionsManager && (
        <PermissionsModal
          manager={permissionsManager}
          onClose={() => setPermissionsManager(null)}
        />
      )}

      <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
        <UserCog className="h-7 w-7" /> Manage Admins
      </h2>
      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Current Role</th>
                  <th className="px-6 py-4">Joined</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium flex items-center gap-2">
                      {u.role === "owner" && <Shield className="h-4 w-4 text-purple-500" />}
                      {u.name}
                      {u.id === currentUser?.id && <span className="text-xs text-gray-400">(you)</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColors[u.role] || ""}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs">{new Date(u.createdAt).toLocaleDateString("en-BD")}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        {u.id === currentUser?.id && (
                          <>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowEmailModal(true)}>
                              <Mail className="h-3 w-3" /> Change Email
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowPasswordModal(true)}>
                              <KeyRound className="h-3 w-3" /> Change Password
                            </Button>
                          </>
                        )}
                        {u.id !== currentUser?.id && (
                          <>
                            {u.role === "manager" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
                                onClick={() => setPermissionsManager({ id: u.id, name: u.name })}
                              >
                                <SlidersHorizontal className="h-3 w-3" /> Permissions
                              </Button>
                            )}
                            <select
                              className="border rounded-md px-2 py-1 text-sm"
                              value={u.role}
                              onChange={(e) => handleRoleChange(u.id, e.target.value)}
                              disabled={updateRole.isPending}
                            >
                              <option value="customer">Customer</option>
                              <option value="manager">Manager</option>
                              <option value="owner">Owner</option>
                            </select>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!users.length && (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-500">No users found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
