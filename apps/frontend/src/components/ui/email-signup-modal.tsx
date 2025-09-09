'use client';

import type React from 'react';
import { useState } from 'react';
import { X, Calendar, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface EmailSignupModalProps {
  isOpen: boolean;
  onClose: () => void;
  productTitle: string;
}

export const EmailSignupModal: React.FC<EmailSignupModalProps> = ({
  isOpen,
  onClose,
  productTitle,
}) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Please enter your email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // TODO: Replace with actual API call
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulated API call

      setIsSubmitted(true);
      setIsSubmitting(false);

      // Auto-close after success
      setTimeout(() => {
        onClose();
        setIsSubmitted(false);
        setEmail('');
      }, 2000);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    onClose();
    setEmail('');
    setError('');
    setIsSubmitted(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15, ease: 'easeOut' }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
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
          <div className="p-6 pb-4 border-b border-[#D0B264]/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-[#D0B264]/10 rounded-full">
                  <Calendar className="w-6 h-6 text-[#D0B264]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#D0B264] mb-1">Stay Updated</h2>
                  <p className="text-sm text-[#FFFFFF]/70">Get launch notifications</p>
                </div>
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
            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <p className="text-[#FFFFFF]/80 mb-4 leading-relaxed">
                    Enter your email to stay up to date with the news of{' '}
                    <span className="font-semibold text-[#D0B264]">{productTitle}</span> launch.
                  </p>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="email"
                    className="text-[#DCDDCC] text-sm font-medium flex items-center gap-1"
                  >
                    Email address
                    <span className="text-red-400 text-sm">*</span>
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#D0B264]/60" />
                    <input
                      type="email"
                      id="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setError(''); // Clear error when user types
                      }}
                      placeholder="your@email.com"
                      className="w-full pl-10 pr-4 py-3 bg-black/50 border border-[#D0B264]/20 rounded-lg text-white text-sm hover:border-[#D0B264]/40 focus:border-[#D0B264] focus:outline-none transition-colors placeholder:text-[#FFFFFF]/40"
                      disabled={isSubmitting}
                    />
                  </div>
                  {error && (
                    <div className="flex items-center gap-1 text-red-400 text-xs">
                      <AlertCircle className="w-3 h-3" />
                      {error}
                    </div>
                  )}
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 hover:from-[#D0B264]/90 hover:to-[#D0B264]/70 text-black font-semibold py-3 px-6 rounded-lg transition-all duration-150 transform active:scale-[0.98] shadow-goldGlow text-sm md:hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Subscribing...
                      </div>
                    ) : (
                      'Notify Me'
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-8">
                <div className="bg-emerald-500/10 rounded-full p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-emerald-400 mb-2">
                  You&apos;re all set!
                </h3>
                <p className="text-sm text-[#FFFFFF]/70">
                  We&apos;ll notify you when{' '}
                  <span className="font-medium text-[#D0B264]">{productTitle}</span> launches.
                </p>
              </div>
            )}

            {!isSubmitted && (
              <p className="text-xs text-[#FFFFFF]/50 text-center mt-4">
                We&apos;ll only send you updates about this product launch. No spam, ever.
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
