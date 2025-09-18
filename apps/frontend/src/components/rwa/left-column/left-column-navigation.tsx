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

  const sectionEntries = sections.map((section, originalIndex) => ({ section, originalIndex }));
  const contentSections = sectionEntries.filter(({ section }) => !section.isModal);
  const modalSections = sectionEntries.filter(({ section }) => section.isModal);

  const totalStackHeight = contentSections.length * HEADER_HEIGHT + CONTENT_HEIGHT;

  const activeContentIndex = contentSections.findIndex(
    ({ originalIndex }) => originalIndex === activeSection,
  );
  const previousContentIndex =
    previousActiveSection !== null
      ? contentSections.findIndex(({ originalIndex }) => originalIndex === previousActiveSection)
      : null;

  const effectiveActiveIndex = activeContentIndex === -1 ? 0 : activeContentIndex;
  const effectivePreviousIndex =
    previousContentIndex !== null && previousContentIndex !== -1 ? previousContentIndex : null;

  // Calculate position for each card to create stacking effect
  const getCardPosition = (cardIndex: number) => {
    if (cardIndex === effectiveActiveIndex) {
      // Active card - positioned to show its content after any top stack headers
      const topStackCount = effectiveActiveIndex; // Number of cards above active section
      return topStackCount * HEADER_HEIGHT;
    } else if (cardIndex < effectiveActiveIndex) {
      // Cards above active card - stacked at top in numerical order (headers only)
      return cardIndex * HEADER_HEIGHT;
    }

    // Cards below active card - stacked after active card content
    const activeCardBottomPosition =
      effectiveActiveIndex * HEADER_HEIGHT + HEADER_HEIGHT + CONTENT_HEIGHT;
    return activeCardBottomPosition + (cardIndex - effectiveActiveIndex - 1) * HEADER_HEIGHT;
  };

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-[#151c16]"
      style={{
        height: 'calc(100vh - 120px)', // Use available viewport height minus header
        width: '320px',
        minHeight: '750px', // Minimum height to fit all 7 headers + content
      }}
    >
      <div className="relative flex-1 overflow-hidden">
        {contentSections.map(({ section, originalIndex }, index) => {
          const isActive = originalIndex === activeSection;

          // Determine if this card is animating out (for any direction)
          const isAnimatingOut =
            isAnimating && effectivePreviousIndex !== null && index === effectivePreviousIndex;

          // Show content for active card OR card that's animating out (only for content sections)
          const shouldShowContent = isActive || isAnimatingOut;

          return (
            <div
              key={section.id}
              className="absolute w-full"
              style={{
                zIndex: index * 5, // Fixed z-index: 0,5,10,15,20
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
                  'bg-[#151c16] text-[#D0B284]',
                )}
                onClick={() => onSectionChange(originalIndex)}
              >
                <span className="font-bold text-base tracking-widest leading-none font-spray-letters">
                  {section.label}
                </span>

                {/* Active indicator */}
                {isActive && <div className="absolute left-0 top-0 h-full w-1 bg-[#D0B284]" />}
              </div>

              {/* Card Content - Show for active content sections OR animating out card */}
              {shouldShowContent && (
                <motion.div
                  className="border-b border-[#D0B284]/30 border-dashed bg-[#151c16] overflow-y-auto"
                  style={{
                    height: `${CONTENT_HEIGHT}px`, // Now 320px instead of 400px
                    width: '320px', // Fixed width to match container
                  }}
                  initial={false}
                  animate={{ opacity: isActive || isAnimatingOut ? 1 : 0.7 }}
                  transition={{ duration: isAnimating ? 1.2 : 0.6, ease: 'easeInOut' }}
                >
                  <ActiveSectionContent
                    sectionIndex={originalIndex}
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

        {/* Overlay mask to keep incoming content hidden below the stack */}
        <div
          className="pointer-events-none absolute left-0 right-0 bg-[#151c16]"
          style={{
            top: `${totalStackHeight}px`,
            bottom: 0,
            zIndex: 40,
          }}
        />
      </div>

      {modalSections.length > 0 && (
        <div className="mt-auto border-t border-[#D0B284]/30 border-dashed">
          {modalSections.map(({ section, originalIndex }) => (
            <div
              key={section.id}
              className={cn(
                'h-14 border-b border-[#D0B284]/30 border-dashed cursor-pointer',
                'flex items-center justify-center overflow-hidden bg-[#151c16] text-[#D0B284]',
              )}
              onClick={() => onSectionChange(originalIndex)}
            >
              <span className="font-bold text-base tracking-widest leading-none font-spray-letters">
                {section.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
