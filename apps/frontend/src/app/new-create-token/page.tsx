'use client';

import type React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePrivy } from '@privy-io/react-auth';
import { Upload, Crown, CheckCircle, AlertCircle, Mail, Wallet, Twitter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CreateSubmissionSchema, type CreateSubmissionRequest } from '@aces/utils';
import { SubmissionsApi } from '@/lib/api/submissions';
import Image from 'next/image';
import Footer from '@/components/ui/custom/footer';
import LaunchHeader from '@/components/new-launch/launch-header';
import AnimatedDotsBackground from '@/components/ui/custom/animated-dots-background';
import { useAuth } from '@/lib/auth/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VerificationForm } from '@/components/seller/verification-form';

// Label Section Component (Short tile)
const LabelSection = ({ label, error }: { label: string; error?: string }) => (
  <div className="w-1/3">
    <div className="bg-[#D0B284]/10 border border-[#D0B284] rounded-xl shadow-lg hover:shadow-xl hover:border-[#D7BF75] transition-all duration-300 p-1 font-heading uppercase">
      <span className="text-[#D0B284] flex justify-center items-center font-medium text-lg">
        {label}
      </span>
      {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
    </div>
  </div>
);

// Input Section Component (Full tile)
const InputSection = ({ children }: { children: React.ReactNode }) => (
  <div className="w-full pl-12">
    <div className="bg-[#231F20] border border-[#D0B284] rounded-xl shadow-lg hover:shadow-xl hover:border-[#D7BF75] transition-all duration-300">
      {children}
    </div>
  </div>
);

export default function CreateTokenForm() {
  const { user, ready } = usePrivy();
  const { user: authUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,

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
      const cleanedData = {
        ...data,
        destinationWallet: data.destinationWallet === '' ? undefined : data.destinationWallet,
        twitterLink: data.twitterLink === '' ? undefined : data.twitterLink,
      };

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

  // Check if user is a verified seller
  const canCreateToken = authUser?.sellerStatus === 'APPROVED';
  const isPendingVerification = authUser?.sellerStatus === 'PENDING';
  const isRejected = authUser?.sellerStatus === 'REJECTED';

  return (
    <div className="min-h-screen bg-gradient-to-b from-black to-[#231F20] relative">
      {/* Add animated dots background */}
      <AnimatedDotsBackground
        opacity={0.18}
        dotSpacing={40}
        dotSize={1.2}
        animationSpeed={0.6}
        waveType="radial"
        minOpacity={0.06}
        className="z-0"
      />

      {/* Add a subtle radial gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(26, 26, 26, 0) 0%, rgba(0, 0, 0, 0.3) 100%)',
        }}
      />

      {/* Launch Header */}
      <div className="relative z-50">
        <LaunchHeader />
      </div>

      {/* Authentication Warning */}
      {ready && !user && (
        <div className="max-w-4xl mx-auto px-6 pt-8 relative z-20">
          <div className="p-6 rounded-2xl flex items-center gap-4 bg-yellow-900/20 border-2 border-yellow-500/50 text-yellow-400 shadow-lg">
            <AlertCircle className="w-6 h-6 flex-shrink-0" />
            <p className="text-lg">Please log in to submit your token for approval.</p>
          </div>
        </div>
      )}
      {/* Status Message */}
      {submitStatus !== 'idle' && (
        <div className="max-w-4xl mx-auto px-6 pt-8 relative z-20">
          <div
            className={`p-6 rounded-2xl flex items-center gap-4 shadow-lg ${
              submitStatus === 'success'
                ? 'bg-green-900/20 border-2 border-green-500/50 text-green-400'
                : 'bg-red-900/20 border-2 border-red-500/50 text-red-400'
            }`}
          >
            {submitStatus === 'success' ? (
              <CheckCircle className="w-6 h-6 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 flex-shrink-0" />
            )}
            <p className="text-lg">{submitMessage}</p>
          </div>
        </div>
      )}
      {/* Mosaic Tile Form */}
      <div className="max-w-4xl mx-auto px-6 py-12 relative z-20">
        {/* Page Title */}
        <div className="mb-8 text-center">
          <h1
            className="text-5xl font-bold text-[#D7BF75] mb-4"
            style={{
              textShadow: '0 0 20px rgba(208, 178, 100, 0.3)',
            }}
          >
            Submit your RWA!
          </h1>
        </div>

        {/* Introductory Text */}
        <div className="mb-12 text-center">
          <p className="text-lg font-system text-[#DCDDCC] leading-relaxed">
            Hey, while we haven&apos;t officially launched yet, if you have a high-value Real-World
            Asset (RWA) that you would like to tokenize, submit a form here and maybe you can be
            part of our launch!
          </p>
        </div>

        {/* Verification Status Banner */}
        {!canCreateToken && (
          <div className="mb-6 bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20">
            <h2 className="text-[#D0B284] text-2xl font-bold mb-4">Seller Verification Required</h2>

            {isPendingVerification ? (
              <div>
                <p className="text-[#DCDDCC] mb-4">
                  Your seller verification is pending approval. You&apos;ll be notified once your
                  application has been reviewed.
                </p>
                <div className="flex items-center gap-2 text-yellow-400">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
                  </span>
                  <span>Application Under Review</span>
                </div>
              </div>
            ) : isRejected ? (
              <div>
                <p className="text-[#DCDDCC] mb-2">
                  Your previous verification application was not approved.
                </p>
                {authUser?.rejectionReason && (
                  <p className="text-red-400 mb-4">Reason: {authUser.rejectionReason}</p>
                )}
                <Button
                  variant="ghost"
                  className="text-[#D0B284] hover:bg-[#D0B284]/20"
                  onClick={() => setShowVerificationModal(true)}
                >
                  Apply Again
                </Button>
              </div>
            ) : (
              <div>
                <p className="text-[#DCDDCC] mb-4">
                  To create and list tokens on our platform, you need to complete the seller
                  verification process. This helps ensure the authenticity and security of all
                  listings.
                </p>
                <Button
                  variant="ghost"
                  className="text-[#D0B284] hover:bg-[#D0B284]/20"
                  onClick={() => setShowVerificationModal(true)}
                >
                  Start Verification Process
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Create Token Form - disabled if not verified */}
        <div
          className={`bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20 ${!canCreateToken ? 'opacity-50 pointer-events-none' : ''}`}
        >
          <h2 className="text-[#D0B284] text-2xl font-bold mb-6">Create Token</h2>

          {/* Your existing create token form goes here */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-0">
            {/* Email Field */}
            <LabelSection label="Email" error={errors.email?.message} />
            <InputSection>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#D0B284]" />
                <Input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  {...register('email')}
                  className="bg-transparent border-0 text-white placeholder:text-[#DCDDCC]/60 text-lg h-14 pl-12 focus-visible:!ring-golden-beige focus-visible:!ring-2 focus-visible:!ring-offset-0 focus-visible:!border-golden-beige"
                />
              </div>
            </InputSection>

            {/* Asset Name Field */}
            <LabelSection label="Asset Name" error={errors.name?.message} />
            <InputSection>
              <Input
                id="name"
                placeholder="e.g., 2023 Lamborghini Huracán"
                {...register('name')}
                className="bg-transparent border-0 text-white placeholder:text-[#DCDDCC]/60 text-lg h-14 "
              />
            </InputSection>

            {/* Symbol Field */}
            <LabelSection label="Token Symbol" error={errors.symbol?.message} />
            <InputSection>
              <div className="space-y-3">
                <Input
                  id="symbol"
                  placeholder="LAMBO"
                  {...register('symbol')}
                  className="bg-transparent border-0 text-white placeholder:text-[#DCDDCC]/60 text-lg h-14  font-mono uppercase"
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                  }}
                />
              </div>
            </InputSection>

            {/* Description Field */}
            <LabelSection label="Asset Description" error={errors.description?.message} />
            <InputSection>
              <Textarea
                id="description"
                placeholder="Provide detailed information about your luxury asset..."
                {...register('description')}
                className="bg-transparent border-0 text-white placeholder:text-[#DCDDCC]/60 text-lg min-h-[120px]  resize-none"
              />
            </InputSection>

            {/* Proof of Ownership Field */}
            <LabelSection label="Proof of Ownership" error={errors.proofOfOwnership?.message} />
            <InputSection>
              <Input
                id="proofOfOwnership"
                placeholder="VIN#, Serial#, Certificate# or other proof"
                {...register('proofOfOwnership')}
                className="bg-transparent border-0 text-white placeholder:text-[#DCDDCC]/60 text-lg h-14 "
              />
            </InputSection>

            {/* Destination Wallet Field */}
            <LabelSection label="Destination Wallet" error={errors.destinationWallet?.message} />
            <InputSection>
              <div className="relative">
                <Wallet className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#D0B284]" />
                <Input
                  id="destinationWallet"
                  placeholder="0x..."
                  {...register('destinationWallet')}
                  className="bg-transparent border-0 text-white placeholder:text-[#DCDDCC]/60 text-lg h-14 pl-12  font-mono"
                />
              </div>
            </InputSection>

            {/* Twitter Link Field */}
            <LabelSection label="Twitter Link" error={errors.twitterLink?.message} />
            <InputSection>
              <div className="space-y-3">
                <div className="relative">
                  <Twitter className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#D0B284]" />
                  <Input
                    id="twitterLink"
                    placeholder="https://twitter.com/yourusername"
                    {...register('twitterLink')}
                    className="bg-transparent border-0 text-white placeholder:text-[#DCDDCC]/60 text-lg h-14 pl-12 "
                  />
                </div>
              </div>
            </InputSection>

            {/* Image URL Field */}
            <LabelSection label="Asset Image URL" error={errors.imageUrl?.message} />
            <InputSection>
              <div className="space-y-4">
                <Input
                  placeholder="https://example.com/your-asset-image.jpg"
                  {...register('imageUrl')}
                  className="bg-transparent border-0 text-white placeholder:text-[#DCDDCC]/60 text-lg h-14 "
                />
              </div>
            </InputSection>

            {/* Image Upload Field */}
            <LabelSection label="Upload Preview" />
            <InputSection>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="border-2 border-dashed border-[#D0B284]/50 rounded-xl p-8 text-center hover:border-[#D7BF75] transition-colors">
                  {imagePreview ? (
                    <div className="space-y-4">
                      <Image
                        src={imagePreview || '/placeholder.svg'}
                        alt="Preview"
                        width={200}
                        height={200}
                        className="max-w-full max-h-48 mx-auto rounded-lg object-cover"
                      />
                      <p className="text-sm text-[#DCDDCC]/70">Click to change image</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <Upload className="w-12 h-12 text-[#D0B284] mx-auto" />
                      <div>
                        <p className="text-white font-medium text-lg">Upload your asset image</p>
                        <p className="text-sm text-[#DCDDCC]/70">
                          PNG, JPG up to 10MB (for preview only)
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </InputSection>

            {/* Submit Button */}
            <div className="flex justify-center pt-12">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-6 px-16 text-xl rounded-3xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl hover:shadow-[#D0B284]/30 transform hover:scale-105"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 border-3 border-black border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Crown className="w-6 h-6" />
                    Submit for Approval
                  </div>
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
      <Footer />

      {/* Verification Modal */}
      <Dialog open={showVerificationModal} onOpenChange={setShowVerificationModal}>
        <DialogContent className="sm:max-w-[800px] bg-black border-[#D0B284]">
          <DialogHeader>
            <DialogTitle className="text-[#D0B284] text-2xl">Seller Verification</DialogTitle>
          </DialogHeader>
          <VerificationForm
            onSuccess={() => setShowVerificationModal(false)}
            onCancel={() => setShowVerificationModal(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
