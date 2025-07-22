'use client';

import { useState } from 'react';
import { UserProfile } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/auth/auth-context';
import { Edit2, Save, X, Twitter, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UserProfileCardProps {
  user: UserProfile | null;
}

interface FieldError {
  displayName?: string;
  bio?: string;
  website?: string;
  twitterHandle?: string;
  general?: string;
}

export function UserProfileCard({ user }: UserProfileCardProps) {
  const { updateProfile, isVerifiedSeller } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    bio: user?.bio || '',
    website: user?.website || '',
    twitterHandle: user?.twitterHandle || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<FieldError>({});

  if (!user) return null;

  const validateForm = () => {
    const newErrors: FieldError = {};

    // Display Name validation
    if (
      formData.displayName &&
      (formData.displayName.length < 1 || formData.displayName.length > 30)
    ) {
      newErrors.displayName = 'Display name must be between 1 and 30 characters';
    }

    // Website validation
    if (formData.website && !formData.website.match(/^https?:\/\/.+/)) {
      newErrors.website = 'Website must be a valid URL starting with http:// or https://';
    }

    // Twitter handle validation
    if (formData.twitterHandle && !formData.twitterHandle.match(/^@?[A-Za-z0-9_]{1,15}$/)) {
      newErrors.twitterHandle = 'Twitter handle must be a valid username (up to 15 characters)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    setErrors({});
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);
    try {
      // Clean up and filter data
      const cleanedData: Partial<UserProfile> = {};

      // Only include non-empty values
      if (formData.displayName && formData.displayName.trim()) {
        cleanedData.displayName = formData.displayName.trim();
      }

      if (formData.bio && formData.bio.trim()) {
        cleanedData.bio = formData.bio.trim();
      }

      if (formData.website && formData.website.trim()) {
        const website = formData.website.trim();
        cleanedData.website = website.startsWith('http') ? website : `https://${website}`;
      }

      if (formData.twitterHandle && formData.twitterHandle.trim()) {
        const twitter = formData.twitterHandle.trim();
        cleanedData.twitterHandle = twitter.startsWith('@') ? twitter : `@${twitter}`;
      }

      console.log('🧹 Cleaned data before sending:', cleanedData);

      const result = await updateProfile(cleanedData);
      if (result.success) {
        setIsEditing(false);
      } else if (result.error) {
        setErrors({ general: result.error });
      }
    } catch (err) {
      setErrors({ general: err instanceof Error ? err.message : 'Failed to update profile' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setErrors({});
    setFormData({
      displayName: user.displayName || '',
      bio: user.bio || '',
      website: user.website || '',
      twitterHandle: user.twitterHandle || '',
    });
    setIsEditing(false);
  };

  return (
    <div className="bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-[#D0B284] text-2xl font-bold">Profile</h2>
          <p className="text-[#DCDDCC] text-sm">
            {isEditing ? 'Edit your profile information' : 'Your public profile information'}
          </p>
        </div>
        {!isEditing ? (
          <Button
            variant="ghost"
            className="text-[#D0B284] hover:bg-[#D0B284]/20"
            onClick={() => setIsEditing(true)}
          >
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="ghost"
              className="text-red-400 hover:bg-red-500/20"
              onClick={handleCancel}
              disabled={isSaving}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              variant="ghost"
              className="text-emerald-400 hover:bg-emerald-500/20"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      {/* General Error Message */}
      {errors.general && (
        <div className="mb-6 p-3 bg-red-500/20 border border-red-500 rounded-lg">
          <p className="text-red-400 text-sm">{errors.general}</p>
        </div>
      )}

      {/* Profile Content */}
      <div className="space-y-6">
        {/* Display Name */}
        <div>
          <label className="block text-[#DCDDCC] text-sm mb-2">Display Name</label>
          {isEditing ? (
            <div>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className={cn(
                  'bg-black/50 border-[#D0B284]/20 text-white',
                  errors.displayName && 'border-red-500',
                )}
                placeholder="Enter your display name"
              />
              {errors.displayName && (
                <p className="mt-1 text-red-400 text-xs">{errors.displayName}</p>
              )}
            </div>
          ) : (
            <p className="text-white text-lg">{user.displayName || 'Not set'}</p>
          )}
        </div>

        {/* Bio */}
        <div>
          <label className="block text-[#DCDDCC] text-sm mb-2">Bio</label>
          {isEditing ? (
            <div>
              <Textarea
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className={cn(
                  'bg-black/50 border-[#D0B284]/20 text-white',
                  errors.bio && 'border-red-500',
                )}
                placeholder="Tell others about yourself"
                rows={3}
              />
              {errors.bio && <p className="mt-1 text-red-400 text-xs">{errors.bio}</p>}
            </div>
          ) : (
            <p className="text-white">{user.bio || 'No bio provided'}</p>
          )}
        </div>

        {/* Links */}
        <div className="space-y-4">
          <div>
            <label className="block text-[#DCDDCC] text-sm mb-2">Website</label>
            {isEditing ? (
              <div>
                <Input
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className={cn(
                    'bg-black/50 border-[#D0B284]/20 text-white',
                    errors.website && 'border-red-500',
                  )}
                  placeholder="https://your-website.com"
                />
                {errors.website && <p className="mt-1 text-red-400 text-xs">{errors.website}</p>}
              </div>
            ) : user.website ? (
              <a
                href={user.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D0B284] hover:text-[#D7BF75] flex items-center"
              >
                <Globe className="w-4 h-4 mr-2" />
                {user.website}
              </a>
            ) : (
              <p className="text-[#DCDDCC]">No website provided</p>
            )}
          </div>

          <div>
            <label className="block text-[#DCDDCC] text-sm mb-2">Twitter</label>
            {isEditing ? (
              <div>
                <Input
                  value={formData.twitterHandle}
                  onChange={(e) => setFormData({ ...formData, twitterHandle: e.target.value })}
                  className={cn(
                    'bg-black/50 border-[#D0B284]/20 text-white',
                    errors.twitterHandle && 'border-red-500',
                  )}
                  placeholder="@username"
                />
                {errors.twitterHandle && (
                  <p className="mt-1 text-red-400 text-xs">{errors.twitterHandle}</p>
                )}
              </div>
            ) : user.twitterHandle ? (
              <a
                href={`https://twitter.com/${user.twitterHandle.replace('@', '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#D0B284] hover:text-[#D7BF75] flex items-center"
              >
                <Twitter className="w-4 h-4 mr-2" />
                {user.twitterHandle}
              </a>
            ) : (
              <p className="text-[#DCDDCC]">No Twitter handle provided</p>
            )}
          </div>
        </div>

        {/* Wallet Address */}
        <div>
          <label className="block text-[#DCDDCC] text-sm mb-2">Wallet Address</label>
          <p className="text-white font-mono text-sm">{user.walletAddress}</p>
        </div>

        {/* Role Badge */}
        <div>
          <label className="block text-[#DCDDCC] text-sm mb-2">Role</label>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-[#184D37] text-white text-sm">
            {user.role === 'ADMIN' && '👑 Admin'}
            {user.role === 'SELLER' && isVerifiedSeller && '✅ Verified Seller'}
            {user.role === 'SELLER' && !isVerifiedSeller && '⏳ Pending Seller'}
            {user.role === 'TRADER' && '💎 Trader'}
          </div>
        </div>
      </div>
    </div>
  );
}
