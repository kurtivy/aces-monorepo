'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AccountEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  currentUsername: string;
  onSave?: (data: { email: string; username: string }) => Promise<void>;
}

export function AccountEditModal({
  isOpen,
  onClose,
  currentEmail,
  currentUsername,
  onSave,
}: AccountEditModalProps) {
  const [email, setEmail] = useState(currentEmail);
  const [username, setUsername] = useState(currentUsername);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail(currentEmail);
      setUsername(currentUsername);
      setError(null);
    }
  }, [isOpen, currentEmail, currentUsername]);

  const handleSave = async () => {
    if (!onSave) return;

    const trimmedEmail = email.trim();
    if (trimmedEmail && !trimmedEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email address');
      return;
    }

    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await onSave({ email: trimmedEmail, username: username.trim() });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account details');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEmail(currentEmail);
    setUsername(currentUsername);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#151c16] border border-[#D0B284]/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-libre-caslon text-[#D0B284] flex items-center justify-between">
            Edit Account Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div>
            <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase tracking-wide">
              Username
            </label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-black/50 border-[#D0B284]/20 text-white mt-2 focus:border-[#D0B284]"
              placeholder="Enter your username"
            />
          </div>

          <div>
            <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase tracking-wide">
              Email Address
            </label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-black/50 border-[#D0B284]/20 text-white mt-2 focus:border-[#D0B284]"
              placeholder="Enter your email address"
              type="email"
            />
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving || !onSave}
              className="flex-1 bg-[#D0B284] text-black hover:bg-[#D7BF75] font-medium"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
              className="flex-1 border-[#D0B284]/20 text-[#DCDDCC] hover:bg-[#D0B284]/10 bg-transparent"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
