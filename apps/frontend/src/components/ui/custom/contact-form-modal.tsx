'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../button';
import { Input } from '../input';
import { Label } from '../label';
import { X, Send, CheckCircle, AlertCircle } from 'lucide-react';
import {
  addWindowEventListenerSafe,
  removeWindowEventListenerSafe,
} from '../../../lib/utils/event-listener-utils';
import { getBackdropFilterCSS } from '../../../lib/utils/browser-utils';
import { useMiniKit } from '@coinbase/onchainkit/minikit';

// Helper function to resolve API base URL
function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:3002';
  }
  if (typeof window !== 'undefined') {
    const href = window.location.href;
    if (href.includes('git-dev') || window.location.hostname.includes('git-dev')) {
      return 'https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app';
    }
  }
  return 'https://acesbackend-production.up.railway.app';
}

interface ContactFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  category: string;
  itemName: string;
  email: string;
}

interface FormErrors {
  category?: string;
  itemName?: string;
  email?: string;
}

const LUXURY_CATEGORIES = [
  { value: 'watches', label: 'Watches & Timepieces' },
  { value: 'jewelry', label: 'Jewelry & Precious Stones' },
  { value: 'art', label: 'Art & Collectibles' },
  { value: 'vehicles', label: 'Luxury Vehicles' },
  { value: 'fashion', label: 'Fashion & Accessories' },
  { value: 'spirits', label: 'Fine Wines & Spirits' },
  { value: 'real-estate', label: 'Real Estate' },
  { value: 'yachts', label: 'Yachts & Boats' },
  { value: 'private-jets', label: 'Private Jets' },
  { value: 'memorabilia', label: 'Sports Memorabilia' },
  { value: 'other', label: 'Other Luxury Items' },
];

const FormField = ({
  label,
  required = false,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="space-y-1">
    <Label className="text-[#DCDDCC] text-sm font-medium flex items-center gap-1">
      {label}
      {required && <span className="text-red-400 text-sm">*</span>}
    </Label>
    {children}
    {error && (
      <div className="flex items-center gap-1 text-red-400 text-xs">
        <AlertCircle className="w-3 h-3" />
        {error}
      </div>
    )}
  </div>
);

export default function ContactFormModal({ isOpen, onClose }: ContactFormModalProps) {
  // Detect Base mini-app environment
  const { context } = useMiniKit();
  const isInBaseMiniApp = !!context;

  const [formData, setFormData] = useState<FormData>({
    category: '',
    itemName: '',
    email: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');

  const [backdropStyles, setBackdropStyles] = useState<{
    backdropFilter?: string;
    WebkitBackdropFilter?: string;
    background?: string;
    boxShadow?: string;
  }>({
    background: 'rgba(0, 0, 0, 0.7)',
  });

  // Stable onClose callback
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stableOnClose = useCallback(() => {
    try {
      onCloseRef.current();
    } catch (error) {
      // Modal close error - continue silently
    }
  }, []);

  // Client-side backdrop detection
  React.useEffect(() => {
    const clientBackdropStyles = getBackdropFilterCSS('xl');
    setBackdropStyles(clientBackdropStyles);
  }, []);

  // Escape key handler
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: Event) => {
      const keyboardEvent = e as KeyboardEvent;
      if (keyboardEvent.key === 'Escape') {
        stableOnClose();
      }
    };

    const keydownListenerResult = addWindowEventListenerSafe('keydown', handleEscape);

    return () => {
      if (keydownListenerResult.success) {
        removeWindowEventListenerSafe('keydown', handleEscape);
      }
    };
  }, [isOpen, stableOnClose]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.category.trim()) {
      newErrors.category = 'Please select a category';
    }

    if (!formData.itemName.trim()) {
      newErrors.itemName = 'Please enter the item name';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Please enter your email';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        newErrors.email = 'Please enter a valid email address';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      category: '',
      itemName: '',
      email: '',
    });
    setErrors({});
    setSubmitError('');
    setSubmitSuccess(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // API call to backend
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/v1/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitSuccess(true);
        // Reset form after 2 seconds and close modal
        setTimeout(() => {
          resetForm();
          stableOnClose();
        }, 2000);
      } else {
        setSubmitError(result.message || 'Failed to send message. Please try again.');
      }
    } catch (error) {
      console.error('Contact form submission error:', error);
      setSubmitError('Failed to send message. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      resetForm();
      stableOnClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{
          backgroundColor: backdropStyles.background || 'rgba(0, 0, 0, 0.7)',
          backdropFilter: backdropStyles.backdropFilter,
          WebkitBackdropFilter: backdropStyles.WebkitBackdropFilter,
          boxShadow: backdropStyles.boxShadow,
        }}
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.98, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.98, opacity: 0 }}
          transition={{
            duration: 0.15,
            ease: 'easeOut',
            scale: {
              // Disable scale animation on mobile browsers OR when in Base mini-app
              duration:
                typeof window !== 'undefined' &&
                (window.innerWidth < 768 || isInBaseMiniApp)
                  ? 0
                  : 0.15,
            },
          }}
          className="bg-black rounded-2xl sm:rounded-3xl overflow-hidden max-w-full sm:max-w-md w-full shadow-goldGlow border border-[#D0B264]/40 max-h-[95vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-[#D0B264]/20">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#D0B264] mb-1">Get in Touch</h2>
                <p className="text-sm text-[#FFFFFF]/70">
                  Don&apos;t see what you&apos;re looking for? Tell us what you need!
                </p>
              </div>
              <button
                onClick={handleClose}
                disabled={isSubmitting}
                className="text-[#D0B264]/80 hover:text-[#D0B264] transition-colors duration-150 p-1 disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {submitSuccess ? (
              <div className="text-center py-8">
                <div className="bg-emerald-500/10 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-emerald-400 mb-2">Message Sent!</h3>
                <p className="text-sm text-[#FFFFFF]/70">
                  Thank you for reaching out. We&apos;ll get back to you soon!
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Category Dropdown */}
                <FormField label="Category" required error={errors.category}>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-3 bg-black/50 border border-[#D0B264]/20 rounded-lg text-white text-sm hover:border-[#D0B264]/40 focus:border-[#D0B264] focus:outline-none transition-colors"
                    disabled={isSubmitting}
                  >
                    <option value="">Select a category...</option>
                    {LUXURY_CATEGORIES.map((category) => (
                      <option key={category.value} value={category.value}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                {/* Item Name */}
                <FormField label="Item Name" required error={errors.itemName}>
                  <Input
                    value={formData.itemName}
                    onChange={(e) => setFormData({ ...formData, itemName: e.target.value })}
                    className="bg-black/50 border-[#D0B264]/20 text-white h-12 hover:border-[#D0B264]/40 focus:border-[#D0B264] transition-colors"
                    placeholder="What are you looking for?"
                    disabled={isSubmitting}
                  />
                </FormField>

                {/* Email */}
                <FormField label="Your Email" required error={errors.email}>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="bg-black/50 border-[#D0B264]/20 text-white h-12 hover:border-[#D0B264]/40 focus:border-[#D0B264] transition-colors"
                    placeholder="your@email.com"
                    disabled={isSubmitting}
                  />
                </FormField>

                {/* Error Message */}
                {submitError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <p className="text-red-400 text-sm">{submitError}</p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 hover:from-[#D0B264]/90 hover:to-[#D0B264]/70 text-black font-semibold py-3 px-6 rounded-lg transition-all duration-150 transform active:scale-[0.98] shadow-goldGlow text-sm md:hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Sending...' : 'Send Message'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
