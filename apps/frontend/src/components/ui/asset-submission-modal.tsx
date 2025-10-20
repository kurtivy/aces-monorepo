'use client';

import React from 'react';
import {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

interface AssetSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SubmissionStatus;
  message: string;
  errorDetails?: string[];
  onNavigateToProfile?: () => void;
  onNavigateHome?: () => void;
}

export function AssetSubmissionModal({
  isOpen,
  onClose,
  status,
  message,
  errorDetails,
  onNavigateToProfile,
  onNavigateHome,
}: AssetSubmissionModalProps) {
  // Debug logging
  console.log('🎭 Asset Modal render:', { isOpen, status, message });

  const getStatusIcon = () => {
    switch (status) {
      case 'submitting':
        return (
          <div className="relative">
            <div className="p-4 bg-[#0f1511] border border-[#D0B284]/30 rounded-2xl">
              <Upload className="w-12 h-12 text-[#D0B284]" />
              <div className="absolute -top-1 -right-1 w-4 h-4 border-2 border-[#D0B284] border-t-transparent rounded-full animate-spin" />
            </div>
          </div>
        );
      case 'success':
        return (
          <div className="p-4 bg-[#0f1511] border border-green-500/30 rounded-2xl">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
        );
      case 'error':
        return (
          <div className="p-4 bg-[#0f1511] border border-red-500/30 rounded-2xl">
            <AlertCircle className="w-12 h-12 text-red-500" />
          </div>
        );
      default:
        return null;
    }
  };

  const getStatusTitle = () => {
    switch (status) {
      case 'submitting':
        return 'Submitting Asset';
      case 'success':
        return 'Asset Submitted Successfully';
      case 'error':
        return 'Submission Failed';
      default:
        return '';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'submitting':
        return 'text-[#D0B284]';
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-[#E6E3D3]';
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        // Prevent closing while submitting
        if (status !== 'submitting' && !open) {
          onClose();
        }
      }}
    >
      <DialogPortal>
        <DialogOverlay className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm" />
        <DialogPrimitive.Content
          className="fixed left-[50%] top-[50%] z-[10000] grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 bg-[#151c16] border-2 border-[#C9AE6A]/30 p-6 shadow-lg duration-200 rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          aria-describedby="dialog-description"
          onPointerDownOutside={(e) => {
            // Prevent closing when clicking outside during submission
            if (status === 'submitting') {
              e.preventDefault();
            }
          }}
          onEscapeKeyDown={(e) => {
            // Prevent closing with ESC during submission
            if (status === 'submitting') {
              e.preventDefault();
            }
          }}
        >
          {/* Decorative corner elements matching the page design */}
          <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
          <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

          <DialogHeader>
            <DialogTitle className="sr-only">{getStatusTitle()}</DialogTitle>
          </DialogHeader>

          {/* Required for accessibility - fixes the Dialog warning */}
          <DialogPrimitive.Description className="sr-only" id="dialog-description">
            Asset submission status and next steps
          </DialogPrimitive.Description>

          {/* Custom close button - only show if not submitting */}
          {status !== 'submitting' && (
            <DialogPrimitive.Close asChild>
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-4 top-4 p-2 hover:bg-[#C9AE6A]/10 text-[#C9AE6A]/70 hover:text-[#C9AE6A] z-10"
                onClick={onClose}
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogPrimitive.Close>
          )}

          <div className="flex flex-col items-center space-y-6 py-8 px-2">
            {/* Status Icon */}
            <div className="flex items-center justify-center">{getStatusIcon()}</div>

            {/* Status Title */}
            <h2 className={cn('text-xl font-bold text-center', getStatusColor())}>
              {getStatusTitle()}
            </h2>

            {/* Status Message */}
            <div className="text-center space-y-4">
              <p className="text-[#E6E3D3]/80 text-sm leading-relaxed max-w-sm">{message}</p>

              {/* Error Details */}
              {status === 'error' && errorDetails && errorDetails.length > 0 && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2 backdrop-blur-sm">
                  <p className="text-red-400 font-medium text-sm">Details:</p>
                  <ul className="text-red-300 text-xs space-y-1">
                    {errorDetails.map((detail, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-red-400 mt-0.5">•</span>
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Submitting Progress */}
              {status === 'submitting' && (
                <div className="space-y-4">
                  <div className="w-64 bg-[#0f1511] border border-[#C9AE6A]/20 rounded-full h-3 p-0.5">
                    <div className="bg-gradient-to-r from-[#D0B284] to-[#C9AE6A] h-full rounded-full animate-pulse w-3/4 shadow-sm"></div>
                  </div>
                  <p className="text-[#E6E3D3]/70 text-sm font-medium">
                    Uploading your asset and documentation...
                  </p>
                  <p className="text-[#C9AE6A]/60 text-xs">This may take a few moments</p>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            {status !== 'submitting' && (
              <div className="w-full max-w-sm space-y-3 pt-6">
                {status === 'success' ? (
                  <>
                    {/* Success state: Show navigation buttons */}
                    <Button
                      onClick={onNavigateToProfile}
                      className="w-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-semibold py-3 rounded-xl transition-all duration-300 shadow-lg"
                    >
                      Go to Profile
                    </Button>
                    <Button
                      onClick={onNavigateHome}
                      variant="outline"
                      className="w-full border-2 border-[#C9AE6A]/60 text-[#C9AE6A] hover:bg-[#C9AE6A]/10 hover:border-[#C9AE6A] py-3 rounded-xl transition-all duration-300"
                    >
                      Go Home
                    </Button>
                  </>
                ) : (
                  <>
                    {/* Error state: Show Try Again and Close buttons */}
                    {status === 'error' && (
                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          onClick={onClose}
                          className="flex-1 border-2 border-[#C9AE6A]/50 text-[#C9AE6A] hover:bg-[#C9AE6A]/10 hover:border-[#C9AE6A] transition-all duration-300 rounded-xl px-6 py-2"
                        >
                          Try Again
                        </Button>
                        <Button
                          onClick={onClose}
                          className="flex-1 bg-gradient-to-r from-[#D0B284] to-[#C9AE6A] hover:from-[#C9AE6A] hover:to-[#D0B284] text-black font-semibold px-8 py-3 rounded-xl transition-all duration-300 shadow-lg"
                        >
                          Close
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

