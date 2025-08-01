'use client';

import { useState } from 'react';
import { KeySquare } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

interface OwnerLoginButtonProps {
  className?: string;
  onLoginClick?: () => void;
}

export default function OwnerLoginButton({ className = '', onLoginClick }: OwnerLoginButtonProps) {
  const [isOwnerLoginModalOpen, setIsOwnerLoginModalOpen] = useState(false);

  const handleLoginClick = () => {
    if (onLoginClick) {
      onLoginClick();
    }
    setIsOwnerLoginModalOpen(false);
  };

  return (
    <Dialog open={isOwnerLoginModalOpen} onOpenChange={setIsOwnerLoginModalOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={`text-[#D0B284] border border-[#D0B284] hover:bg-[#D0B284]/20 hover:text-[#D0B284] px-4 py-2 rounded-xl ${className}`}
        >
          <KeySquare className="w-4 h-4 mr-2 text-[#D0B284]" />
          Owner Login
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] bg-[#231F20] text-white border-[#D0B284]">
        <DialogHeader>
          <DialogTitle className="text-white">Owner Login</DialogTitle>
          <DialogDescription className="text-[#DCDDCC]">
            This is a placeholder for the owner login screen.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <p className="text-[#DCDDCC]">Please proceed to the dedicated owner login page.</p>
          <Button
            onClick={handleLoginClick}
            className="bg-[#D0B284] text-black hover:bg-[#D0B284]/80"
          >
            Close
          </Button>
          {/* You might add a Link or router.push here to navigate to the actual login page */}
        </div>
      </DialogContent>
    </Dialog>
  );
}
