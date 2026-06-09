"use client";
import { useState } from "react";
import { Package, Tag, Bell, Loader2 } from "lucide-react";
import { useListNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import type { Notification } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  order: Package,
  promo: Tag,
  general: Bell,
  alert: Bell,
};

const TYPE_COLORS: Record<string, string> = {
  order: "bg-blue-50 text-blue-600",
  promo: "bg-pink-50 text-[#F0185A]",
  general: "bg-purple-50 text-purple-600",
  alert: "bg-amber-50 text-amber-600",
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? "s" : ""} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days !== 1 ? "s" : ""} ago`;
}

const TABS = ["All", "Orders", "Promotions", "Alerts"] as const;
type Tab = (typeof TABS)[number];

export default function NotificationsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>("All");

  const { data: notifs = [], isLoading } = useListNotifications();
  const markReadMutation = useMarkNotificationRead();
  const markAllMutation = useMarkAllNotificationsRead();

  const unread = notifs.filter((n: Notification) => !n.read).length;

  const filtered =
    activeTab === "All"
      ? notifs
      : notifs.filter((n: Notification) => {
          if (activeTab === "Orders") return n.type === "order";
          if (activeTab === "Promotions") return n.type === "promo";
          if (activeTab === "Alerts") return n.type === "alert";
          return true;
        });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["listNotifications"] });

  const markRead = async (id: number) => {
    try { await markReadMutation.mutateAsync({ id }); invalidate(); } catch {}
  };

  const markAll = async () => {
    try { await markAllMutation.mutateAsync(); invalidate(); } catch {}
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Notifications</h2>
          {unread > 0 && <p className="text-sm text-gray-400">{unread} unread</p>}
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            disabled={markAllMutation.isPending}
            className="text-sm text-[#F0185A] hover:underline flex items-center gap-1"
          >
            {markAllMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            Mark all as read
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-5">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeTab === tab ? "bg-[#F0185A] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#F0185A] hover:text-[#F0185A]"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-[#F0185A] animate-spin" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
          <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500">No notifications yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {(filtered as Notification[]).map(notif => {
          const Icon = TYPE_ICONS[notif.type] ?? Bell;
          const color = TYPE_COLORS[notif.type] ?? "bg-gray-50 text-gray-600";
          const isUnread = !notif.read;
          return (
            <div
              key={notif.id}
              onClick={() => isUnread && markRead(notif.id)}
              className={`bg-white rounded-2xl border border-gray-100 p-4 flex gap-3 cursor-pointer hover:shadow-sm transition-all ${isUnread ? "border-l-4 border-l-[#F0185A]" : ""}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className={`text-sm ${isUnread ? "font-semibold text-gray-900" : "text-gray-600"}`}>
                  {notif.title}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{notif.body}</p>
                <p className="text-xs text-gray-400 mt-0.5">{timeAgo(notif.createdAt)}</p>
              </div>
              {isUnread && <div className="w-2 h-2 bg-[#F0185A] rounded-full mt-1.5 flex-shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
