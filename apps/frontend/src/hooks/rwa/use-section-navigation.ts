import { useState, useCallback } from 'react';
import type { Section } from '@/types/rwa/section.types';

// Let's define the direction type clearly
export type NavigationDirection = 'up' | 'down';

export function useSectionNavigation(sections: Section[], initialSection = 0) {
  const [activeSection, setActiveSection] = useState(initialSection);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [previousActiveSection, setPreviousActiveSection] = useState<number | null>(null);
  // This state now simply holds the direction of the LAST transition. We will never set it to null.
  const [navigationDirection, setNavigationDirection] = useState<NavigationDirection>('down');
  const [showShareModal, setShowShareModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  const handleSectionChange = useCallback(
    (index: number, direction?: NavigationDirection) => {
      // Prevent navigation while an animation is in progress
      if (isAnimating || index === activeSection) {
        return;
      }

      const section = sections[index];

      if (section?.isModal) {
        if (section.id === 'share') setShowShareModal(true);
        else if (section.id === 'delivery') setShowDeliveryModal(true);
        return;
      }

      setIsAnimating(true);

      // Store the previous section
      setPreviousActiveSection(activeSection);

      // Determine and set the direction for the upcoming animation.
      // If no direction is provided, infer it.
      const actualDirection = direction || (index > activeSection ? 'down' : 'up');
      setNavigationDirection(actualDirection);

      setActiveSection(index);

      // Reset the animation lock after the animation duration.
      // This is the ONLY timer we need.
      setTimeout(() => {
        setIsAnimating(false);
        setPreviousActiveSection(null);
      }, 1200); // Match animation duration
    },
    [activeSection, sections, isAnimating],
  );

  return {
    // State
    activeSection,
    selectedImageIndex,
    isAnimating,
    previousActiveSection,
    navigationDirection, // Pass this directly to the component
    showShareModal,
    showDeliveryModal,

    // Actions
    setSelectedImageIndex,
    handleSectionChange,
    setShowShareModal,
    setShowDeliveryModal,
  };
}
