'use client';

import ProfileSection from './profile-section'; // Adjust path if necessary

interface ProfileSectionWrapperProps {
  // ownerAddress is no longer needed
}

export default function ProfileSectionWrapper({}: ProfileSectionWrapperProps) {
  // No local state or toggle button needed here anymore,
  // as ProfileSection now manages its own dummy connection state.
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full">
        <ProfileSection />
      </div>
      {/* The dummy toggle button is now integrated directly into ProfileSection's flow */}
    </div>
  );
}
