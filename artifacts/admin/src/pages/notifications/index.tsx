import React, { useState, useEffect, useRef } from "react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  useBroadcastNotification,
  useSendNotification,
  useListUsers,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Bell,
  Send,
  Users,
  Smartphone,
  Megaphone,
  CheckCircle2,
  Megaphone as NoticeIcon,
  User,
  Search,
  X,
  Clock,
  Plus,
  Trash2,
  CalendarClock,
  BarChart2,
  History,
  CheckCircle2 as HistoryCheckIcon,
} from "lucide-react";
import { API_URL } from "@/lib/api-url";
import { firestoreDb } from "@/lib/firebase";
import { doc, onSnapshot, setDoc } from "firebase/firestore";

const QUICK_TEMPLATES = [
  {
    label: "Flash Sale",
    title: "🔥 Flash Sale is Live!",
    body: "Up to 50% off on selected items. Hurry — limited time only!",
    type: "promotion",
  },
  {
    label: "New Arrivals",
    title: "✨ New Products Just Arrived",
    body: "Check out the latest additions to our collection. Shop now before they sell out!",
    type: "general",
  },
  {
    label: "Order Reminder",
    title: "🛒 Don't forget your cart!",
    body: "You have items waiting in your cart. Complete your order today and get free delivery.",
    type: "reminder",
  },
  {
    label: "Eid Greetings",
    title: "🌙 Eid Mubarak from Shohure!",
    body: "Wishing you and your family a joyful Eid. Enjoy special discounts with code EID2026.",
    type: "general",
  },
  {
    label: "Coupon Drop",
    title: "🎁 Exclusive Coupon Just for You",
    body: "Use code SHOHURE10 for 10% off your next order. Valid for 48 hours only!",
    type: "promotion",
  },
];

function NoticeBoard() {
  const { toast } = useToast();
  const [noticeText, setNoticeText] = useState("");
  const [currentNotice, setCurrentNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!firestoreDb) return;
    const unsub = onSnapshot(
      doc(firestoreDb, "notices", "main"),
      (snap) => {
        if (snap.exists()) {
          const msg = snap.data().message ?? "";
          setCurrentNotice(msg || null);
        } else {
          setCurrentNotice(null);
        }
      },
      () => {}
    );
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!noticeText.trim() || !firestoreDb) return;
    setSaving(true);
    try {
      await setDoc(doc(firestoreDb, "notices", "main"), {
        message: noticeText.trim(),
        updatedAt: new Date().toISOString(),
      });
      setCurrentNotice(noticeText.trim());
      toast({ title: "Notice published! Mobile app will update in real-time." });
      setNoticeText("");
    } catch (err: any) {
      toast({ title: "Failed to save: " + (err?.message ?? "Check Firestore security rules"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    if (!firestoreDb) return;
    setSaving(true);
    try {
      await setDoc(doc(firestoreDb, "notices", "main"), { message: "", updatedAt: new Date().toISOString() });
      setCurrentNotice(null);
      toast({ title: "Notice cleared." });
    } catch {
      toast({ title: "Failed to clear notice", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <NoticeIcon className="h-4 w-4 text-orange-600" /> Live Notice Board
        </CardTitle>
        <CardDescription>Write a message that instantly appears on the mobile app in real-time via Firestore.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {currentNotice && (
          <div className="flex items-start justify-between gap-2 bg-white border border-orange-200 rounded-lg px-3 py-2 text-sm">
            <span className="text-gray-700 flex-1">📢 <span className="font-medium">Current:</span> {currentNotice}</span>
            <button onClick={handleClear} className="text-xs text-red-500 hover:underline flex-shrink-0" disabled={saving}>Clear</button>
          </div>
        )}
        <Textarea
          value={noticeText}
          onChange={(e) => setNoticeText(e.target.value)}
          placeholder="e.g. 🎉 Eid Special: Free delivery all week!"
          rows={2}
          maxLength={200}
        />
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400">{noticeText.length}/200 characters</p>
          <Button size="sm" onClick={handleSave} disabled={saving || !noticeText.trim()}>
            {saving ? "Publishing…" : "Publish Notice"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

type UserResult = {
  id: number;
  name: string;
  email: string;
  avatarUrl?: string | null;
};

function SendToUserSection() {
  const { toast } = useToast();
  const sendNotification = useSendNotification();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", type: "general" });
  const [sending, setSending] = useState(false);
  const [lastResult, setLastResult] = useState<{ sent: number; pushSent: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: usersPage } = useListUsers(
    { search: debouncedSearch || undefined },
    {
      query: {
        enabled: debouncedSearch.length >= 2,
        queryKey: getListUsersQueryKey({ search: debouncedSearch || undefined }),
      },
    }
  );

  const users: UserResult[] = (usersPage?.users ?? []) as UserResult[];
  const selectedIds = new Set(selectedUsers.map((u) => u.id));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleAddUser = (u: UserResult) => {
    if (!selectedIds.has(u.id)) {
      setSelectedUsers((prev) => [...prev, u]);
    }
    setSearch("");
    setShowDropdown(false);
    setLastResult(null);
  };

  const handleRemoveUser = (id: number) => {
    setSelectedUsers((prev) => prev.filter((u) => u.id !== id));
    setLastResult(null);
  };

  const handleClearAll = () => {
    setSelectedUsers([]);
    setSearch("");
    setLastResult(null);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedUsers.length === 0) {
      toast({ title: "Please search and select at least one user", variant: "destructive" });
      return;
    }
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: "Please fill in both title and message", variant: "destructive" });
      return;
    }

    setSending(true);
    try {
      // Send all selected users in a single batched API call
      const result: any = await new Promise((resolve, reject) => {
        sendNotification.mutate(
          {
            data: {
              userIds: selectedUsers.map(u => u.id),
              title: form.title.trim(),
              body: form.body.trim(),
              type: form.type,
            } as any,
          },
          { onSuccess: resolve, onError: reject }
        );
      });
      const totalSent: number = result?.sent ?? selectedUsers.length;
      const totalPush: number = result?.pushSent ?? 0;
      setLastResult({ sent: totalSent, pushSent: totalPush });
      toast({
        title: `Sent to ${totalSent} user${totalSent !== 1 ? "s" : ""}`,
        description: totalPush > 0 ? `${totalPush} push notification${totalPush !== 1 ? "s" : ""} delivered` : "No push tokens on file",
      });
      setForm({ title: "", body: "", type: "general" });
      setSelectedUsers([]);
    } catch {
      toast({ title: "Failed to send notifications", variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <User className="h-4 w-4 text-blue-600" />
          Send to Specific Users
        </CardTitle>
        <CardDescription>
          Search and select one or more customers, then send them the same notification.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">
                Find Users
                {selectedUsers.length > 0 && (
                  <Badge className="ml-2 bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
                    {selectedUsers.length} selected
                  </Badge>
                )}
              </label>
              {selectedUsers.length > 0 && (
                <button type="button" onClick={handleClearAll} className="text-xs text-red-500 hover:underline">
                  Clear all
                </button>
              )}
            </div>

            {/* Selected user chips */}
            {selectedUsers.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                {selectedUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-1.5 bg-white border border-blue-200 rounded-full px-2.5 py-1 text-sm"
                  >
                    <Avatar className="h-5 w-5 flex-shrink-0">
                      <AvatarImage src={u.avatarUrl || undefined} />
                      <AvatarFallback className="text-[9px] bg-blue-100 text-blue-600">
                        {u.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-gray-800 max-w-[100px] truncate">{u.name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveUser(u.id)}
                      className="text-gray-400 hover:text-red-500 ml-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Search input */}
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShowDropdown(true);
                    setLastResult(null);
                  }}
                  onFocus={() => { if (debouncedSearch.length >= 2) setShowDropdown(true); }}
                  placeholder="Search by name or email to add more…"
                  className="pl-9 pr-8"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => { setSearch(""); setShowDropdown(false); }}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {showDropdown && users.length > 0 && (
                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                  {users.map((u) => {
                    const isAdded = selectedIds.has(u.id);
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={isAdded}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 transition-colors text-left ${
                          isAdded ? "bg-gray-50 cursor-not-allowed opacity-50" : "hover:bg-blue-50"
                        }`}
                        onClick={() => !isAdded && handleAddUser(u)}
                      >
                        <Avatar className="h-7 w-7 flex-shrink-0">
                          <AvatarImage src={u.avatarUrl || undefined} />
                          <AvatarFallback className="text-xs bg-blue-100 text-blue-600">
                            {u.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                          <p className="text-xs text-gray-500 truncate">{u.email}</p>
                        </div>
                        {isAdded && (
                          <Badge variant="secondary" className="text-xs flex-shrink-0">Added</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Your order has been shipped!"
              maxLength={100}
            />
            <p className="text-xs text-gray-400 mt-1">{form.title.length}/100 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <Textarea
              value={form.body}
              onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
              placeholder="Write your message here…"
              rows={3}
              maxLength={300}
            />
            <p className="text-xs text-gray-400 mt-1">{form.body.length}/300 characters</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="general">General</option>
              <option value="promotion">Promotion</option>
              <option value="order">Order Update</option>
              <option value="reminder">Reminder</option>
              <option value="system">System</option>
            </select>
          </div>

          {lastResult && (
            <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="text-green-800">
                Sent to {lastResult.sent} user{lastResult.sent !== 1 ? "s" : ""}
                {lastResult.pushSent > 0
                  ? ` · ${lastResult.pushSent} push delivered`
                  : " · No push tokens on file"}
              </span>
            </div>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={sending || selectedUsers.length === 0 || !form.title.trim() || !form.body.trim()}
          >
            {sending ? (
              "Sending…"
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send to {selectedUsers.length > 0
                  ? `${selectedUsers.length} User${selectedUsers.length !== 1 ? "s" : ""}`
                  : "Selected Users"}
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const TOKEN_KEY = "shohure_admin_token";
const DAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];

function NotificationAnalyticsCard() {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const getToken = () => localStorage.getItem(TOKEN_KEY);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/admin/notifications/analytics?days=30`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        if (res.ok) setAnalytics(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, []);

  if (loading || !analytics) return null;
  const { daily, summary } = analytics;
  if (!daily?.length) return null;

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-white to-indigo-50/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-indigo-600" />
          Notification Analytics — Last 30 Days
        </CardTitle>
        <CardDescription>Sent vs Read counts and open rate trend</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Sent", value: (summary.totalSent ?? 0).toLocaleString(), color: "indigo" },
            { label: "Total Read", value: (summary.totalRead ?? 0).toLocaleString(), color: "emerald" },
            { label: "Open Rate", value: `${summary.avgOpenRate ?? 0}%`, color: "amber" },
            { label: "Active Schedules", value: String(summary.activeCampaigns ?? 0), color: "violet" },
          ].map(stat => (
            <div key={stat.label} className={`text-center p-3 bg-white rounded-xl border border-${stat.color}-100`}>
              <p className={`text-xl font-bold text-${stat.color}-600`}>{stat.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{stat.label}</p>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={230}>
          <ComposedChart data={daily} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f4ff" />
            <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} />
            <YAxis yAxisId="right" orientation="right" tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 10 }} domain={[0, 100]} />
            <Tooltip
              formatter={(value: any, name: string) =>
                name === "openRate" ? [`${value}%`, "Open Rate"] :
                name === "sent" ? [Number(value).toLocaleString(), "Sent"] :
                [Number(value).toLocaleString(), "Read"]
              }
              labelFormatter={(l: string) => `Date: ${l}`}
            />
            <Legend
              formatter={(v: string) => v === "sent" ? "Sent" : v === "read" ? "Read" : "Open Rate %"}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Bar yAxisId="left" dataKey="sent" fill="#818cf8" radius={[3,3,0,0]} />
            <Bar yAxisId="left" dataKey="read" fill="#34d399" radius={[3,3,0,0]} />
            <Line yAxisId="right" type="monotone" dataKey="openRate" stroke="#f59e0b" strokeWidth={2} dot={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function ScheduledNotificationsSection() {
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", body: "", type: "promotion",
    scheduleType: "daily", scheduleTime: "09:00",
    scheduleDayOfWeek: 1, scheduleDayOfMonth: 1, scheduledAt: "",
    target: "all",
  });
  const [selectedUsers, setSelectedUsers] = useState<UserResult[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [debouncedUserSearch, setDebouncedUserSearch] = useState("");
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedUserSearch(userSearch), 300);
    return () => clearTimeout(t);
  }, [userSearch]);

  const { data: userSearchPage } = useListUsers(
    { search: debouncedUserSearch || undefined },
    { query: { enabled: debouncedUserSearch.length >= 2, queryKey: getListUsersQueryKey({ search: debouncedUserSearch || undefined }) } }
  );
  const scheduledUserResults: UserResult[] = (userSearchPage?.users ?? []) as UserResult[];

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(e.target as Node)) setShowUserDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const getToken = () => localStorage.getItem(TOKEN_KEY);

  const load = async () => {
    try {
      const res = await fetch(`${API_URL}/api/admin/scheduled-notifications`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (res.ok) setSchedules(await res.json());
    } catch {}
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const resetForm = () => {
    setForm({ title: "", body: "", type: "promotion", scheduleType: "daily", scheduleTime: "09:00", scheduleDayOfWeek: 1, scheduleDayOfMonth: 1, scheduledAt: "", target: "all" });
    setSelectedUsers([]);
    setUserSearch("");
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.target === "specific" && selectedUsers.length === 0) {
      toast({ title: "Please select at least one user for Specific target", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title.trim(), body: form.body.trim(),
        type: form.type, scheduleType: form.scheduleType, scheduleTime: form.scheduleTime,
        target: form.target,
        targetUserIds: form.target === "specific" ? selectedUsers.map(u => u.id) : [],
      };
      if (form.scheduleType === "weekly") payload.scheduleDayOfWeek = form.scheduleDayOfWeek;
      if (form.scheduleType === "monthly") payload.scheduleDayOfMonth = form.scheduleDayOfMonth;
      if (form.scheduleType === "once") payload.scheduledAt = form.scheduledAt;
      const res = await fetch(`${API_URL}/api/admin/scheduled-notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const created = await res.json();
        setSchedules(prev => [created, ...prev]);
        setShowForm(false);
        resetForm();
        toast({ title: "Schedule created!" });
      } else {
        const err = await res.json().catch(() => ({}));
        toast({ title: err.error ?? "Failed to create", variant: "destructive" });
      }
    } catch { toast({ title: "Network error", variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleToggle = async (id: number, isActive: boolean) => {
    const res = await fetch(`${API_URL}/api/admin/scheduled-notifications/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
      body: JSON.stringify({ isActive: !isActive }),
    }).catch(() => null);
    if (res?.ok) setSchedules(prev => prev.map(s => s.id === id ? { ...s, isActive: !isActive } : s));
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`${API_URL}/api/admin/scheduled-notifications/${id}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${getToken()}` },
    }).catch(() => null);
    if (res?.ok) { setSchedules(prev => prev.filter(s => s.id !== id)); toast({ title: "Schedule deleted" }); }
  };

  const describeSchedule = (s: any) => {
    if (s.scheduleType === "once") return `Once on ${new Date(s.scheduledAt).toLocaleString()}`;
    if (s.scheduleType === "daily") return `Daily at ${s.scheduleTime}`;
    if (s.scheduleType === "weekly") return `Every ${DAY_NAMES[s.scheduleDayOfWeek] ?? "?"} at ${s.scheduleTime}`;
    if (s.scheduleType === "monthly") return `Monthly on day ${s.scheduleDayOfMonth} at ${s.scheduleTime}`;
    return s.scheduleType;
  };

  const getTargetCount = (s: any) => {
    try { return JSON.parse(s.targetUserIds ?? "[]").length; } catch { return 0; }
  };

  return (
    <Card className="border-violet-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-violet-600" />
              Scheduled Notifications
            </CardTitle>
            <CardDescription>Auto-send on a recurring or one-time schedule — to all or specific users</CardDescription>
          </div>
          <Button size="sm" variant="outline" className="border-violet-300 text-violet-700 hover:bg-violet-50" onClick={() => { setShowForm(v => !v); if (showForm) resetForm(); }}>
            {showForm ? <><X className="h-3.5 w-3.5 mr-1" />Cancel</> : <><Plus className="h-3.5 w-3.5 mr-1" />New Schedule</>}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <form onSubmit={handleCreate} className="space-y-3 border border-violet-200 rounded-xl p-4 bg-violet-50/60">
            <p className="text-sm font-semibold text-violet-800 flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" />New Scheduled Notification</p>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Title</label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. 🔥 Weekend Sale!" maxLength={100} required />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Message</label>
              <Textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Write your message…" rows={2} maxLength={300} required />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="general">General</option>
                  <option value="promotion">Promotion</option>
                  <option value="reminder">Reminder</option>
                  <option value="system">System</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Repeat</label>
                <select value={form.scheduleType} onChange={e => setForm(f => ({ ...f, scheduleType: e.target.value }))} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="once">Once (one-time)</option>
                </select>
              </div>
            </div>

            {form.scheduleType !== "once" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Time (24h)</label>
                  <Input type="time" value={form.scheduleTime} onChange={e => setForm(f => ({ ...f, scheduleTime: e.target.value }))} required />
                </div>
                {form.scheduleType === "weekly" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Day of Week</label>
                    <select value={form.scheduleDayOfWeek} onChange={e => setForm(f => ({ ...f, scheduleDayOfWeek: parseInt(e.target.value) }))} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                )}
                {form.scheduleType === "monthly" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Day of Month</label>
                    <select value={form.scheduleDayOfMonth} onChange={e => setForm(f => ({ ...f, scheduleDayOfMonth: parseInt(e.target.value) }))} className="w-full border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}
              </div>
            )}
            {form.scheduleType === "once" && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date &amp; Time</label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} required />
              </div>
            )}

            {/* ── Target ── */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Send To</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, target: "all" }))}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${form.target === "all" ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-300 hover:border-violet-400"}`}>
                  👥 All Users
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, target: "specific" }))}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${form.target === "specific" ? "bg-violet-600 text-white border-violet-600" : "bg-white text-gray-600 border-gray-300 hover:border-violet-400"}`}>
                  🎯 Specific Users
                </button>
              </div>
            </div>

            {form.target === "specific" && (
              <div className="rounded-lg border border-violet-200 bg-white p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-gray-700">
                    Find Users
                    {selectedUsers.length > 0 && <span className="ml-1.5 text-violet-600 font-semibold">({selectedUsers.length} selected)</span>}
                  </label>
                  {selectedUsers.length > 0 && (
                    <button type="button" onClick={() => setSelectedUsers([])} className="text-[10px] text-red-500 hover:underline">Clear all</button>
                  )}
                </div>
                {selectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-violet-50 border border-violet-100 rounded-lg">
                    {selectedUsers.map(u => (
                      <div key={u.id} className="flex items-center gap-1 bg-white border border-violet-200 rounded-full px-2 py-0.5">
                        <span className="text-[11px] font-medium text-gray-800 max-w-[90px] truncate">{u.name}</span>
                        <button type="button" onClick={() => setSelectedUsers(prev => prev.filter(x => x.id !== u.id))} className="text-gray-400 hover:text-red-500 ml-0.5">
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="relative" ref={userDropdownRef}>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
                    <Input
                      value={userSearch}
                      onChange={e => { setUserSearch(e.target.value); setShowUserDropdown(true); }}
                      onFocus={() => { if (debouncedUserSearch.length >= 2) setShowUserDropdown(true); }}
                      placeholder="Search by name or email…"
                      className="pl-8 h-8 text-xs"
                    />
                  </div>
                  {showUserDropdown && scheduledUserResults.length > 0 && (
                    <div className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                      {scheduledUserResults.map(u => {
                        const isAdded = selectedUsers.some(x => x.id === u.id);
                        return (
                          <button key={u.id} type="button" disabled={isAdded}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${isAdded ? "opacity-40 cursor-not-allowed" : "hover:bg-violet-50"}`}
                            onClick={() => { if (!isAdded) { setSelectedUsers(prev => [...prev, u]); setUserSearch(""); setShowUserDropdown(false); } }}>
                            <Avatar className="h-6 w-6 flex-shrink-0">
                              <AvatarImage src={u.avatarUrl || undefined} />
                              <AvatarFallback className="text-[9px] bg-violet-100 text-violet-600">{u.name.charAt(0).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-gray-900 truncate">{u.name}</p>
                              <p className="text-[10px] text-gray-400 truncate">{u.email}</p>
                            </div>
                            {isAdded && <Badge variant="secondary" className="text-[10px] flex-shrink-0">Added</Badge>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button type="submit" size="sm" className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={saving || !form.title.trim() || !form.body.trim()}>
              {saving ? "Saving…" : <><CalendarClock className="h-3.5 w-3.5 mr-1.5" />Create Schedule</>}
            </Button>
          </form>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-6">Loading schedules…</p>
        ) : schedules.length === 0 && !showForm ? (
          <div className="text-center py-8 text-gray-400">
            <CalendarClock className="h-9 w-9 mx-auto mb-2 opacity-25" />
            <p className="text-sm">No scheduled notifications yet</p>
            <p className="text-xs mt-1">Click "New Schedule" to set up automated sends</p>
          </div>
        ) : (
          <div className="space-y-2">
            {schedules.map(s => (
              <div key={s.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-opacity ${s.isActive ? "border-violet-200 bg-violet-50/40" : "border-gray-200 bg-gray-50 opacity-55"}`}>
                <div className="mt-0.5 flex-shrink-0">
                  <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                    <Clock className="h-3.5 w-3.5 text-violet-600" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900 truncate">{s.title}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">{s.type}</Badge>
                    {s.isActive ? (
                      <Badge className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 flex-shrink-0">Active</Badge>
                    ) : (
                      <Badge className="text-[10px] px-1.5 py-0 bg-gray-200 text-gray-500 hover:bg-gray-200 flex-shrink-0">Paused</Badge>
                    )}
                    {s.scheduleType === "once" && !s.isActive && (
                      <Badge className="text-[10px] px-1.5 py-0 bg-blue-100 text-blue-600 hover:bg-blue-100 flex-shrink-0">Sent</Badge>
                    )}
                    {s.target === "specific" ? (
                      <Badge className="text-[10px] px-1.5 py-0 bg-violet-100 text-violet-700 hover:bg-violet-100 flex-shrink-0">🎯 {getTargetCount(s)} users</Badge>
                    ) : (
                      <Badge className="text-[10px] px-1.5 py-0 bg-gray-100 text-gray-500 hover:bg-gray-100 flex-shrink-0">👥 All</Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{s.body}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-[11px] text-gray-400">
                    <span className="flex items-center gap-1 text-violet-600 font-medium">
                      <Clock className="h-2.5 w-2.5" />{describeSchedule(s)}
                    </span>
                    {s.nextRunAt && s.isActive && <span>Next: {new Date(s.nextRunAt).toLocaleString()}</span>}
                    {s.lastRunAt && <span>Last sent: {new Date(s.lastRunAt).toLocaleString()}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 pt-0.5">
                  {s.scheduleType !== "once" && (
                    <button onClick={() => handleToggle(s.id, s.isActive)}
                      className={`text-[11px] px-2 py-1 rounded-md border font-medium transition-colors ${s.isActive ? "border-amber-300 text-amber-700 hover:bg-amber-50" : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"}`}>
                      {s.isActive ? "Pause" : "Resume"}
                    </button>
                  )}
                  <button onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-md border border-red-200 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Notifications() {
  const { toast } = useToast();
  const broadcast = useBroadcastNotification();

  const [form, setForm] = useState({ title: "", body: "", type: "general" });
  const [lastResult, setLastResult] = useState<{ sent: number; pushSent: number } | null>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: "Please fill in both title and message", variant: "destructive" });
      return;
    }
    broadcast.mutate(
      { data: { title: form.title.trim(), body: form.body.trim(), type: form.type } },
      {
        onSuccess: (result: any) => {
          setLastResult(result);
          toast({ title: `Notification sent to ${result.sent} users!` });
          setForm({ title: "", body: "", type: "general" });
        },
        onError: () => toast({ title: "Failed to send notification", variant: "destructive" }),
      }
    );
  };

  const applyTemplate = (t: (typeof QUICK_TEMPLATES)[0]) => {
    setForm({ title: t.title, body: t.body, type: t.type });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <NoticeBoard />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
          <Bell className="h-5 w-5 text-blue-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Push Notifications</h2>
          <p className="text-sm text-gray-500">Broadcast to all users or send to a specific customer</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-blue-600" />
              <div>
                <div className="text-xl font-bold text-blue-900">All Users</div>
                <div className="text-xs text-blue-600">Broadcast target</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-50 border-purple-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-8 w-8 text-purple-600" />
              <div>
                <div className="text-xl font-bold text-purple-900">Expo Push</div>
                <div className="text-xs text-purple-600">Real device notifications</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <Megaphone className="h-8 w-8 text-orange-600" />
              <div>
                <div className="text-xl font-bold text-orange-900">In-App</div>
                <div className="text-xs text-orange-600">Notification center</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-gray-500" />
                Broadcast to All Users
              </CardTitle>
              <CardDescription>This will be sent to every active customer</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSend} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                  <Input
                    value={form.title}
                    onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. 🔥 Flash Sale is Live!"
                    maxLength={100}
                  />
                  <p className="text-xs text-gray-400 mt-1">{form.title.length}/100 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                  <Textarea
                    value={form.body}
                    onChange={(e) => setForm(f => ({ ...f, body: e.target.value }))}
                    placeholder="Write your notification message here..."
                    rows={4}
                    maxLength={300}
                  />
                  <p className="text-xs text-gray-400 mt-1">{form.body.length}/300 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm(f => ({ ...f, type: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="general">General</option>
                    <option value="promotion">Promotion</option>
                    <option value="order">Order Update</option>
                    <option value="reminder">Reminder</option>
                    <option value="system">System</option>
                  </select>
                </div>

                {form.title && form.body && (
                  <div className="bg-gray-900 rounded-xl p-4 text-white">
                    <p className="text-xs text-gray-400 mb-2">Preview</p>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-xs font-bold">S</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{form.title}</p>
                        <p className="text-xs text-gray-300 mt-0.5">{form.body}</p>
                      </div>
                    </div>
                  </div>
                )}

                {lastResult && (
                  <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                    <div className="text-sm">
                      <span className="font-semibold text-green-800">Broadcast sent!</span>
                      <span className="text-green-700 ml-2">
                        {lastResult.sent} in-app · {lastResult.pushSent} push delivered
                      </span>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={broadcast.isPending || !form.title.trim() || !form.body.trim()}
                >
                  {broadcast.isPending ? (
                    "Sending..."
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Send to All Users
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          <SendToUserSection />
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Templates</CardTitle>
              <CardDescription>Click to prefill the broadcast form</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {QUICK_TEMPLATES.map((t) => (
                <button
                  key={t.label}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-800 group-hover:text-blue-700">{t.label}</span>
                    <Badge variant="secondary" className="text-xs">{t.type}</Badge>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.title}</p>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <NotificationAnalyticsCard />
      <ScheduledNotificationsSection />
      <NotificationHistorySection />
    </div>
  );
}

const HISTORY_TYPE_COLORS: Record<string, string> = {
  promotion: "bg-orange-100 text-orange-700",
  reminder: "bg-blue-100 text-blue-700",
  system: "bg-gray-100 text-gray-600",
  general: "bg-indigo-100 text-indigo-700",
};

function NotificationHistorySection() {
  const [filters, setFilters] = useState({ search: "", type: "", read: "", from: "", to: "" });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ notifications: any[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const getToken = () => localStorage.getItem(TOKEN_KEY);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedFilters(filters); setPage(1); }, 400);
    return () => clearTimeout(t);
  }, [filters]);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: "20" });
    if (debouncedFilters.search) params.set("search", debouncedFilters.search);
    if (debouncedFilters.type) params.set("type", debouncedFilters.type);
    if (debouncedFilters.read !== "") params.set("read", debouncedFilters.read);
    if (debouncedFilters.from) params.set("from", debouncedFilters.from);
    if (debouncedFilters.to) params.set("to", debouncedFilters.to);
    fetch(`${API_URL}/api/admin/notifications/history?${params}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedFilters, page]);

  const hasFilters = filters.search || filters.type || filters.read !== "" || filters.from || filters.to;
  const clearFilters = () => setFilters({ search: "", type: "", read: "", from: "", to: "" });

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-slate-600" />
          Notification History
          {data && (
            <Badge variant="secondary" className="text-[11px] ml-1">{data.total.toLocaleString()} total</Badge>
          )}
        </CardTitle>
        <CardDescription>Full log of every notification sent — search, filter by type, date range, or read status</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-gray-400 pointer-events-none" />
            <Input
              value={filters.search}
              onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
              placeholder="Search title or message…"
              className="pl-8 h-8 text-xs"
            />
          </div>
          <select
            value={filters.type}
            onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
            className="h-8 border border-gray-300 rounded-md px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">All Types</option>
            <option value="general">General</option>
            <option value="promotion">Promotion</option>
            <option value="reminder">Reminder</option>
            <option value="system">System</option>
          </select>
          <select
            value={filters.read}
            onChange={e => setFilters(f => ({ ...f, read: e.target.value }))}
            className="h-8 border border-gray-300 rounded-md px-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Read &amp; Unread</option>
            <option value="false">Unread only</option>
            <option value="true">Read only</option>
          </select>
          <Input
            type="date"
            value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            className="h-8 text-xs w-[130px]"
            title="From date"
          />
          <span className="text-gray-400 text-xs">–</span>
          <Input
            type="date"
            value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            className="h-8 text-xs w-[130px]"
            title="To date"
          />
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="h-8 text-xs text-gray-500 hover:text-gray-800 px-2">
              <X className="h-3 w-3 mr-1" />Clear
            </Button>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Loading…</div>
        ) : !data || data.notifications.length === 0 ? (
          <div className="py-10 text-center text-gray-400">
            <History className="h-9 w-9 mx-auto mb-2 opacity-20" />
            <p className="text-sm font-medium">{hasFilters ? "No notifications match your filters" : "No notifications sent yet"}</p>
            {hasFilters && <button onClick={clearFilters} className="text-xs text-violet-600 hover:underline mt-1">Clear filters</button>}
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Title / Message</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-600 hidden sm:table-cell">User</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Type</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-3 py-2.5 font-semibold text-gray-600 hidden md:table-cell">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.notifications.map((n: any) => (
                  <tr key={n.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <p className="font-medium text-gray-900 truncate">{n.title}</p>
                      <p className="text-gray-400 truncate mt-0.5">{n.body}</p>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell max-w-[140px]">
                      {n.userName ? (
                        <>
                          <p className="font-medium text-gray-800 truncate">{n.userName}</p>
                          <p className="text-gray-400 truncate">{n.userEmail}</p>
                        </>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full font-medium ${HISTORY_TYPE_COLORS[n.type] ?? "bg-gray-100 text-gray-600"}`}>
                        {n.type}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {n.read ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <HistoryCheckIcon className="h-3 w-3" />Read
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-500 font-medium">
                          <Clock className="h-3 w-3" />Unread
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-gray-400 hidden md:table-cell whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between text-xs text-gray-500 pt-1">
            <span>Page {page} of {data.pages} · {data.total.toLocaleString()} total</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                ← Prev
              </Button>
              <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
                Next →
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
