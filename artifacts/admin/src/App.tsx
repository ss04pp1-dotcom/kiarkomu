import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth";
import { Layout } from "@/components/layout";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Orders from "@/pages/orders";
import OrderDetail from "@/pages/orders/detail";
import Products from "@/pages/products";
import NewProduct from "@/pages/products/new";
import EditProduct from "@/pages/products/edit";
import BulkAddProducts from "@/pages/products/bulk";
import Categories from "@/pages/categories";
import Customers from "@/pages/customers";
import Brands from "@/pages/brands";
import Reviews from "@/pages/reviews";
import Coupons from "@/pages/coupons";
import Banners from "@/pages/banners";
import FlashSales from "@/pages/flash-sales";
import Shipping from "@/pages/shipping";
import Stores from "@/pages/stores";
import Admins from "@/pages/admins";
import Settings from "@/pages/settings";
import Chat from "@/pages/chat";
import Stock from "@/pages/stock";
import PromoCards from "@/pages/promo-cards";
import Notifications from "@/pages/notifications";
import WebSettings from "@/pages/web-settings";
import TrackingAnalytics from "@/pages/tracking-analytics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status === 401 || error?.status === 403) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
    },
    mutations: {
      retry: false,
    },
  },
});

function ProtectedRoute({ component: Component, allowedRoles, permissionKey }: { component: any; allowedRoles?: string[]; permissionKey?: string }) {
  const { user, isLoading, logout } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      setLocation("/login");
      return;
    }
    if (user.role === "customer") {
      logout();
    }
  }, [isLoading, user]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center text-gray-500">Loading...</div>;
  }

  if (!user || user.role === "customer") {
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96 gap-3 text-center">
          <div className="text-4xl">🔒</div>
          <h2 className="text-xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-500 text-sm">You don't have permission to view this page.</p>
        </div>
      </Layout>
    );
  }

  if (permissionKey && user.role === "manager" && user.permissions && user.permissions[permissionKey] === false) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center h-96 gap-3 text-center">
          <div className="text-4xl">🔒</div>
          <h2 className="text-xl font-bold text-gray-800">Access Restricted</h2>
          <p className="text-gray-500 text-sm">Your admin has disabled access to this section.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <Component />
    </Layout>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/" component={() => <ProtectedRoute component={Dashboard} permissionKey="dashboard" />} />
      <Route path="/orders" component={() => <ProtectedRoute component={Orders} permissionKey="orders" />} />
      <Route path="/orders/:id" component={() => <ProtectedRoute component={OrderDetail} permissionKey="orders" />} />
      <Route path="/products" component={() => <ProtectedRoute component={Products} permissionKey="products" />} />
      <Route path="/products/new" component={() => <ProtectedRoute component={NewProduct} permissionKey="products" />} />
      <Route path="/products/bulk" component={() => <ProtectedRoute component={BulkAddProducts} permissionKey="products" />} />
      <Route path="/products/:id/edit" component={() => <ProtectedRoute component={EditProduct} permissionKey="products" />} />
      <Route path="/stock" component={() => <ProtectedRoute component={Stock} permissionKey="stock" />} />
      <Route path="/categories" component={() => <ProtectedRoute component={Categories} permissionKey="categories" />} />
      <Route path="/brands" component={() => <ProtectedRoute component={Brands} permissionKey="brands" />} />
      <Route path="/customers" component={() => <ProtectedRoute component={Customers} permissionKey="customers" />} />
      <Route path="/reviews" component={() => <ProtectedRoute component={Reviews} permissionKey="reviews" />} />
      <Route path="/coupons" component={() => <ProtectedRoute component={Coupons} permissionKey="coupons" />} />
      <Route path="/banners" component={() => <ProtectedRoute component={Banners} permissionKey="banners" />} />
      <Route path="/flash-sales" component={() => <ProtectedRoute component={FlashSales} permissionKey="flashSales" />} />
      <Route path="/promo-cards" component={() => <ProtectedRoute component={PromoCards} permissionKey="promoCards" />} />
      <Route path="/shipping" component={() => <ProtectedRoute component={Shipping} permissionKey="shipping" />} />
      <Route path="/stores" component={() => <ProtectedRoute component={Stores} permissionKey="stores" />} />
      <Route path="/admins" component={() => <ProtectedRoute component={Admins} allowedRoles={["owner"]} />} />
      <Route path="/settings" component={() => <ProtectedRoute component={Settings} allowedRoles={["owner"]} />} />
      <Route path="/chat" component={() => <ProtectedRoute component={Chat} permissionKey="chat" />} />
      <Route path="/notifications" component={() => <ProtectedRoute component={Notifications} permissionKey="notifications" />} />
      <Route path="/web-settings" component={() => <ProtectedRoute component={WebSettings} allowedRoles={["owner"]} />} />
      <Route path="/tracking-analytics" component={() => <ProtectedRoute component={TrackingAnalytics} permissionKey="dashboard" />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
