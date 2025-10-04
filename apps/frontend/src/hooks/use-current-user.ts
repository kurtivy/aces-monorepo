import { useAuth } from '@/lib/auth/auth-context';
import type { DatabaseListing } from '@/types/rwa/section.types';

export function useCurrentUser() {
  const { user, walletAddress, isAuthenticated } = useAuth();

  // Helper to check if current user owns a listing
  const isOwnerOf = (listing: DatabaseListing | null): boolean => {
    if (!listing || !walletAddress || !isAuthenticated) return false;

    // Compare wallet addresses (case-insensitive)
    return listing.owner?.walletAddress?.toLowerCase() === walletAddress.toLowerCase();
  };

  return {
    user,
    walletAddress,
    isAuthenticated,
    isOwnerOf,
  };
}
