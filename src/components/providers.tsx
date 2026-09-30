"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";

/** Provider sisi klien: TanStack Query + toast (sonner). */
export function Providers({ children }: { children: React.ReactNode }) {
  // Satu QueryClient per sesi browser, dibuat sekali saja.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {/* Aplikasi saat ini hanya punya tema terang */}
      <Toaster theme="light" richColors closeButton position="top-center" />
    </QueryClientProvider>
  );
}
