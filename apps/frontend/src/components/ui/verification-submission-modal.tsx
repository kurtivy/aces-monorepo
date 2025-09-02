'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertCircle, Upload, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SubmissionStatus = 'idle' | 'submitting' | 'success' | 'error';

interface VerificationSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SubmissionStatus;
  message: string;
  errorDetails?: string[];
}

export function VerificationSubmissionModal({
  isOpen,
  onClose,
  status,
  message,
  errorDetails,
}: VerificationSubmissionModalProps) {
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
        return 'Submitting Verification';
      case 'success':
        return 'Verification Submitted';
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-[#151c16] border-2 border-[#C9AE6A]/30 rounded-2xl relative">
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

          {/* Close button - only show if not submitting */}
          {status !== 'submitting' && (
            <Button
              variant="ghost"
              size="sm"
              className="absolute right-4 top-4 p-2 hover:bg-[#C9AE6A]/10 text-[#C9AE6A]/70 hover:text-[#C9AE6A] z-10"
              onClick={onClose}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </DialogHeader>

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
                  Processing your verification documents...
                </p>
                <p className="text-[#C9AE6A]/60 text-xs">This may take a few moments</p>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {status !== 'submitting' && (
            <div className="flex gap-3 pt-6">
              {status === 'error' && (
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="border-2 border-[#C9AE6A]/50 text-[#C9AE6A] hover:bg-[#C9AE6A]/10 hover:border-[#C9AE6A] transition-all duration-300 rounded-xl px-6 py-2"
                >
                  Try Again
                </Button>
              )}

              <Button
                onClick={onClose}
                className={cn(
                  'font-semibold px-8 py-3 rounded-xl transition-all duration-300 shadow-lg',
                  status === 'success'
                    ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white'
                    : 'bg-gradient-to-r from-[#D0B284] to-[#C9AE6A] hover:from-[#C9AE6A] hover:to-[#D0B284] text-black',
                )}
              >
                {status === 'success' ? 'Continue' : 'Close'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
