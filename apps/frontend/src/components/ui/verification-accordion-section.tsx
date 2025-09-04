'use client';

import React, { useState } from 'react';
import { ChevronDown, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerificationAccordionSectionProps {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  isCompleted: boolean;
  isActive: boolean;
  stepNumber: number;
}

export function VerificationAccordionSection({
  icon: Icon,
  title,
  description,
  children,
  isCompleted,
  isActive,
  stepNumber,
}: VerificationAccordionSectionProps) {
  const [isExpanded, setIsExpanded] = useState(isActive);

  // Auto-expand when active, auto-collapse when completed and not active
  React.useEffect(() => {
    if (isActive) {
      setIsExpanded(true);
    } else if (isCompleted && !isActive) {
      setIsExpanded(false);
    }
  }, [isActive, isCompleted]);

  const handleToggle = () => {
    // Only allow toggle if completed (not active)
    if (isCompleted && !isActive) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      className={cn(
        'border rounded-xl transition-all duration-300',
        isCompleted && !isActive
          ? 'border-[#C9AE6A]/30 bg-[#C9AE6A]/5'
          : 'border-[#E6E3D3]/15 bg-[#0f1511]/50',
        isActive && 'border-[#D0B284]/50 bg-[#D0B284]/5',
      )}
    >
      {/* Header - Always Visible */}
      <div
        className={cn(
          'flex items-center gap-4 p-4 cursor-pointer',
          isCompleted && !isActive && 'hover:bg-[#C9AE6A]/10',
        )}
        onClick={handleToggle}
      >
        {/* Step Number or Completion Icon */}
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300',
            isCompleted
              ? 'bg-[#C9AE6A] text-black'
              : isActive
                ? 'bg-[#D0B284] text-black'
                : 'bg-[#0f1511] border border-dashed border-[#E6E3D3]/15',
          )}
        >
          {isCompleted ? (
            <CheckCircle className="w-5 h-5" />
          ) : (
            <span className="text-sm font-bold">{stepNumber}</span>
          )}
        </div>

        {/* Icon */}
        <div
          className={cn(
            'p-2 rounded-lg transition-all duration-300',
            isCompleted
              ? 'bg-[#C9AE6A]/20'
              : isActive
                ? 'bg-[#D0B284]/20'
                : 'bg-[#0f1511] border border-dashed border-[#E6E3D3]/15',
          )}
        >
          <Icon
            className={cn(
              'w-5 h-5 transition-all duration-300',
              isCompleted ? 'text-[#C9AE6A]' : isActive ? 'text-[#D0B284]' : 'text-[#C9AE6A]/70',
            )}
          />
        </div>

        {/* Title and Description */}
        <div className="flex-1">
          <h3
            className={cn(
              'text-lg font-semibold transition-all duration-300',
              isCompleted ? 'text-[#C9AE6A]' : isActive ? 'text-[#D0B284]' : 'text-[#E6E3D3]',
            )}
          >
            {title}
          </h3>
          <p
            className={cn(
              'text-sm transition-all duration-300',
              isCompleted
                ? 'text-[#C9AE6A]/70'
                : isActive
                  ? 'text-[#D0B284]/70'
                  : 'text-[#E6E3D3]/70',
            )}
          >
            {description}
          </p>
        </div>

        {/* Expand/Collapse Icon - Only show for completed sections */}
        {isCompleted && !isActive && (
          <ChevronDown
            className={cn(
              'w-5 h-5 text-[#C9AE6A]/70 transition-transform duration-300',
              isExpanded && 'rotate-180',
            )}
          />
        )}
      </div>

      {/* Content - Collapsible */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isExpanded ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <div className="p-4 pt-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}
