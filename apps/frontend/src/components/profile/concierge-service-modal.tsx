'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Send, CheckCircle, AlertCircle, MessageCircle } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  addWindowEventListenerSafe,
  removeWindowEventListenerSafe,
} from '@/lib/utils/event-listener-utils';
import { getBackdropFilterCSS } from '@/lib/utils/browser-utils';

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

interface ConciergeServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ConciergeFormData {
  email: string;
  message: string;
}

interface ConciergeFormErrors {
  email?: string;
  message?: string;
}

export function ConciergeServiceModal({ isOpen, onClose }: ConciergeServiceModalProps) {
  const [formData, setFormData] = useState<ConciergeFormData>({ email: '', message: '' });
  const [errors, setErrors] = useState<ConciergeFormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');
  const [isMounted, setIsMounted] = useState(false);
  const [backdropStyles, setBackdropStyles] = useState<{
    backdropFilter?: string;
    WebkitBackdropFilter?: string;
    background?: string;
    boxShadow?: string;
  }>({
    background: 'rgba(0, 0, 0, 0.7)',
  });

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const stableOnClose = useCallback(() => {
    try {
      onCloseRef.current();
    } catch (error) {
      // swallow close errors to keep modal resilient
    }
  }, []);

  useEffect(() => {
    setIsMounted(true);
    return () => setIsMounted(false);
  }, []);

  useEffect(() => {
    const clientBackdropStyles = getBackdropFilterCSS('xl');
    setBackdropStyles(clientBackdropStyles);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const handleEscape: EventListener = (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === 'Escape' && !isSubmitting) {
        stableOnClose();
      }
    };

    const listenerResult = addWindowEventListenerSafe('keydown', handleEscape);

    return () => {
      if (listenerResult.success) {
        removeWindowEventListenerSafe('keydown', handleEscape);
      }
    };
  }, [isOpen, isSubmitting, stableOnClose]);

  const resetForm = () => {
    setFormData({ email: '', message: '' });
    setErrors({});
    setSubmitError('');
    setSubmitSuccess(false);
  };

  const validateForm = (): boolean => {
    const validationErrors: ConciergeFormErrors = {};

    if (!formData.email.trim()) {
      validationErrors.email = 'Please enter your email address';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email)) {
        validationErrors.email = 'Please enter a valid email';
      }
    }

    if (!formData.message.trim()) {
      validationErrors.message = 'Please share how we can help';
    }

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      const apiUrl = getApiBaseUrl();
      const response = await fetch(`${apiUrl}/api/v1/concierge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        setSubmitError(result.message || 'We could not send your request. Please try again.');
        return;
      }

      setSubmitSuccess(true);
      setTimeout(() => {
        resetForm();
        stableOnClose();
      }, 2000);
    } catch (error) {
      console.error('Concierge support submission error:', error);
      setSubmitError('Something went wrong. Please check your connection and try again.');
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

  if (!isMounted || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
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
              duration: typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 0.15,
            },
          }}
          className="bg-black rounded-2xl sm:rounded-3xl overflow-hidden max-w-full sm:max-w-md w-full shadow-goldGlow border border-[#D0B264]/40 max-h-[95vh]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="p-6 pb-4 border-b border-[#D0B264]/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-[#D0B264]">
                  <MessageCircle className="w-5 h-5" />
                  <h2 className="text-xl font-bold">ACES Concierge</h2>
                </div>
                <p className="text-sm text-[#FFFFFF]/70 mt-1">
                  Share your email and question and the ACES team will reach out directly.
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

          <div className="p-6">
            {submitSuccess ? (
              <div className="text-center py-8">
                <div className="bg-emerald-500/10 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-emerald-400 mb-2">
                  Request Sent Successfully
                </h3>
                <p className="text-sm text-[#FFFFFF]/70">
                  Thank you! Eric will contact you shortly at the email you provided.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <Label className="text-[#DCDDCC] text-sm font-medium flex items-center gap-1">
                    Your Email<span className="text-red-400 text-sm">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, email: event.target.value }))
                    }
                    placeholder="you@example.com"
                    className="bg-black/50 border-[#D0B264]/20 text-white h-12 hover:border-[#D0B264]/40 focus:border-[#D0B264] transition-colors"
                    disabled={isSubmitting}
                  />
                  {errors.email && (
                    <div className="flex items-center gap-1 text-red-400 text-xs">
                      <AlertCircle className="w-3 h-3" />
                      {errors.email}
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <Label className="text-[#DCDDCC] text-sm font-medium flex items-center gap-1">
                    How can we help?<span className="text-red-400 text-sm">*</span>
                  </Label>
                  <Textarea
                    value={formData.message}
                    onChange={(event) =>
                      setFormData((prev) => ({ ...prev, message: event.target.value }))
                    }
                    placeholder="Share your question or the support you need..."
                    className="bg-black/50 border-[#D0B264]/20 text-white min-h-[120px] hover:border-[#D0B264]/40 focus:border-[#D0B264] transition-colors"
                    disabled={isSubmitting}
                  />
                  {errors.message && (
                    <div className="flex items-center gap-1 text-red-400 text-xs">
                      <AlertCircle className="w-3 h-3" />
                      {errors.message}
                    </div>
                  )}
                </div>

                {submitError && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <p className="text-red-400 text-sm">{submitError}</p>
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 hover:from-[#D0B264]/90 hover:to-[#D0B264]/70 text-black font-semibold py-3 px-6 rounded-lg transition-all duration-150 transform active:scale-[0.98] shadow-goldGlow text-sm md:hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    <Send className="w-4 h-4 mr-2" />
                    {isSubmitting ? 'Sending...' : 'Submit Request'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
