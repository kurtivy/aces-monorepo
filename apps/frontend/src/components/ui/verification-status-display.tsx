'use client';

import React from 'react';
import { CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Link from 'next/link';

type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface VerificationStatusDisplayProps {
  status: VerificationStatus;
  attemptsUsed: number;
  maxAttempts: number;
  rejectionReason?: string;
  submittedAt?: string;
  onTryAgain?: () => void;
}

export function VerificationStatusDisplay({
  status,
  attemptsUsed,
  maxAttempts,
  rejectionReason,
  submittedAt,
  onTryAgain,
}: VerificationStatusDisplayProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'PENDING':
        return {
          icon: Clock,
          iconColor: 'text-[#D0B284]',
          bgColor: 'bg-gradient-to-br from-[#D0B284]/10 to-[#C9AE6A]/5',
          borderColor: 'border-[#D0B284]/30',
          title: 'Verification Under Review',
          subtitle: 'Your identity verification is being processed',
          description:
            'We are reviewing your submitted documents and selfie. You will receive an email notification once the review is complete. This process typically takes 1-2 business days.',
        };
      case 'APPROVED':
        return {
          icon: CheckCircle,
          iconColor: 'text-green-500',
          bgColor: 'bg-gradient-to-br from-green-500/10 to-emerald-500/5',
          borderColor: 'border-green-500/30',
          title: 'Verification Approved',
          subtitle: 'Your identity has been successfully verified',
          description:
            'Congratulations! You can now submit luxury assets for tokenization on our marketplace. Your verified status enables you to participate in our exclusive ecosystem.',
        };
      case 'REJECTED':
        return {
          icon: AlertCircle,
          iconColor: 'text-red-500',
          bgColor: 'bg-gradient-to-br from-red-500/10 to-rose-500/5',
          borderColor: 'border-red-500/30',
          title: 'Verification Rejected',
          subtitle: 'Your verification could not be approved',
          description:
            rejectionReason ||
            'The submitted documentation did not meet our verification requirements. Please review the feedback and try again with updated documents.',
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config) return null;

  const { icon: Icon, iconColor, bgColor, borderColor, title, subtitle, description } = config;
  const attemptsRemaining = maxAttempts - attemptsUsed;

  return (
    <div className="relative">
      {/* Decorative corner elements matching the page design */}
      <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
      <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

      <div
        className={cn('relative border-2 rounded-2xl p-8 backdrop-blur-sm', bgColor, borderColor)}
      >
        <div className="flex flex-col items-center text-center space-y-6">
          {/* Status Icon */}
          <div className="relative">
            <div className="p-4 bg-[#0f1511] border border-[#E6E3D3]/20 rounded-2xl">
              <Icon className={cn('w-12 h-12', iconColor)} />
            </div>
          </div>

          {/* Status Content */}
          <div className="space-y-4 max-w-2xl">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-[#D0B284]">{title}</h2>
              <p className="text-lg text-[#E6E3D3]/90">{subtitle}</p>
            </div>

            <p className="text-[#E6E3D3]/70 leading-relaxed">{description}</p>

            {/* Submission timestamp */}
            {submittedAt && (
              <p className="text-sm text-[#E6E3D3]/50">
                Submitted:{' '}
                {new Date(submittedAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}

            {/* Pending: allow users to proceed to listing while review is in progress */}
            {status === 'PENDING' && (
              <div className="bg-[#0f1511]/50 border border-[#E6E3D3]/10 rounded-xl p-4 space-y-3">
                <p className="text-[#E6E3D3]/80 text-sm">
                  While we review your documents, you can start your collectible submission now.
                </p>
                <Link href="/launch">
                  <Button className="w-full bg-gradient-to-r from-[#D0B284] to-[#C9AE6A] hover:from-[#C9AE6A] hover:to-[#D0B284] text-black font-semibold py-3 px-6 rounded-xl transition-all duration-300">
                    Submit your collectible
                  </Button>
                </Link>
              </div>
            )}

            {/* Attempts information for rejected status */}
            {status === 'REJECTED' && (
              <div className="bg-[#0f1511]/50 border border-[#E6E3D3]/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#E6E3D3]/70">Attempts used:</span>
                  <span className="text-[#E6E3D3]">
                    {attemptsUsed} of {maxAttempts}
                  </span>
                </div>

                {attemptsRemaining > 0 && (
                  <div className="space-y-3">
                    <p className="text-[#E6E3D3]/80 text-sm">
                      You have {attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''}{' '}
                      remaining.
                    </p>

                    {onTryAgain && (
                      <Button
                        onClick={onTryAgain}
                        className="w-full bg-gradient-to-r from-[#D0B284] to-[#C9AE6A] hover:from-[#C9AE6A] hover:to-[#D0B284] text-black font-semibold py-3 px-6 rounded-xl transition-all duration-300"
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        Try Again ({attemptsRemaining} attempt{attemptsRemaining !== 1 ? 's' : ''}{' '}
                        left)
                      </Button>
                    )}
                  </div>
                )}

                {attemptsRemaining === 0 && (
                  <div className="text-center py-2">
                    <p className="text-red-400 text-sm font-medium">
                      Maximum verification attempts reached
                    </p>
                    <p className="text-[#E6E3D3]/60 text-xs mt-1">
                      Please contact support for assistance
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
