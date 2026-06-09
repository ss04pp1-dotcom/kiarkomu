import React, { useState } from "react";
import {
  useListUsers,
  useUpdateUserRole,
  useListOrders,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, X, ShoppingBag, TrendingUp, Calendar, Phone, Mail, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type UserRow = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  avatarUrl?: string | null;
  createdAt: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  processing: "bg-purple-100 text-purple-700",
  shipped: "bg-indigo-100 text-indigo-700",
  delivered: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  returned: "bg-orange-100 text-orange-700",
};

function CustomerPanel({ customer, onClose }: { customer: UserRow; onClose: () => void }) {
  const { data: ordersPage, isLoading } = useListOrders({ userId: customer.id, limit: 50 });
  const orders = ordersPage?.orders ?? [];
  const totalSpend = orders
    .filter((o) => o.status !== "cancelled" && o.status !== "returned")
    .reduce((s, o) => s + Number(o.total), 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="absolute inset-0 bg-black/20 backdrop-blur-[1px]"
        aria-hidden="true"
      />
      <aside
        className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-gray-50">
          <h3 className="font-semibold text-gray-900">Customer Profile</h3>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Profile Card */}
          <div className="px-6 py-5 border-b">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14">
                <AvatarImage src={customer.avatarUrl || undefined} />
                <AvatarFallback className="text-xl bg-blue-100 text-blue-600">
                  {customer.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-lg font-semibold text-gray-900">{customer.name}</p>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs mt-0.5",
                    customer.role === "owner"
                      ? "bg-red-50 text-red-700 border-red-200"
                      : customer.role === "manager"
                      ? "bg-blue-50 text-blue-700 border-blue-200"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                  )}
                >
                  {customer.role}
                </Badge>
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span>{customer.email}</span>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-gray-400 flex-shrink-0" />
                  <span>{customer.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span>Joined {new Date(customer.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 divide-x border-b">
            <div className="px-4 py-4 text-center">
              <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Orders</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-2xl font-bold text-gray-900">৳{totalSpend.toLocaleString()}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total Spent</p>
            </div>
            <div className="px-4 py-4 text-center">
              <p className="text-2xl font-bold text-gray-900">
                {orders.filter((o) => o.status === "delivered").length}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Delivered</p>
            </div>
          </div>

          {/* Order History */}
          <div className="px-6 py-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" /> Order History
            </h4>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="py-10 text-center text-gray-400">
                <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No orders yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-xl border bg-white p-3.5 hover:border-blue-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-gray-500">
                          #{order.id}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium capitalize",
                            STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"
                          )}
                        >
                          {order.status}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-gray-900">
                        ৳{Number(order.total).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>
                        {new Date(order.createdAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span className="capitalize">
                        {order.paymentMethod} · {order.deliveryMethod.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function Customers() {
  const [search, setSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<UserRow | null>(null);
  const { data: usersPage, isLoading } = useListUsers({ search: search || undefined });
  const updateRole = useUpdateUserRole();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleRoleChange = (id: number, newRole: string) => {
    updateRole.mutate(
      { id, data: { role: newRole as any } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
          toast({ title: "Role updated" });
        },
        onError: () => toast({ title: "Failed to update role", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6">
      {selectedCustomer && (
        <CustomerPanel customer={selectedCustomer} onClose={() => setSelectedCustomer(null)} />
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Customers & Users</h2>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <Input
            type="search"
            placeholder="Search users..."
            className="pl-9 bg-white"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search-customers"
          />
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium text-gray-600">User</th>
                  <th className="px-6 py-4 font-medium text-gray-600">Phone</th>
                  <th className="px-6 py-4 font-medium text-gray-600">Joined</th>
                  <th className="px-6 py-4 font-medium text-gray-600">Role</th>
                  <th className="px-6 py-4 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usersPage?.users?.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                    onClick={() => setSelectedCustomer(user as UserRow)}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.avatarUrl || undefined} />
                          <AvatarFallback className="bg-blue-100 text-blue-600">
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium text-gray-900 flex items-center gap-1">
                            {user.name}
                            <ChevronRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                          </div>
                          <div className="text-gray-500 text-xs">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{user.phone || "—"}</td>
                    <td className="px-6 py-4 text-gray-600">
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={
                          user.role === "owner"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : user.role === "manager"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-gray-50 text-gray-600"
                        }
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end">
                        <div className="w-32">
                          <Select
                            value={user.role}
                            onValueChange={(val) => handleRoleChange(user.id, val)}
                            disabled={updateRole.isPending}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="customer">Customer</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                              <SelectItem value="owner">Owner</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 text-center">
        Click any row to view order history and account details
      </div>
    </div>
  );
}
