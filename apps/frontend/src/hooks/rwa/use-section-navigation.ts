import { useState, useCallback, useRef } from 'react';
import type { WheelEvent as ReactWheelEvent } from 'react';
import type { Section } from '@/types/rwa/section.types';

export function useSectionNavigation(sections: Section[], initialSection = 0) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousActiveSection, setPreviousActiveSection] = useState<number | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  // Add scroll throttling state
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleSectionChange = useCallback(
    (index: number) => {
      const section = sections[index];

      if (section?.isModal) {
        // Handle modal sections
        if (section.id === 'share') {
          setShowShareModal(true);
        } else if (section.id === 'delivery') {
          setShowDeliveryModal(true);
        }
        return;
      }

      // Handle regular navigation
      if (index !== activeSection) {
        setIsAnimating(true);
        setPreviousActiveSection(activeSection);
        setActiveSection(index);

        // Reset animation state after animation completes
        setTimeout(() => {
          setIsAnimating(false);
          setPreviousActiveSection(null);
        }, 1200); // Match animation duration
      }
    },
    [activeSection, sections],
  );

  const handlePageWheel = useCallback(
    (e: ReactWheelEvent) => {
      e.preventDefault();

      // Prevent scrolling during animations or if already scrolling
      if (isAnimating || isScrolling) {
        return;
      }

      // Filter out modal sections for scroll navigation
      const contentSections = sections
        .map((section, index) => ({ section, index }))
        .filter(({ section }) => !section.isModal);

      const currentContentIndex = contentSections.findIndex(({ index }) => index === activeSection);

      // Determine scroll direction
      const isScrollingDown = e.deltaY > 0;
      let targetSection = null;

      if (isScrollingDown) {
        // Scrolling down - go to next content section
        if (currentContentIndex < contentSections.length - 1) {
          targetSection = contentSections[currentContentIndex + 1];
        }
      } else {
        // Scrolling up - go to previous content section
        if (currentContentIndex > 0) {
          targetSection = contentSections[currentContentIndex - 1];
        }
      }

      // Only proceed if we have a valid target section
      if (targetSection) {
        // Set scrolling state to prevent rapid consecutive scrolls
        setIsScrolling(true);

        // Clear any existing timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current);
        }

        // Navigate to the target section
        handleSectionChange(targetSection.index);

        // Reset scrolling state after a short delay to allow for smooth navigation
        scrollTimeoutRef.current = setTimeout(() => {
          setIsScrolling(false);
        }, 400); // Shorter than animation duration to allow for responsive scrolling
      }
    },
    [activeSection, sections, handleSectionChange, isAnimating, isScrolling],
  );

  return {
    // State
    activeSection,
    selectedImageIndex,
    isAnimating,
    previousActiveSection,
    showShareModal,
    showDeliveryModal,

    // Actions
    setSelectedImageIndex,
    handleSectionChange,
    handlePageWheel,
    setShowShareModal,
    setShowDeliveryModal,
  };
}
