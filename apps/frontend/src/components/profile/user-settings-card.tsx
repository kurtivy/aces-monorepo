'use client';

import { useState } from 'react';
import { UserProfile } from '@/lib/auth/auth-context';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Save, Bell, Mail, Moon } from 'lucide-react';

interface UserSettingsCardProps {
  user: UserProfile | null;
}

export function UserSettingsCard({ user }: UserSettingsCardProps) {
  const { updateProfile } = useAuth();
  const [settings, setSettings] = useState({
    notifications: user?.notifications || false,
    newsletter: user?.newsletter || false,
    darkMode: user?.darkMode || true,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  if (!user) return null;

  const handleToggle = (setting: keyof typeof settings) => {
    setSettings((prev) => {
      const newSettings = { ...prev, [setting]: !prev[setting] };
      setHasChanges(
        newSettings.notifications !== user.notifications ||
          newSettings.newsletter !== user.newsletter ||
          newSettings.darkMode !== user.darkMode,
      );
      return newSettings;
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const success = await updateProfile(settings);
      if (success) {
        setHasChanges(false);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-[#D0B284] text-2xl font-bold">Settings</h2>
          <p className="text-[#DCDDCC] text-sm">Manage your preferences</p>
        </div>
        {hasChanges && (
          <Button
            variant="ghost"
            className="text-emerald-400 hover:bg-emerald-500/20"
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        )}
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Notifications */}
        <div className="bg-black/50 rounded-lg p-4 border border-[#D0B284]/10">
          <div className="flex items-start justify-between">
            <div className="flex gap-3">
              <Bell className="w-5 h-5 text-[#D0B284] mt-1" />
              <div>
                <h3 className="text-white font-medium">Push Notifications</h3>
                <p className="text-[#DCDDCC] text-sm">Receive updates about your assets and bids</p>
              </div>
            </div>
            <Switch
              checked={settings.notifications}
              onCheckedChange={() => handleToggle('notifications')}
              className="data-[state=checked]:bg-[#D0B284]"
            />
          </div>
        </div>

        {/* Newsletter */}
        <div className="bg-black/50 rounded-lg p-4 border border-[#D0B284]/10">
          <div className="flex items-start justify-between">
            <div className="flex gap-3">
              <Mail className="w-5 h-5 text-[#D0B284] mt-1" />
              <div>
                <h3 className="text-white font-medium">Email Newsletter</h3>
                <p className="text-[#DCDDCC] text-sm">
                  Stay updated with new listings and market trends
                </p>
              </div>
            </div>
            <Switch
              checked={settings.newsletter}
              onCheckedChange={() => handleToggle('newsletter')}
              className="data-[state=checked]:bg-[#D0B284]"
            />
          </div>
        </div>

        {/* Dark Mode */}
        <div className="bg-black/50 rounded-lg p-4 border border-[#D0B284]/10">
          <div className="flex items-start justify-between">
            <div className="flex gap-3">
              <Moon className="w-5 h-5 text-[#D0B284] mt-1" />
              <div>
                <h3 className="text-white font-medium">Dark Mode</h3>
                <p className="text-[#DCDDCC] text-sm">Toggle between light and dark theme</p>
              </div>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={() => handleToggle('darkMode')}
              className="data-[state=checked]:bg-[#D0B284]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
