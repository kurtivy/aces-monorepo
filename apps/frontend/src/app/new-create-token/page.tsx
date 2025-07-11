'use client';

import type React from 'react';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePrivy } from '@privy-io/react-auth';
import {
  Upload,
  ImageIcon,
  Sparkles,
  Crown,
  CheckCircle,
  AlertCircle,
  Mail,
  Wallet,
  Twitter,
  User,
  LogOut,
  LogIn,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CreateSubmissionSchema, type CreateSubmissionRequest } from '@aces/utils';
import { SubmissionsApi } from '@/lib/api/submissions';
import Image from 'next/image';

export default function CreateTokenForm() {
  const { user, login, logout, ready } = usePrivy();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<CreateSubmissionRequest>({
    resolver: zodResolver(CreateSubmissionSchema),
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setImagePreview(result);
        setValue('imageUrl', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const onSubmit = async (data: CreateSubmissionRequest) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitMessage('');

    try {
      // Clean up empty string values for optional fields
      const cleanedData = {
        ...data,
        destinationWallet: data.destinationWallet === '' ? undefined : data.destinationWallet,
        twitterLink: data.twitterLink === '' ? undefined : data.twitterLink,
      };
      // Use the test endpoint that doesn't require auth
      const response = await SubmissionsApi.createTestSubmission(cleanedData);

      if (response.success) {
        setSubmitStatus('success');
        setSubmitMessage(
          'Token submission created successfully! It will be reviewed for approval.',
        );
        reset();
        setImagePreview(null);
      } else {
        setSubmitStatus('error');
        const errorMessage =
          typeof response.error === 'string'
            ? response.error
            : response.error?.message || 'Failed to create token submission';
        setSubmitMessage(errorMessage);
      }
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage('Network error occurred. Please try again.');
      console.error('Error creating token:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
      {/* Authentication Header */}
      <div className="border-b border-gray-800/50 bg-gray-900/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 rounded-xl flex items-center justify-center">
                <User className="w-4 h-4 text-black" />
              </div>
              <div>
                {ready ? (
                  user ? (
                    <div>
                      <p className="text-sm font-medium text-white">
                        Logged in as: {user.email?.address || user.wallet?.address || 'User'}
                      </p>
                      <p className="text-xs text-gray-400">Ready to submit tokens</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-300">Not logged in</p>
                      <p className="text-xs text-gray-400">Please log in to submit tokens</p>
                    </div>
                  )
                ) : (
                  <div>
                    <p className="text-sm font-medium text-gray-300">Loading...</p>
                    <p className="text-xs text-gray-400">Initializing authentication</p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              {ready &&
                (user ? (
                  <Button
                    onClick={logout}
                    variant="outline"
                    size="sm"
                    className="bg-gray-800/40 border-gray-700/50 text-gray-300 hover:bg-gray-700/50 hover:text-white"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </Button>
                ) : (
                  <Button
                    onClick={login}
                    size="sm"
                    className="bg-gradient-to-r from-[#D0B264] to-[#D0B264]/90 hover:from-[#D0B264]/90 hover:to-[#D0B264]/80 text-black font-medium"
                  >
                    <LogIn className="w-4 h-4 mr-2" />
                    Login
                  </Button>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="border-b border-gray-800/50 bg-gray-900/50 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 rounded-2xl flex items-center justify-center">
              <Crown className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Create Token</h1>
              <p className="text-gray-400">Tokenize your luxury assets</p>
            </div>
          </div>
        </div>
      </div>

      {/* Authentication Warning */}
      {ready && !user && (
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <div className="p-4 rounded-xl flex items-center gap-3 bg-yellow-900/20 border border-yellow-500/30 text-yellow-400">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p>Please log in to submit your token for approval.</p>
          </div>
        </div>
      )}

      {/* Status Message */}
      {submitStatus !== 'idle' && (
        <div className="max-w-4xl mx-auto px-4 pt-6">
          <div
            className={`p-4 rounded-xl flex items-center gap-3 ${
              submitStatus === 'success'
                ? 'bg-green-900/20 border border-green-500/30 text-green-400'
                : 'bg-red-900/20 border border-red-500/30 text-red-400'
            }`}
          >
            {submitStatus === 'success' ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
            )}
            <p>{submitMessage}</p>
          </div>
        </div>
      )}

      {/* Form Container */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Asset Information Section */}
          <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-black" />
                </div>
                <h2 className="text-xl font-bold text-white">Asset Details</h2>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Email */}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium text-gray-300">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    {...register('email')}
                    className="bg-gray-800/40 border-gray-700/50 text-white placeholder:text-gray-500 rounded-xl h-12 pl-11 focus:border-[#D0B264]/50 focus:ring-[#D0B264]/20"
                  />
                </div>
                {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
              </div>

              {/* Asset Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium text-gray-300">
                  Asset Name *
                </Label>
                <Input
                  id="name"
                  placeholder="e.g., 2023 Lamborghini Huracán"
                  {...register('name')}
                  className="bg-gray-800/40 border-gray-700/50 text-white placeholder:text-gray-500 rounded-xl h-12 focus:border-[#D0B264]/50 focus:ring-[#D0B264]/20"
                />
                {errors.name && <p className="text-red-400 text-sm">{errors.name.message}</p>}
              </div>

              {/* Symbol/Ticker */}
              <div className="space-y-2">
                <Label htmlFor="symbol" className="text-sm font-medium text-gray-300">
                  Token Symbol *
                </Label>
                <Input
                  id="symbol"
                  placeholder="LAMBO"
                  {...register('symbol')}
                  className="bg-gray-800/40 border-gray-700/50 text-white placeholder:text-gray-500 rounded-xl h-12 focus:border-[#D0B264]/50 focus:ring-[#D0B264]/20 font-mono uppercase"
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                  }}
                />
                {errors.symbol && <p className="text-red-400 text-sm">{errors.symbol.message}</p>}
                <p className="text-xs text-gray-400">
                  Will be displayed as ${watch('symbol') || 'TICKER'}
                </p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium text-gray-300">
                  Asset Description *
                </Label>
                <Textarea
                  id="description"
                  placeholder="Provide detailed information about your luxury asset..."
                  {...register('description')}
                  className="bg-gray-800/40 border-gray-700/50 text-white placeholder:text-gray-500 rounded-xl min-h-[120px] focus:border-[#D0B264]/50 focus:ring-[#D0B264]/20 resize-none"
                />
                {errors.description && (
                  <p className="text-red-400 text-sm">{errors.description.message}</p>
                )}
              </div>

              {/* Proof of Ownership */}
              <div className="space-y-2">
                <Label htmlFor="proofOfOwnership" className="text-sm font-medium text-gray-300">
                  Proof of Ownership *
                </Label>
                <Input
                  id="proofOfOwnership"
                  placeholder="VIN#, Serial#, Certificate# or other proof"
                  {...register('proofOfOwnership')}
                  className="bg-gray-800/40 border-gray-700/50 text-white placeholder:text-gray-500 rounded-xl h-12 focus:border-[#D0B264]/50 focus:ring-[#D0B264]/20"
                />
                {errors.proofOfOwnership && (
                  <p className="text-red-400 text-sm">{errors.proofOfOwnership.message}</p>
                )}
              </div>

              {/* Destination Wallet */}
              <div className="space-y-2">
                <Label htmlFor="destinationWallet" className="text-sm font-medium text-gray-300">
                  Profile/Destination Wallet
                </Label>
                <div className="relative">
                  <Wallet className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="destinationWallet"
                    placeholder="0x..."
                    {...register('destinationWallet')}
                    className="bg-gray-800/40 border-gray-700/50 text-white placeholder:text-gray-500 rounded-xl h-12 pl-11 focus:border-[#D0B264]/50 focus:ring-[#D0B264]/20 font-mono"
                  />
                </div>
                {errors.destinationWallet && (
                  <p className="text-red-400 text-sm">{errors.destinationWallet.message}</p>
                )}
              </div>

              {/* Twitter Link */}
              <div className="space-y-2">
                <Label htmlFor="twitterLink" className="text-sm font-medium text-gray-300">
                  Twitter Link
                </Label>
                <div className="relative">
                  <Twitter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="twitterLink"
                    placeholder="https://twitter.com/yourusername"
                    {...register('twitterLink')}
                    className="bg-gray-800/40 border-gray-700/50 text-white placeholder:text-gray-500 rounded-xl h-12 pl-11 focus:border-[#D0B264]/50 focus:ring-[#D0B264]/20"
                  />
                </div>
                {errors.twitterLink && (
                  <p className="text-red-400 text-sm">{errors.twitterLink.message}</p>
                )}
                <p className="text-xs text-gray-400">
                  Note: The Twitter link will be owned by whoever owns the NFT for the product
                </p>
              </div>
            </div>
          </div>

          {/* Media Section */}
          <div className="bg-gray-900/95 backdrop-blur-xl border border-gray-800/50 rounded-2xl shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-r from-[#D0B264] to-[#D0B264]/80 rounded-xl flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-black" />
                </div>
                <h2 className="text-xl font-bold text-white">Asset Image</h2>
              </div>
            </div>

            <div className="p-6 space-y-6">
              {/* Picture Upload */}
              <div className="space-y-2">
                <Label className="text-sm font-medium text-gray-300">Asset Image URL *</Label>
                <Input
                  placeholder="https://example.com/your-asset-image.jpg"
                  {...register('imageUrl')}
                  className="bg-gray-800/40 border-gray-700/50 text-white placeholder:text-gray-500 rounded-xl h-12 focus:border-[#D0B264]/50 focus:ring-[#D0B264]/20"
                />
                {errors.imageUrl && (
                  <p className="text-red-400 text-sm">{errors.imageUrl.message}</p>
                )}
                <p className="text-xs text-gray-400">
                  Please provide a direct URL to your asset image
                </p>

                {/* Optional file upload for preview */}
                <div className="mt-4">
                  <Label className="text-sm font-medium text-gray-300">Or upload for preview</Label>
                  <div className="relative mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="bg-gray-800/40 border-2 border-dashed border-gray-700/50 rounded-xl p-8 text-center hover:border-[#D0B264]/50 transition-colors">
                      {imagePreview ? (
                        <div className="space-y-4">
                          <Image
                            src={imagePreview || '/placeholder.svg'}
                            alt="Preview"
                            className="max-w-full max-h-48 mx-auto rounded-lg object-cover"
                          />
                          <p className="text-sm text-gray-400">Click to change image</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <Upload className="w-12 h-12 text-gray-400 mx-auto" />
                          <div>
                            <p className="text-white font-medium">Upload your asset image</p>
                            <p className="text-sm text-gray-400">
                              PNG, JPG up to 10MB (for preview only)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-center">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-gradient-to-r from-[#D0B264] to-[#D0B264]/90 hover:from-[#D0B264]/90 hover:to-[#D0B264]/80 text-black font-bold py-4 px-12 text-lg rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Submitting...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Crown className="w-5 h-5" />
                  Submit for Approval
                </div>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
