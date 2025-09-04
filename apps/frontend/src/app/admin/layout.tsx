'use client';

import { AdminAuthProvider } from '@/lib/auth/admin-auth-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <div className="min-h-screen bg-black">{children}</div>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}
