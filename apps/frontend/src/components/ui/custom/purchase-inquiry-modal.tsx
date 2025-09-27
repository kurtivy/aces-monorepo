'use client';

import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../button';
import { Input } from '../input';
import { Label } from '../label';
import { X, Send, CheckCircle, AlertCircle, ShoppingCart } from 'lucide-react';
import {
  addWindowEventListenerSafe,
  removeWindowEventListenerSafe,
} from '../../../lib/utils/event-listener-utils';
import { getBackdropFilterCSS } from '../../../lib/utils/browser-utils';

interface PurchaseInquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
  productTicker: string;
  productPrice?: string;
}

interface FormData {
  customerEmail: string;
  customerMessage: string;
}

interface FormErrors {
  customerEmail?: string;
  customerMessage?: string;
}

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
  <div className="space-y-2">
    <Label className="text-sm font-medium text-[#FFFFFF]/90">
      {label}
      {required && <span className="text-red-400 ml-1">*</span>}
    </Label>
    {children}
    {error && (
      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        {error}
      </p>
    )}
  </div>
);

export default function PurchaseInquiryModal({
  isOpen,
  onClose,
  productTitle,
  productTicker,
  productPrice,
}: PurchaseInquiryModalProps) {
  const [formData, setFormData] = useState<FormData>({
    customerEmail: '',
    customerMessage: '',
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

    if (!formData.customerEmail.trim()) {
      newErrors.customerEmail = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.customerEmail)) {
      newErrors.customerEmail = 'Please enter a valid email address';
    }

    // Customer message is optional but if provided should have some content
    if (formData.customerMessage.trim() && formData.customerMessage.trim().length < 10) {
      newErrors.customerMessage = 'Message should be at least 10 characters if provided';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData({
      customerEmail: '',
      customerMessage: '',
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
      // API call to backend (using local backend for testing)
      const response = await fetch('http://localhost:3002/api/v1/purchase', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productTitle,
          productTicker,
          productPrice,
          customerEmail: formData.customerEmail,
          customerMessage: formData.customerMessage || undefined,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        setSubmitSuccess(true);
        // Reset form after 3 seconds and close modal
        setTimeout(() => {
          resetForm();
          stableOnClose();
        }, 3000);
      } else {
        setSubmitError(result.message || 'Failed to send inquiry. Please try again.');
      }
    } catch (error) {
      console.error('Purchase inquiry submission error:', error);
      setSubmitError('Failed to send inquiry. Please check your connection and try again.');
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
              duration: typeof window !== 'undefined' && window.innerWidth < 768 ? 0 : 0.15,
            },
          }}
          className="bg-black rounded-2xl sm:rounded-3xl overflow-hidden max-w-full sm:max-w-md w-full shadow-goldGlow border border-[#D0B264]/40 max-h-[95vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 pb-4 border-b border-[#D0B264]/20">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingCart className="w-5 h-5 text-[#D0B264]" />
                  <h2 className="text-xl font-bold text-[#D0B264]">Purchase Inquiry</h2>
                </div>
                <p className="text-sm text-[#FFFFFF]/70">
                  Interested in <span className="text-[#D0B264] font-medium">{productTitle}</span>?
                </p>
                <p className="text-xs text-[#FFFFFF]/50 mt-1">
                  We&apos;ll get back to you within 24 hours to discuss details.
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
                <h3 className="text-lg font-semibold text-emerald-400 mb-2">Inquiry Sent!</h3>
                <p className="text-sm text-[#FFFFFF]/70 mb-2">
                  Thank you for your interest in{' '}
                  <span className="text-[#D0B264]">{productTitle}</span>!
                </p>
                <p className="text-xs text-[#FFFFFF]/50">
                  We&apos;ll contact you soon to discuss the purchase details.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Product Info Display */}
                <div className="bg-[#D0B264]/10 border border-[#D0B264]/20 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[#D0B264] font-semibold text-sm">{productTitle}</h3>
                      <p className="text-[#FFFFFF]/60 text-xs">Token: {productTicker}</p>
                    </div>
                    {productPrice && (
                      <div className="text-right">
                        <p className="text-[#D0B264] font-bold text-sm">{productPrice}</p>
                        <p className="text-[#FFFFFF]/50 text-xs">Listed Price</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Email */}
                <FormField label="Your Email" required error={errors.customerEmail}>
                  <Input
                    type="email"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                    className="bg-black/50 border-[#D0B264]/20 text-white h-12 hover:border-[#D0B264]/40 focus:border-[#D0B264] transition-colors"
                    placeholder="your@email.com"
                    disabled={isSubmitting}
                  />
                </FormField>

                {/* Optional Message */}
                <FormField label="Message (Optional)" error={errors.customerMessage}>
                  <textarea
                    value={formData.customerMessage}
                    onChange={(e) => setFormData({ ...formData, customerMessage: e.target.value })}
                    className="w-full px-3 py-3 bg-black/50 border border-[#D0B264]/20 rounded-lg text-white text-sm hover:border-[#D0B264]/40 focus:border-[#D0B264] focus:outline-none transition-colors resize-none"
                    placeholder="Any specific questions or requirements? (Optional)"
                    rows={3}
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
                    {isSubmitting ? 'Sending Inquiry...' : 'Send Purchase Inquiry'}
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
