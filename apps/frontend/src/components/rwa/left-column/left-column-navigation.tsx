'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { SectionNavigationProps, DatabaseListing } from '../../../types/rwa/section.types';
import { ActiveSectionContent } from './active-section-content';

interface DynamicLeftColumnNavigationProps extends SectionNavigationProps {
  listing?: DatabaseListing | null;
  loading?: boolean;
}

export function LeftColumnNavigation({
  sections,
  activeSection,
  onSectionChange,
  isAnimating,
  selectedImageIndex,
  setSelectedImageIndex,
  previousActiveSection,
  listing,
  loading = false,
}: DynamicLeftColumnNavigationProps) {
  const HEADER_HEIGHT = 56; // Reduced from 64 to fit more headers
  const CONTENT_HEIGHT = 320; // Reduced from 400 to make room for all headers

  // Calculate position for each card to create stacking effect
  const getCardPosition = (cardIndex: number) => {
    if (cardIndex === activeSection) {
      // Active card - positioned to show its content after any top stack headers
      const topStackCount = activeSection; // Number of cards above active section
      return topStackCount * HEADER_HEIGHT;
    } else if (cardIndex < activeSection) {
      // Cards above active card - stacked at top in numerical order (headers only)
      return cardIndex * HEADER_HEIGHT;
    } else {
      // Cards below active card - stacked after active card content
      const activeCardBottomPosition =
        activeSection * HEADER_HEIGHT + HEADER_HEIGHT + CONTENT_HEIGHT;
      return activeCardBottomPosition + (cardIndex - activeSection - 1) * HEADER_HEIGHT;
    }
  };

  return (
    <div
      className="h-full relative overflow-hidden"
      style={{
        height: 'calc(100vh - 120px)', // Use available viewport height minus header
        width: '320px',
        minHeight: '750px', // Minimum height to fit all 7 headers + content
      }}
    >
      {sections.map((section, index) => {
        const isActive = index === activeSection;

        // Determine if this card is animating out (for any direction)
        const isAnimatingOut =
          isAnimating && previousActiveSection !== null && index === previousActiveSection;

        // Show content for active card OR card that's animating out (only for content sections)
        const shouldShowContent = !section.isModal && (isActive || isAnimatingOut);

        return (
          <div
            key={section.id}
            className="absolute w-full"
            style={{
              zIndex: index * 5, // Fixed z-index: 0,5,10,15,20,25,30
              transform: `translateY(${getCardPosition(index)}px)`,
              transition: `transform ${isAnimating ? 1.2 : 0.6}s ease-in-out`,
              willChange: 'transform',
            }}
          >
            {/* Card Header */}
            <div
              className={cn(
                'h-14 border-b border-[#D0B284]/30 border-dashed cursor-pointer', // h-14 = 56px
                'flex items-center justify-center relative overflow-hidden',
                'bg-black text-[#D0B284]',
                // Modal sections styling (no hover effects)
                section.isModal && 'border-dashed',
              )}
              onClick={() => onSectionChange(index)}
            >
              <span className="font-bold text-base tracking-widest leading-none font-spray-letters">
                {section.label}
              </span>

              {/* Active indicator (only for content sections) */}
              {isActive && !section.isModal && (
                <div className="absolute left-0 top-0 w-1 h-full bg-[#184D37]" />
              )}
            </div>

            {/* Card Content - Show for active content sections OR animating out card */}
            {shouldShowContent && (
              <motion.div
                className="bg-[#231F20]/30  border-b border-[#D0B284]/30 border-dashed overflow-y-auto"
                style={{
                  height: `${CONTENT_HEIGHT}px`, // Now 320px instead of 400px
                  width: '320px', // Fixed width to match container
                }}
                initial={false}
                animate={{ opacity: isActive || isAnimatingOut ? 1 : 0.7 }}
                transition={{ duration: isAnimating ? 1.2 : 0.6, ease: 'easeInOut' }}
              >
                <ActiveSectionContent
                  sectionIndex={index}
                  selectedImageIndex={selectedImageIndex}
                  setSelectedImageIndex={setSelectedImageIndex}
                  listing={listing}
                  loading={loading}
                />
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}
