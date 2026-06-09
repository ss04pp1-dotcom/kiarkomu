import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import { useListConversations } from "@workspace/api-client-react";
import {
  LayoutDashboard, ShoppingCart, Users, Tag, Package,
  MessageSquare, Settings, LogOut, Grid, Bookmark, Layers,
  Image as ImageIcon, Zap, Star, Truck, MapPin, UserCog, BarChart3, Bell,
  Menu, X, Globe, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, section: "MAIN MENU", permKey: "dashboard" },
  { href: "/orders", label: "Orders", icon: ShoppingCart, section: "MAIN MENU", permKey: "orders" },
  { href: "/customers", label: "Customers", icon: Users, section: "MAIN MENU", permKey: "customers" },
  { href: "/chat", label: "Chat", icon: MessageSquare, section: "MAIN MENU", permKey: "chat" },

  { href: "/products", label: "Products", icon: Package, section: "PRODUCTS", permKey: "products" },
  { href: "/stock", label: "Stock", icon: BarChart3, section: "PRODUCTS", permKey: "stock" },
  { href: "/categories", label: "Categories", icon: Grid, section: "PRODUCTS", permKey: "categories" },
  { href: "/brands", label: "Brands", icon: Bookmark, section: "PRODUCTS", permKey: "brands" },
  { href: "/reviews", label: "Reviews", icon: Star, section: "PRODUCTS", permKey: "reviews" },

  { href: "/tracking-analytics", label: "Tracking Analytics", icon: TrendingUp, section: "MARKETING", permKey: "dashboard" },
  { href: "/coupons", label: "Coupons", icon: Tag, section: "MARKETING", permKey: "coupons" },
  { href: "/banners", label: "Banners", icon: ImageIcon, section: "MARKETING", permKey: "banners" },
  { href: "/flash-sales", label: "Flash Sales", icon: Zap, section: "MARKETING", permKey: "flashSales" },
  { href: "/promo-cards", label: "Promo Cards", icon: Layers, section: "MARKETING", permKey: "promoCards" },
  { href: "/notifications", label: "Notifications", icon: Bell, section: "MARKETING", permKey: "notifications" },
  { href: "/web-settings", label: "Web Settings", icon: Globe, section: "MARKETING", permKey: null },

  { href: "/shipping", label: "Shipping Zones", icon: Truck, section: "ADMIN", permKey: "shipping" },
  { href: "/stores", label: "Stores", icon: MapPin, section: "ADMIN", permKey: "stores" },
  { href: "/admins", label: "Manage Admins", icon: UserCog, section: "ADMIN", permKey: null },
  { href: "/settings", label: "Settings", icon: Settings, section: "ADMIN", permKey: null },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { data: conversations } = useListConversations({ query: { refetchInterval: 30000 } as any });
  const totalUnread = (conversations ?? []).reduce((sum: number, c: any) => sum + (c.unreadCount ?? 0), 0);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false); }, [location]);

  // Close sidebar on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setSidebarOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const groupedNav = navItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {} as Record<string, typeof navItems>);

  const SidebarContent = () => (
    <>
      <div className="h-16 flex items-center px-6 border-b flex-shrink-0">
        <h1 className="text-2xl font-bold text-blue-600 flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white text-lg font-bold">S</span>
          </div>
          Shohure
        </h1>
        {/* Close button on mobile */}
        <button
          className="ml-auto md:hidden p-1 text-gray-400 hover:text-gray-600"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        {Object.entries(groupedNav).map(([section, items]) => (
          <div key={section} className="mb-6">
            <h2 className="px-6 mb-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
              {section}
            </h2>
            <nav className="space-y-1 px-3">
              {items.map((item) => {
                const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
                if (user?.role === "manager") {
                  if (item.href === "/admins" || item.href === "/settings") return null;
                  if (item.permKey && user.permissions && user.permissions[item.permKey] === false) return null;
                }

                const isChatItem = item.href === "/chat";
                const chatBadge = isChatItem && totalUnread > 0 ? totalUnread : 0;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      isActive
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                    data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <item.icon size={18} className={cn(isActive ? "text-blue-600" : "text-gray-400")} />
                    <span className="flex-1">{item.label}</span>
                    {chatBadge > 0 && (
                      <span className="min-w-[20px] h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {chatBadge > 99 ? "99+" : chatBadge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>

      <div className="p-4 border-t flex-shrink-0">
        <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={logout} data-testid="button-logout">
          <LogOut size={18} className="mr-2" />
          Logout
        </Button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full bg-gray-50 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — desktop: always visible, mobile: drawer */}
      <aside
        className={cn(
          "w-64 flex-shrink-0 flex flex-col bg-white border-r z-30 transition-transform duration-200",
          // Desktop: static in flow
          "md:relative md:translate-x-0",
          // Mobile: fixed overlay drawer
          "fixed inset-y-0 left-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <SidebarContent />
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Header */}
        <header className="h-16 flex items-center px-4 md:px-8 border-b bg-white gap-3 flex-shrink-0">
          {/* Hamburger — mobile only */}
          <button
            className="md:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 transition-colors"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>

          {/* Mobile logo */}
          <span className="md:hidden text-lg font-bold text-blue-600">Shohure</span>

          <div className="flex-1" />

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-sm font-medium text-gray-900">{user?.name}</span>
              <span className="text-xs text-gray-500 capitalize">{user?.role}</span>
            </div>
            <Avatar>
              <AvatarImage src={user?.avatarUrl || undefined} />
              <AvatarFallback className="bg-blue-100 text-blue-600">
                {user?.name?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-4 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
