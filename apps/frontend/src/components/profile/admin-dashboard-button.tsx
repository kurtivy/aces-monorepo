'use client';

import { Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth/auth-context';

interface AdminDashboardButtonProps {
  onAdminDashboardClick?: () => void;
}

export function AdminDashboardButton({ onAdminDashboardClick }: AdminDashboardButtonProps) {
  const { user } = useAuth();

  // Only show for admin users
  if (user?.role !== 'ADMIN') {
    return null;
  }

  return (
    <Button
      variant="outline"
      className="border-purple-400 text-purple-400 hover:bg-purple-400/10 bg-transparent"
      onClick={onAdminDashboardClick}
    >
      <Shield className="w-4 h-4 mr-2" />
      Admin Dashboard
    </Button>
  );
}
