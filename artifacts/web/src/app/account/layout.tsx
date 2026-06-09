"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  User, Package, Heart, MapPin, CreditCard, Bell,
  LogOut, LayoutDashboard, Gift, MessageCircle, Coins,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useGetCoinBalance, getGetCoinBalanceQueryKey } from "@workspace/api-client-react";

const navItems = [
  { href: "/account",               label: "Dashboard",      icon: LayoutDashboard, short: "Home" },
  { href: "/account/profile",       label: "Profile",        icon: User,            short: "Profile" },
  { href: "/account/orders",        label: "My Orders",      icon: Package,         short: "Orders" },
  { href: "/account/wishlist",      label: "Wishlist",       icon: Heart,           short: "Wishlist" },
  { href: "/account/addresses",     label: "Addresses",      icon: MapPin,          short: "Address" },
  { href: "/account/payment-methods", label: "Payments",     icon: CreditCard,      short: "Payments" },
  { href: "/account/notifications", label: "Notifications",  icon: Bell,            short: "Alerts" },
  { href: "/account/referrals",     label: "Rewards",        icon: Gift,            short: "Rewards" },
  { href: "/account/messages",      label: "Support",        icon: MessageCircle,   short: "Chat" },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoading, isAuthenticated, logout } = useAuth();

  const { data: coinBalance } = useGetCoinBalance({
    query: { queryKey: getGetCoinBalanceQueryKey(), enabled: isAuthenticated },
  });

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, isAuthenticated, router, pathname]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-[#F0185A] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) return null;

  const initial = user?.name?.charAt(0).toUpperCase() ?? "U";

  const handleLogout = async () => {
    await logout();
    router.push("/");
  };

  const isActive = (href: string) =>
    href === "/account"
      ? pathname === "/account"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ─── Mobile Header ─────────────────────────────────────────── */}
      <div className="md:hidden bg-white border-b border-gray-100 sticky top-0 z-30">
        {/* User strip */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-rose-500 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name ?? ""} className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-sm font-bold">{initial}</span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{user?.name ?? "—"}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email ?? ""}</p>
          </div>
          {coinBalance && coinBalance.balance > 0 && (
            <Link
              href="/account/referrals"
              className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1 flex-shrink-0"
            >
              <Coins className="w-3 h-3 text-amber-500" />
              <span className="text-xs font-bold text-amber-700">{coinBalance.balance}</span>
            </Link>
          )}
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-red-500 transition-colors flex-shrink-0"
            aria-label="Logout"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable nav tabs */}
        <div className="flex overflow-x-auto scrollbar-hide border-t border-gray-50 px-2 pb-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl flex-shrink-0 transition-all min-w-[56px] ${
                  active
                    ? "text-[#F0185A] bg-pink-50"
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? "text-[#F0185A]" : ""}`} />
                <span className={`text-[10px] font-medium whitespace-nowrap ${active ? "text-[#F0185A]" : ""}`}>
                  {item.short}
                </span>
                {active && <div className="w-1 h-1 rounded-full bg-[#F0185A]" />}
              </Link>
            );
          })}
        </div>
      </div>

      {/* ─── Desktop + Mobile content ──────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 md:py-6">
        <div className="flex gap-6">

          {/* Desktop Sidebar */}
          <aside className="w-56 flex-shrink-0 hidden md:block">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden sticky top-24">
              {/* Profile block */}
              <div className="p-5 border-b border-gray-100 text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-500 rounded-full flex items-center justify-center mx-auto mb-3 overflow-hidden">
                  {user?.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.name ?? ""} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-white text-2xl font-bold">{initial}</span>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-900 truncate">{user?.name ?? "—"}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{user?.email ?? ""}</p>
                {coinBalance && coinBalance.balance > 0 && (
                  <Link
                    href="/account/referrals"
                    className="mt-2.5 inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors"
                  >
                    <Coins className="w-3.5 h-3.5 text-amber-500" />
                    <span className="text-xs font-semibold text-amber-700">{coinBalance.balance} Coins</span>
                  </Link>
                )}
              </div>

              {/* Nav links */}
              <nav className="py-2">
                {navItems.map(item => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                        active
                          ? "text-[#F0185A] bg-pink-50 font-semibold border-r-2 border-[#F0185A]"
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </Link>
                  );
                })}
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors mt-1 border-t border-gray-50"
                >
                  <LogOut className="w-4 h-4 flex-shrink-0" />
                  Logout
                </button>
              </nav>
            </div>
          </aside>

          {/* Page content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
