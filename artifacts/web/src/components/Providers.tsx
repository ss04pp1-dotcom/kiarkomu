"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { setBaseUrl } from "@workspace/api-client-react";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { API_BASE_URL } from "@/lib/config";
import type { ReactNode } from "react";
import type { PublicConfig } from "@/lib/usePublicConfig";

interface ProvidersProps {
  children: ReactNode;
  initialConfig?: PublicConfig;
}

export default function Providers({ children, initialConfig }: ProvidersProps) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          retry: (failureCount, error: unknown) => {
            const status = (error as { status?: number })?.status;
            if (status === 401 || status === 403) return false;
            return failureCount < 2;
          },
          staleTime: 30_000,
        },
      },
    });
    if (initialConfig && Object.keys(initialConfig).length > 0) {
      client.setQueryData(["publicConfig"], initialConfig);
    }
    return client;
  });

  useEffect(() => {
    setBaseUrl(API_BASE_URL);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CartProvider>{children}</CartProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
