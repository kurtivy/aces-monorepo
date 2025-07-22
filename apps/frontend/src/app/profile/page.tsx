'use client';

import { useAuth } from '@/lib/auth/auth-context';
import { UserProfileCard } from '@/components/profile/user-profile-card';
import { UserAssetsCard } from '@/components/profile/user-assets-card';
import { UserActivityCard } from '@/components/profile/user-activity-card';
import { UserSettingsCard } from '@/components/profile/user-settings-card';
import { SellerVerificationCard } from '@/components/profile/seller-verification-card';

export default function ProfilePage() {
  const { user, isLoading, error } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-[#231F20] rounded-xl" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-64 bg-[#231F20] rounded-xl" />
            <div className="h-64 bg-[#231F20] rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black p-6">
        <div className="bg-[#231F20] rounded-xl p-6 border border-red-500">
          <h2 className="text-red-500 font-bold">Error Loading Profile</h2>
          <p className="text-[#DCDDCC]">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Main Profile Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column - Profile Info */}
          <div className="md:col-span-1 space-y-6">
            <UserProfileCard user={user} />
            <SellerVerificationCard user={user} />
          </div>

          {/* Right Column - Assets & Activity */}
          <div className="md:col-span-2 space-y-6">
            <UserAssetsCard />
            <UserActivityCard />
          </div>
        </div>

        {/* Settings Section */}
        <UserSettingsCard user={user} />
      </div>
    </div>
  );
}
