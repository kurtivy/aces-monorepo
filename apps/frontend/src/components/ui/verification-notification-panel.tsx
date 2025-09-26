'use client';

import React, { useLayoutEffect, useState } from 'react';
import { CheckCircle, Clock, XCircle, AlertTriangle } from 'lucide-react';
import type { VerificationDetails } from '@/lib/api/verification';

// type NotificationStatus = 'pending' | 'approved' | 'rejected' | 'processing';

interface VerificationNotificationPanelProps {
  verificationDetails: VerificationDetails | null;
  contentWidth?: number;
  bandHeight?: number;
  contentLineOffset?: number;
  className?: string;
}

const BOTTOM_RULE_HEIGHT = 8; // header's dashed bottom rule visual height in px

export default function VerificationNotificationPanel({
  verificationDetails,
  contentWidth = 1200,
  bandHeight = 96,
  contentLineOffset = 8,
  className = '',
}: VerificationNotificationPanelProps) {
  const [top, setTop] = useState<number>(0);
  const [isMeasured, setIsMeasured] = useState<boolean>(false);

  useLayoutEffect(() => {
    const getHeader = () => document.querySelector('[data-aces-header]') as HTMLElement | null;
    const measure = () => {
      const header = getHeader();
      if (header) {
        const rect = header.getBoundingClientRect();
        setTop(Math.max(0, Math.round(rect.bottom + BOTTOM_RULE_HEIGHT)));
        if (!isMeasured) setIsMeasured(true);
      } else {
        if (!isMeasured) setIsMeasured(true);
      }
    };
    measure();
    const ResizeObserverCtor: any = (window as any).ResizeObserver;
    const header = getHeader();
    const ro = ResizeObserverCtor && header ? new ResizeObserverCtor(measure) : null;
    if (ro && header) ro.observe(header);
    window.addEventListener('resize', measure);
    return () => {
      if (ro && header) ro.unobserve(header);
      window.removeEventListener('resize', measure);
    };
  }, []);

  // Don't render if no verification details
  if (!verificationDetails) {
    return null;
  }

  // Positions within content - left side of divider
  const contentLeft = `calc(50% - ${contentWidth / 2}px)`;
  const dividerLeft = `calc(${contentLeft} + ${Math.round(contentWidth / 3)}px)`;

  // Notification area: from content edge to divider (with some padding)
  const notificationLeft = `calc(${contentLeft} + ${contentLineOffset}px)`;
  const notificationWidth = `calc(${dividerLeft} - ${contentLeft} - ${contentLineOffset * 2}px)`;

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'PENDING':
        return {
          icon: Clock,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-400/10',
          borderColor: 'border-yellow-400/30',
          title: 'Verification Pending',
          message: 'Your application is under review',
        };
      case 'APPROVED':
        return {
          icon: CheckCircle,
          color: 'text-emerald-400',
          bgColor: 'bg-emerald-400/10',
          borderColor: 'border-emerald-400/30',
          title: 'Verification Approved',
          message: 'Your identity has been verified',
        };
      case 'REJECTED':
        return {
          icon: XCircle,
          color: 'text-red-400',
          bgColor: 'bg-red-400/10',
          borderColor: 'border-red-400/30',
          title: 'Verification Rejected',
          message: verificationDetails.rejectionReason || 'Please review and resubmit',
        };
      default:
        return {
          icon: AlertTriangle,
          color: 'text-gray-400',
          bgColor: 'bg-gray-400/10',
          borderColor: 'border-gray-400/30',
          title: 'Status Unknown',
          message: 'Please refresh the page',
        };
    }
  };

  const statusConfig = getStatusConfig(verificationDetails.status);
  const IconComponent = statusConfig.icon;

  return (
    <div
      className={`absolute left-1/2 -translate-x-1/2 z-45 ${className}`}
      style={{
        top,
        width: `${contentWidth}px`,
        height: `${bandHeight}px`,
        visibility: isMeasured ? 'visible' : 'hidden',
        pointerEvents: 'auto', // Allow interactions
      }}
    >
      {/* Notification Panel - Left side of divider */}
      <div
        className="absolute inset-y-0 flex items-center pl-6"
        style={{
          left: notificationLeft,
          width: notificationWidth,
        }}
      >
        <div
          className={`
            w-full max-w-sm p-4 rounded-xl border backdrop-blur-sm
            ${statusConfig.bgColor} ${statusConfig.borderColor}
            shadow-lg transition-shadow duration-300 ease-out
            hover:shadow-xl
          `}
        >
          <div className="flex items-start gap-3">
            {/* Status Icon */}
            <div className={`flex-shrink-0 ${statusConfig.color}`}>
              <IconComponent className="w-5 h-5" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold text-sm ${statusConfig.color}`}>
                {statusConfig.title}
              </h3>
              <p className="text-xs text-[#E6E3D3]/80 mt-1 leading-relaxed">
                {statusConfig.message}
              </p>

              {/* Additional info for rejected status */}
              {verificationDetails.status === 'REJECTED' && verificationDetails.attempts < 3 && (
                <p className="text-xs text-[#C9AE6A]/70 mt-2">
                  Attempt {verificationDetails.attempts}/3 • You can try again
                </p>
              )}

              {/* Submission date */}
              {verificationDetails.submittedAt && (
                <p className="text-xs text-[#E6E3D3]/60 mt-2">
                  {new Date(verificationDetails.submittedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
