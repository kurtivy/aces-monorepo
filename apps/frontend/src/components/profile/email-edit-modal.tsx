'use client';

import { useState } from 'react';
import { X, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface EmailEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentEmail: string;
  onUpdateEmail?: (email: string) => Promise<void>;
}

export function EmailEditModal({
  isOpen,
  onClose,
  currentEmail,
  onUpdateEmail,
}: EmailEditModalProps) {
  const [email, setEmail] = useState(currentEmail);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onUpdateEmail) return;

    // Basic email validation
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setError('Please enter a valid email address');
      return;
    }

    setError(null);
    setIsSaving(true);

    try {
      await onUpdateEmail(email);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update email');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEmail(currentEmail);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#231F20] border border-[#D0B284]/20 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-libre-caslon text-[#D0B284] flex items-center justify-between">
            Update Email Address
            <Button
              variant="ghost"
              size="sm"
              className="text-[#DCDDCC] hover:bg-[#D0B284]/10"
              onClick={handleCancel}
            >
              <X className="w-4 h-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
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
              disabled={isSaving}
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
