'use client';

import React, { useLayoutEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { Shield, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface VerificationNotificationProps {
  onVerifyClick: () => void;
  className?: string;
  contentWidth?: number;
  bandHeight?: number;
  contentLineOffset?: number;
}

const BOTTOM_RULE_HEIGHT = 8; // header's dashed bottom rule visual height in px

export default function VerificationNotification({
  onVerifyClick,
  className = '',
  contentWidth = 1200,
  bandHeight = 96,
  contentLineOffset = 8,
}: VerificationNotificationProps) {
  const { isAuthenticated, user, isVerifiedSeller } = useAuth();
  const [top, setTop] = useState<number>(0);
  const [isMeasured, setIsMeasured] = useState<boolean>(false);

  // Measure header position to align notification
  useLayoutEffect(() => {
    const getHeader = () => document.querySelector('[data-aces-header]') as HTMLElement | null;
    const measure = () => {
      const header = getHeader();
      if (header) {
        const rect = header.getBoundingClientRect();
        // Position below header's bottom dashed rule, same as PageBandTitle
        setTop(Math.max(0, Math.round(rect.bottom + BOTTOM_RULE_HEIGHT)));
        if (!isMeasured) setIsMeasured(true);
      } else {
        // Fallback if header not found
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

  // Don't show if user is not authenticated or is already verified
  if (!isAuthenticated || isVerifiedSeller) {
    return null;
  }

  // Determine notification type based on user status
  const getNotificationContent = () => {
    if (!user) {
      return {
        type: 'loading',
        icon: Clock,
        title: 'Loading...',
        message: 'Checking verification status',
        actionText: null,
        bgColor: 'bg-[#D7BF75]/10',
        textColor: 'text-[#D7BF75]',
        borderColor: 'border-[#D7BF75]/30',
      };
    }

    switch (user.sellerStatus) {
      case 'PENDING':
        return {
          type: 'pending',
          icon: Clock,
          title: 'Verification In Progress',
          message: "Your verification is under review. You'll be notified once approved.",
          actionText: null,
          bgColor: 'bg-gradient-to-br from-yellow-500/20 to-amber-500/15',
          textColor: 'text-yellow-500',
          borderColor: 'border-yellow-500/50',
        };
      case 'REJECTED':
        return {
          type: 'rejected',
          icon: AlertCircle,
          title: 'Verification Required',
          message: 'Previous verification was rejected. Please reapply to submit tokens.',
          actionText: 'Reapply for Verification',
          bgColor: 'bg-gradient-to-br from-red-500/20 to-orange-500/15',
          textColor: 'text-red-400',
          borderColor: 'border-red-500/50',
        };
      case 'NOT_APPLIED':
      default:
        return {
          type: 'not_applied',
          icon: Shield,
          title: 'Verification Required',
          message: 'You need to be a verified user to submit tokens for listing.',
          actionText: 'Verify Your Identity',
          bgColor: 'bg-gradient-to-br from-[#D7BF75]/20 to-[#C9AE6A]/15',
          textColor: 'text-[#D7BF75]',
          borderColor: 'border-[#D7BF75]/50',
        };
    }
  };

  const notification = getNotificationContent();
  const IconComponent = notification.icon;

  // Calculate positions within the content area
  const contentLeft = `calc(50% - ${contentWidth / 2}px)`;
  const dividerLeft = `calc(${contentLeft} + ${Math.round(contentWidth / 3)}px)`;
  const leftSectionStart = `calc(${contentLeft} + ${contentLineOffset}px)`;
  const leftSectionEnd = `calc(${dividerLeft} - 24px)`; // 24px gap from divider

  return (
    <div
      className={`pointer-events-auto absolute left-1/2 -translate-x-1/2 z-40 ${className}`}
      style={{
        top,
        width: `${contentWidth}px`,
        height: `${bandHeight}px`,
        visibility: isMeasured ? 'visible' : 'hidden',
      }}
    >
      {/* Notification positioned in left section between left guide and divider */}
      <div
        className={`absolute inset-y-0 flex items-center justify-center`}
        style={{
          left: `calc(${leftSectionStart} - ${contentLeft})`,
          width: `calc(${leftSectionEnd} - ${leftSectionStart})`,
        }}
      >
        <div
          className={`
            ${notification.bgColor} 
            ${notification.borderColor} 
            border-2 rounded-2xl px-6 py-5 max-w-full
            backdrop-blur-sm shadow-2xl transform hover:scale-105 transition-all duration-300
            ring-2 ring-[#D7BF75]/30 hover:ring-[#D7BF75]/60
            animate-pulse
          `}
        >
          <div className="flex items-start space-x-4">
            <IconComponent className={`w-7 h-7 ${notification.textColor} mt-1 flex-shrink-0`} />
            <div className="flex-1 min-w-0">
              <h3 className={`font-bold text-lg ${notification.textColor} mb-2`}>
                {notification.title}
              </h3>
              <p className="text-sm text-[#DCDDCC]/90 mb-3 leading-relaxed font-medium">
                {notification.message}
              </p>
              {notification.actionText && (
                <Button
                  onClick={onVerifyClick}
                  size="default"
                  className={`
                    text-sm px-6 py-3 h-auto font-bold
                    bg-gradient-to-r from-[#D7BF75] to-[#C9AE6A] 
                    hover:from-[#C9AE6A] hover:to-[#D7BF75] 
                    text-black shadow-lg hover:shadow-xl
                    transform hover:scale-105 transition-all duration-200
                    border border-[#D7BF75]/50
                  `}
                >
                  {notification.actionText}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
