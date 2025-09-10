'use client';

import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import type { ImageInfo } from '../../types/canvas';
import { useImageLoader } from '../../hooks/canvas/use-image-loader';
import { useViewState } from '../../hooks/canvas/use-view-state';
import { useCanvasRenderer } from '../../hooks/canvas/use-canvas-renderer';
import { useCanvasInteractions } from '../../hooks/canvas/use-canvas-interactions';
import { useCoordinatedResize } from '../../hooks/use-coordinated-resize';
import ConnectWalletNav from '../ui/custom/connect-wallet-nav';
import NavMenu from '../ui/custom/nav-menu';
import HomeButton from '../ui/custom/home-button';
import ContactButton from '../ui/custom/contact-button';
import UnifiedInfoPill from '../ui/custom/unified-info-pill';
import ImageDetailsModal from '../ui/custom/image-details-modal';
import ContactFormModal from '../ui/custom/contact-form-modal';
import AboutModal from '../ui/custom/about-modal';
import TermsModal from '../ui/custom/terms-modal';
import IntroAnimation from '../loading/intro-animation';
import { EmailSignupModal } from '../ui/email-signup-modal';
import { useModal } from '../../lib/contexts/modal-context';
import {
  mobileUtils,
  setScrollRestoration,
  getScrollRestoration,
} from '../../lib/utils/browser-utils';
import { useDeviceCapabilities, useInfiniteCanvasSettings } from '../../contexts/device-provider';
import {
  addEventListenerSafe,
  removeEventListenerSafe,
} from '../../lib/utils/event-listener-utils';
import { performEventListenerHealthCheck } from '../../lib/utils/event-listener-utils';
// Note: useAnimationFrame removed - caused scroll timing issues, kept for background animations only

type LoadingState = 'loading' | 'ready';

// FEATURED SECTION: Add interface for props
interface InfiniteCanvasProps {
  featuredImageId?: string;
  onFeaturedImageClick?: (imageInfo: ImageInfo) => void;
}

// FEATURED SECTION: Update component declaration to accept props
const InfiniteCanvas = ({
  featuredImageId = '7', // Default to KAWS watch (Audemars Piguet Royal Oak Concept KAWS)
  onFeaturedImageClick,
}: InfiniteCanvasProps = {}) => {
  const router = useRouter();
  const [selectedImage, setSelectedImage] = useState<ImageInfo | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  // Calendar icon modal state
  const [isEmailSignupModalOpen, setIsEmailSignupModalOpen] = useState(false);
  const [selectedProductTitle, setSelectedProductTitle] = useState('');

  // Modal context for About and Terms modals
  const {
    isAboutModalOpen,
    isTermsModalOpen,
    openAboutModal,
    openTermsModal,
    closeAboutModal,
    closeTermsModal,
  } = useModal();

  const [loadingState, setLoadingState] = useState<LoadingState>('loading');

  // Restore session memory for intro animation
  const [hasSeenIntro, setHasSeenIntro] = useState(false);

  // Week 3: Use enhanced capability system
  const { configuration, isReady: capabilitiesReady } = useDeviceCapabilities();
  const canvasSettings = useInfiniteCanvasSettings();

  const imagePlacementMapRef = useRef(
    new Map<string, { image: ImageInfo; x: number; y: number; width: number; height: number }>(),
  );

  // HOVER ENHANCEMENT: Shared refs for hover state between hooks
  const hoveredProductImageRef = useRef<{
    image: ImageInfo;
    x: number;
    y: number;
    width: number;
    height: number;
    isRepeated?: boolean;
    tileId?: string;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const { unitSize } = useCoordinatedResize({ canvasRef });

  const { images, imagesLoaded } = useImageLoader({
    unitSize: 200,
    enableLazyLoading: true,
  });

  const { viewState, handleWheel, animateViewState, isAnimating, animateToHome, updateViewState } =
    useViewState({
      imagesLoaded: imagesLoaded,
      _unitSize: unitSize,
      animationDuration: capabilitiesReady
        ? ((1000 / configuration.targetFrameRate) * 30) / 1000
        : 0.5, // Week 3: Capability-aware animation duration
    });

  // FEATURED SECTION: Updated useCanvasRenderer call with featured section props
  const {
    canvasReady,
    repeatedPlacements,
    repeatedTokens,
    handleMomentumUpdate,
    featuredImage, // FEATURED SECTION: Add featured image return value
  } = useCanvasRenderer({
    images,
    viewState,
    imagesLoaded: imagesLoaded,
    canvasVisible: loadingState !== 'loading' || hasSeenIntro,
    onCreateTokenClick: () => (window.location.href = 'https://www.aceofbase.fun'), // Navigate to aceofbase domain
    imagePlacementMap: imagePlacementMapRef,
    unitSize: unitSize,
    canvasRef: canvasRef,
    // Issue #2: Pass updateViewState for momentum integration
    updateViewState,
    // FEATURED SECTION: Add featured section props
    featuredImageId,
    onFeaturedImageClick: onFeaturedImageClick || setSelectedImage,
    // HOVER ENHANCEMENT: Pass hover functionality to renderer via ref
    hoveredProductImageRef,
  });

  const imagesRef = useRef(images);
  imagesRef.current = images;

  // Auction icon click handler - define before useCanvasInteractions
  const handleAuctionIconClick = useCallback((productTitle: string) => {
    setSelectedProductTitle(productTitle);
    setIsEmailSignupModalOpen(true);
  }, []);

  const handleEmailSignupModalClose = () => {
    setIsEmailSignupModalOpen(false);
    setSelectedProductTitle('');
  };

  // FEATURED SECTION: Updated useCanvasInteractions call with featured section props
  const {
    isPanning,
    isDragging,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    stopMomentum,
  } = useCanvasInteractions({
    viewState,
    setSelectedImage,
    imagePlacementMap: imagePlacementMapRef,
    unitSize,
    updateViewState,
    canvasRef,
    repeatedPlacements,
    repeatedTokens,
    // FEATURED SECTION: Add featured section props
    featuredImage,
    onFeaturedImageClick: onFeaturedImageClick || setSelectedImage,
    // Auction icon click handler
    onAuctionIconClick: handleAuctionIconClick,
    // Modal callbacks for home area buttons
    onAboutClick: openAboutModal,
    onTermsClick: openTermsModal,
  });

  const interactionsEnabled = loadingState === 'ready' && imagesLoaded;

  // Phase 2 Step 2: Safe view state animation with proper cleanup
  useEffect(() => {
    if (loadingState !== 'ready' || !imagesLoaded || !isAnimating) return;

    let animationFrameId: number | null = null;
    let isAnimationActive = true;

    const animate = () => {
      if (!isAnimationActive || !isAnimating) return; // Double check animation state

      animateViewState();

      if (isAnimationActive && isAnimating) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      // Phase 2 Step 2: Fix cleanup race conditions for view state
      isAnimationActive = false;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
      }
    };
  }, [loadingState, imagesLoaded, isAnimating, animateViewState]); // Phase 2 Step 4 Action 3: Added missing animateViewState dependency

  // Phase 2 Step 7 Action 4: Mobile loading state monitoring and validation
  useEffect(() => {
    // Week 3: Use capabilities from context instead of direct detection
    if (
      !capabilitiesReady ||
      (!configuration.touchGestures && !configuration.safariMobileOptimizations)
    ) {
      return; // Desktop or capabilities not ready - no mobile validation needed
    }

    const validation = mobileUtils.validateMobileLoadingState(
      loadingState,
      imagesLoaded,
      canvasReady,
    );

    if (!validation.valid) {
      // Continue - canvas interactions will still work without wheel events
    }
  }, [loadingState, imagesLoaded, canvasReady]);

  // Smart loading completion handler with session memory
  const handleLoadingComplete = () => {
    // Mark as seen for this session
    try {
      // Only set session storage if we're actually completing the loading
      if (loadingState === 'loading') {
        sessionStorage.setItem('hasSeenIntro', 'true');
        setHasSeenIntro(true); // Update local state to match storage
        setLoadingState('ready');
      }
    } catch (error) {
      // sessionStorage not available, continue anyway
      setHasSeenIntro(true); // Still update local state
      setLoadingState('ready');
    }
  };

  // Phase 2 Step 3: Enhanced wheel event listener with ref change protection
  // CRITICAL FIX: Store handleWheel in a ref to prevent infinite re-renders
  const handleWheelRef = useRef(handleWheel);
  // Update the ref whenever handleWheel changes, but don't create dependency loop
  handleWheelRef.current = handleWheel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !interactionsEnabled) return;

    // Phase 2 Step 3: Store canvas reference for cleanup validation
    const currentCanvas = canvas;

    const wheelListener = (e: Event) => {
      // Phase 2 Step 3: Validate canvas is still the same element
      if (canvasRef.current !== currentCanvas) return;

      try {
        handleWheelRef.current(e as unknown as React.WheelEvent<HTMLCanvasElement>);
      } catch (error) {
        // Wheel handler error - continue silently
      }
    };

    // Phase 2 Step 3 Action 5: Enhanced error handling for wheel event listener
    const wheelListenerResult = addEventListenerSafe(currentCanvas, 'wheel', wheelListener);

    if (wheelListenerResult.success) {
      currentCanvas.tabIndex = -1;

      try {
        currentCanvas.focus();
      } catch (focusError) {
        // Wheel handler error - continue silently
      }

      if (wheelListenerResult.fallbackApplied) {
        // Continue - canvas interactions will still work without wheel events
      }
    } else {
      // Continue - canvas interactions will still work without wheel events
    }

    return () => {
      // Phase 2 Step 3 Action 5: Enhanced cleanup with error handling
      if (wheelListenerResult.success && currentCanvas) {
        const removeResult = removeEventListenerSafe(currentCanvas, 'wheel', wheelListener);
        if (!removeResult.success) {
          // Continue - canvas interactions will still work without wheel events
        }
      }
    };
  }, [canvasRef, interactionsEnabled]);

  // Phase 2 Step 8 Action 2: Cross-browser scroll restoration safety
  useEffect(() => {
    // Store original setting for restoration
    const originalSetting = getScrollRestoration();

    // Set to manual with feature detection
    const wasSet = setScrollRestoration('manual');

    if (wasSet) {
      // Continue - canvas interactions will still work without scroll restoration
    }

    return () => {
      // Restore original setting or fallback to auto
      if (wasSet) {
        const restored = setScrollRestoration(originalSetting || 'auto');
        if (restored) {
          // Continue - canvas interactions will still work without scroll restoration
        }
      }
    };
  }, []);

  // Phase 2 Step 3 Action 4: Stable onClose callback to prevent modal event listener race conditions
  const handleModalClose = useCallback(() => {
    setSelectedImage(null);
  }, []);

  // Stop momentum before animating to home to prevent skewing
  const handleHomeClick = useCallback(() => {
    stopMomentum(); // Cancel any ongoing touch momentum
    animateToHome(); // Then animate to home position
  }, [stopMomentum, animateToHome]);

  // Handle contact button click
  const handleContactClick = useCallback(() => {
    setIsContactModalOpen(true);
  }, []);

  // Handle contact modal close
  const handleContactModalClose = useCallback(() => {
    setIsContactModalOpen(false);
  }, []);

  // Phase 2 Step 3 Action 5: Demonstrate enhanced error handling on component mount
  useEffect(() => {
    // Run health check to validate enhanced error handling
    performEventListenerHealthCheck();
  }, []); // Run once on mount

  // Check if user has seen intro animation in this session
  useEffect(() => {
    const checkIntroStatus = () => {
      try {
        const sessionValue = sessionStorage.getItem('hasSeenIntro');
        const seenIntro = sessionValue === 'true';

        setHasSeenIntro(seenIntro);
        // If they've seen the intro, we should also set loading state to ready
        if (seenIntro) {
          setLoadingState('ready');
        }
      } catch (error) {
        setHasSeenIntro(false);
      }
    };

    checkIntroStatus();
  }, []);

  // Memoized visibility conditions to prevent expensive re-calculations
  const isUIVisible = useMemo(() => {
    return (loadingState === 'ready' || hasSeenIntro) && canvasReady;
  }, [loadingState, hasSeenIntro, canvasReady]);

  return (
    <>
      {/* Navigation Menu - cached visibility conditions */}
      {isUIVisible && (
        <motion.div
          className="fixed top-4 right-4 z-50"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
        >
          <ConnectWalletNav />
        </motion.div>
      )}

      {/* Loading screen with new aces.fun intro animation */}
      {loadingState === 'loading' && !hasSeenIntro && (
        <IntroAnimation
          onIntroAnimationComplete={handleLoadingComplete}
          isComplete={imagesLoaded && canvasReady}
          skipLetterAnimation={hasSeenIntro}
        />
      )}

      {/* Main Canvas */}
      <motion.div
        className="fixed inset-0"
        style={{ zIndex: 40 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: loadingState === 'ready' || hasSeenIntro ? 1 : 0 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: loadingState === 'ready' ? 0.2 : 0 }}
        onAnimationComplete={() => {
          // Animation completion is now handled cleanly without debugging timers
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={interactionsEnabled ? handleMouseDown : undefined}
          onMouseMove={interactionsEnabled ? handleMouseMove : undefined}
          onMouseUp={interactionsEnabled ? handleMouseUp : undefined}
          onMouseLeave={interactionsEnabled ? handleMouseLeave : undefined}
          onTouchStart={interactionsEnabled ? handleTouchStart : undefined}
          onTouchMove={interactionsEnabled ? handleTouchMove : undefined}
          onTouchEnd={interactionsEnabled ? handleTouchEnd : undefined}
          className="w-full h-full touch-none select-none"
          style={{
            cursor: interactionsEnabled
              ? isPanning
                ? 'grabbing'
                : isDragging
                  ? 'grabbing'
                  : 'pointer'
              : 'default',
          }}
        />
      </motion.div>

      {/* Modals and UI */}
      <ImageDetailsModal imageInfo={selectedImage} onClose={handleModalClose} />
      <ContactFormModal isOpen={isContactModalOpen} onClose={handleContactModalClose} />
      <AboutModal isOpen={isAboutModalOpen} onClose={closeAboutModal} />
      <TermsModal isOpen={isTermsModalOpen} onClose={closeTermsModal} />
      <EmailSignupModal
        isOpen={isEmailSignupModalOpen}
        onClose={handleEmailSignupModalClose}
        productTitle={selectedProductTitle}
      />
      {isUIVisible && !selectedImage && (
        <>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          >
            <HomeButton onClick={handleHomeClick} />
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.4 }}
          >
            <ContactButton onClick={handleContactClick} />
          </motion.div>
        </>
      )}

      {/* Unified Info Pill - Contract Address & Built on Base */}
      {isUIVisible && <UnifiedInfoPill />}
    </>
  );
};

export default InfiniteCanvas;
