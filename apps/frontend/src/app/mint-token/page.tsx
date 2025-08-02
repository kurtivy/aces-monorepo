'use client';

import type React from 'react';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePrivy } from '@privy-io/react-auth';
import {
  Upload,
  Crown,
  CheckCircle,
  AlertCircle,
  Wallet,
  FileText,
  MapPin,
  Tag,
  Camera,
  Shield,
  Info,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { CreateSubmissionSchema } from '@aces/utils';
import { SubmissionsApi } from '@/lib/api/submissions';
import Image from 'next/image';
import Footer from '@/components/ui/custom/footer';
import AnimatedDotsBackground from '@/components/ui/custom/animated-dots-background';
import LuxuryAssetsBackground from '@/components/ui/custom/luxury-assets-background';
import { useAuth } from '@/lib/auth/auth-context';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { VerificationForm } from '@/components/seller/verification-form';
import AcesHeader from '@/components/ui/custom/aces-header';
import { PrivyDebug } from '@/components/debug/privy-debug';

// Modern Form Section Component
const FormSection = ({
  icon: Icon,
  title,
  description,
  children,
  className = '',
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <div
    className={`bg-[#1A1A1A]/90 backdrop-blur-sm border border-[#D0B284]/20 rounded-2xl p-8 shadow-2xl hover:shadow-3xl hover:border-[#D0B284]/40 transition-all duration-300 ${className}`}
  >
    <div className="flex items-center gap-4 mb-6">
      <div className="p-3 bg-gradient-to-r from-[#D0B284]/20 to-[#D7BF75]/20 rounded-xl">
        <Icon className="w-6 h-6 text-[#D0B284]" />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-[#D0B284] mb-1">{title}</h2>
        <p className="text-[#DCDDCC]/70 text-sm">{description}</p>
      </div>
    </div>
    <div className="space-y-6">{children}</div>
  </div>
);

// Modern Form Field Component
const FormField = ({
  label,
  icon: Icon,
  error,
  required = false,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div className="space-y-2">
    <label className="flex items-center gap-2 text-[#D0B284] font-medium text-sm uppercase tracking-wide">
      {Icon && <Icon className="w-4 h-4" />}
      {label}
      {required && <span className="text-red-400">*</span>}
    </label>
    <div className="relative">{children}</div>
    {error && (
      <p className="text-red-400 text-sm flex items-center gap-1">
        <AlertCircle className="w-4 h-4" />
        {error}
      </p>
    )}
  </div>
);

// Progress Steps Component
const ProgressSteps = ({ currentStep }: { currentStep: number }) => (
  <div className="flex items-center justify-center mb-12">
    <div className="flex items-center gap-4">
      {[1, 2].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
              step <= currentStep
                ? 'bg-gradient-to-r from-[#D0B284] to-[#D7BF75] text-black'
                : 'bg-[#231F20] border-2 border-[#D0B284]/30 text-[#D0B284]'
            }`}
          >
            {step <= currentStep ? <CheckCircle className="w-5 h-5" /> : step}
          </div>
          {step < 2 && (
            <ChevronRight
              className={`w-6 h-6 mx-2 transition-colors duration-300 ${
                step < currentStep ? 'text-[#D0B284]' : 'text-[#D0B284]/30'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  </div>
);

export default function CreateTokenForm() {
  const { user, ready } = usePrivy();
  const { user: authUser } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<Array<{ preview: string; file: File }>>([]);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState(1);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    control,
  } = useForm({
    resolver: zodResolver(CreateSubmissionSchema),
  });

  // Watch form values to determine if section 1 is complete
  const watchedValues = watch(['title', 'symbol', 'description', 'assetType']);
  const isSection1Complete = watchedValues.every(
    (value) => value && value.toString().trim() !== '',
  );

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const newPreviews = Array.from(files).map((file) => ({
        preview: URL.createObjectURL(file),
        file,
      }));
      setImagePreviews([...imagePreviews, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) => {
      const newPreviews = [...prev];
      URL.revokeObjectURL(newPreviews[index].preview);
      newPreviews.splice(index, 1);
      return newPreviews;
    });
  };

  const onSubmit = handleSubmit(async (formData) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitMessage('');
    setUploadProgress(0);

    try {
      // Upload all images first
      const uploadedUrls: string[] = [];
      for (let i = 0; i < imagePreviews.length; i++) {
        const { file } = imagePreviews[i];
        const publicUrl = await SubmissionsApi.uploadImage(file);
        uploadedUrls.push(publicUrl);
        setUploadProgress(((i + 1) / imagePreviews.length) * 100);
      }

      const submissionData = {
        ...formData,
        imageGallery: uploadedUrls,
        location: formData.location || undefined,
        contractAddress: formData.contractAddress || undefined,
      };

      const response = await SubmissionsApi.createTestSubmission(submissionData);

      if (response.success) {
        setSubmitStatus('success');
        setSubmitMessage(
          'Token submission created successfully! It will be reviewed for approval.',
        );
        reset();
        // Clean up previews
        imagePreviews.forEach(({ preview }) => URL.revokeObjectURL(preview));
        setImagePreviews([]);
        setCurrentStep(1);
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
      setUploadProgress(0);
    }
  });

  // Check if user is a verified seller
  const canCreateToken = authUser?.sellerStatus === 'APPROVED';
  const isPendingVerification = authUser?.sellerStatus === 'PENDING';
  const isRejected = authUser?.sellerStatus === 'REJECTED';

  return (
    <div className="h-screen max-h-[1200px] bg-gradient-to-b from-black via-[#0A0A0A] to-[#231F20] relative overflow-hidden">
      {/* Header Component */}
      <div className="relative z-50">
        <AcesHeader />
      </div>

      {/* Background Elements */}
      <AnimatedDotsBackground
        opacity={0.15}
        dotSpacing={45}
        dotSize={1.5}
        animationSpeed={0.4}
        waveType="radial"
        minOpacity={0.05}
        className="absolute inset-0 z-0"
      />

      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            'radial-gradient(circle at 30% 20%, rgba(208, 178, 132, 0.05) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(215, 191, 117, 0.05) 0%, transparent 50%)',
        }}
      />

      {/* Main Content */}
      <div className="relative z-20 h-full flex flex-col overflow-hidden">
        <LuxuryAssetsBackground opacity={0.6} className="absolute inset-0 z-0" />

        <div className="relative z-10 flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-6 py-12">
            {/* Authentication Warning */}
            {ready && !user && (
              <div className="mb-8">
                <div className="p-6 rounded-2xl flex items-center gap-4 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 border border-yellow-500/50 text-yellow-300 shadow-xl backdrop-blur-sm">
                  <AlertCircle className="w-6 h-6 flex-shrink-0" />
                  <p className="text-lg font-medium">
                    Please log in to submit your token for approval.
                  </p>
                </div>
              </div>
            )}

            {/* Status Message */}
            {submitStatus !== 'idle' && (
              <div className="mb-8">
                <div
                  className={`p-6 rounded-2xl flex items-center gap-4 shadow-xl backdrop-blur-sm ${
                    submitStatus === 'success'
                      ? 'bg-gradient-to-r from-green-900/30 to-emerald-900/30 border border-green-500/50 text-green-300'
                      : 'bg-gradient-to-r from-red-900/30 to-rose-900/30 border border-red-500/50 text-red-300'
                  }`}
                >
                  {submitStatus === 'success' ? (
                    <CheckCircle className="w-6 h-6 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="w-6 h-6 flex-shrink-0" />
                  )}
                  <p className="text-lg font-medium">{submitMessage}</p>
                </div>
              </div>
            )}

            {/* Page Header */}
            <div className="text-center mb-12">
              <h1
                className="text-6xl font-bold bg-gradient-to-r from-[#D0B284] via-[#D7BF75] to-[#E8D099] bg-clip-text text-transparent mb-6"
                style={{
                  textShadow: '0 0 40px rgba(208, 178, 132, 0.3)',
                }}
              >
                Submit Your RWA
              </h1>
              <p className="text-xl text-[#DCDDCC]/80 leading-relaxed max-w-3xl mx-auto">
                Transform your high-value Real-World Asset into a digital token. Join our exclusive
                launch by submitting your luxury asset for tokenization.
              </p>
            </div>

            {/* Progress Steps */}
            <ProgressSteps currentStep={currentStep} />

            {/* Verification Status Banner */}
            {!canCreateToken && (
              <div className="mb-8">
                <FormSection
                  icon={Shield}
                  title="Seller Verification Required"
                  description="Complete verification to start tokenizing your assets"
                  className="border-[#D0B284]/40"
                >
                  {isPendingVerification ? (
                    <div className="flex items-center justify-between p-4 bg-yellow-900/20 rounded-xl border border-yellow-500/30">
                      <div className="flex items-center gap-3">
                        <div className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-yellow-400"></span>
                        </div>
                        <div>
                          <p className="text-yellow-300 font-medium">Application Under Review</p>
                          <p className="text-yellow-300/70 text-sm">
                            You&apos;ll be notified once approved
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : isRejected ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-red-900/20 rounded-xl border border-red-500/30">
                        <p className="text-red-300 font-medium mb-2">
                          Previous application was not approved
                        </p>
                        {authUser?.rejectionReason && (
                          <p className="text-red-300/70 text-sm">
                            Reason: {authUser.rejectionReason}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        className="border-[#D0B284] text-[#D0B284] hover:bg-[#D0B284]/10"
                        onClick={() => setShowVerificationModal(true)}
                      >
                        Apply Again
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 bg-[#D0B284]/10 rounded-xl border border-[#D0B284]/30">
                        <p className="text-[#DCDDCC] mb-2">
                          Complete seller verification to create and list tokens on our platform.
                        </p>
                        <p className="text-[#DCDDCC]/70 text-sm">
                          This ensures authenticity and security of all listings.
                        </p>
                      </div>
                      <Button
                        className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-semibold"
                        onClick={() => setShowVerificationModal(true)}
                      >
                        Start Verification Process
                      </Button>
                    </div>
                  )}
                </FormSection>
              </div>
            )}

            {/* Main Form */}
            <form onSubmit={onSubmit} className="space-y-8">
              <div
                className={`transition-all duration-300 ${!canCreateToken ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {/* Section 1: Asset Details */}
                <FormSection
                  icon={Info}
                  title="Asset Information"
                  description="Tell us about your luxury asset and create its digital identity"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <FormField
                      label="Token Symbol"
                      icon={Tag}
                      required
                      error={errors.symbol?.message}
                    >
                      <Input
                        {...register('symbol')}
                        placeholder="LAMBO"
                        className="bg-[#0F0F0F]/80 border-[#D0B284]/30 text-white placeholder:text-[#DCDDCC]/50 h-12 font-mono uppercase focus-visible:ring-[#D0B284] focus-visible:border-[#D0B284]"
                        onChange={(e) => {
                          e.target.value = e.target.value.toUpperCase();
                        }}
                      />
                    </FormField>

                    <FormField
                      label="Asset Type"
                      icon={Layers}
                      required
                      error={errors.assetType?.message}
                    >
                      <Controller
                        name="assetType"
                        control={control}
                        render={({ field }) => (
                          <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger className="bg-[#0F0F0F]/80 border-[#D0B284]/30 text-white h-12 focus-visible:ring-[#D0B284] focus-visible:border-[#D0B284]">
                              <SelectValue
                                placeholder="Select asset type"
                                className="text-[#DCDDCC]/50"
                              />
                            </SelectTrigger>
                            <SelectContent className="bg-[#1A1A1A] border-[#D0B284]/30 text-white">
                              <SelectItem value="VEHICLE" className="hover:bg-[#D0B284]/10">
                                Vehicle
                              </SelectItem>
                              <SelectItem value="JEWELRY" className="hover:bg-[#D0B284]/10">
                                Jewelry
                              </SelectItem>
                              <SelectItem value="COLLECTIBLE" className="hover:bg-[#D0B284]/10">
                                Collectible
                              </SelectItem>
                              <SelectItem value="ART" className="hover:bg-[#D0B284]/10">
                                Art
                              </SelectItem>
                              <SelectItem value="FASHION" className="hover:bg-[#D0B284]/10">
                                Fashion
                              </SelectItem>
                              <SelectItem value="ALCOHOL" className="hover:bg-[#D0B284]/10">
                                Alcohol
                              </SelectItem>
                              <SelectItem value="OTHER" className="hover:bg-[#D0B284]/10">
                                Other
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </FormField>
                  </div>

                  <FormField
                    label="Asset Title"
                    icon={FileText}
                    required
                    error={errors.title?.message}
                  >
                    <Input
                      {...register('title')}
                      placeholder="e.g., 2023 Lamborghini Huracán STO"
                      className="bg-[#0F0F0F]/80 border-[#D0B284]/30 text-white placeholder:text-[#DCDDCC]/50 h-12 focus-visible:ring-[#D0B284] focus-visible:border-[#D0B284]"
                    />
                  </FormField>

                  <FormField label="Asset Description" required error={errors.description?.message}>
                    <Textarea
                      {...register('description')}
                      placeholder="Provide detailed information about your luxury asset, including condition, specifications, unique features, and any relevant history..."
                      className="bg-[#0F0F0F]/80 border-[#D0B284]/30 text-white placeholder:text-[#DCDDCC]/50 min-h-[120px] focus-visible:ring-[#D0B284] focus-visible:border-[#D0B284] resize-none"
                    />
                  </FormField>

                  <FormField label="Location" icon={MapPin} error={errors.location?.message}>
                    <Input
                      {...register('location')}
                      placeholder="e.g., Los Angeles, CA"
                      className="bg-[#0F0F0F]/80 border-[#D0B284]/30 text-white placeholder:text-[#DCDDCC]/50 h-12 focus-visible:ring-[#D0B284] focus-visible:border-[#D0B284]"
                    />
                  </FormField>

                  {/* Continue to Section 2 Button */}
                  <div className="flex justify-end pt-4">
                    <Button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      disabled={!isSection1Complete}
                      className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-semibold px-8 py-3 disabled:opacity-50"
                    >
                      Continue to Verification
                      <ChevronRight className="w-5 h-5 ml-2" />
                    </Button>
                  </div>
                </FormSection>

                {/* Section 2: Proof of Ownership */}
                {currentStep >= 2 && (
                  <FormSection
                    icon={Shield}
                    title="Proof of Ownership & Verification"
                    description="Provide documentation and proof to verify your ownership of the asset"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <FormField
                        label="Type of Ownership"
                        required
                        error={errors.typeOfOwnership?.message}
                      >
                        <Input
                          {...register('typeOfOwnership')}
                          placeholder="Vehicle Title, Deed, Certificate, etc."
                          className="bg-[#0F0F0F]/80 border-[#D0B284]/30 text-white placeholder:text-[#DCDDCC]/50 h-12 focus-visible:ring-[#D0B284] focus-visible:border-[#D0B284]"
                        />
                      </FormField>

                      <FormField
                        label="Proof Identifier"
                        required
                        error={errors.proofOfOwnership?.message}
                      >
                        <Input
                          {...register('proofOfOwnership')}
                          placeholder="VIN#, Serial#, Certificate# etc."
                          className="bg-[#0F0F0F]/80 border-[#D0B284]/30 text-white placeholder:text-[#DCDDCC]/50 h-12 focus-visible:ring-[#D0B284] focus-visible:border-[#D0B284]"
                        />
                      </FormField>
                    </div>

                    <FormField
                      label="Contract Address (Optional)"
                      icon={Wallet}
                      error={errors.contractAddress?.message}
                    >
                      <Input
                        {...register('contractAddress')}
                        placeholder="0x... (if asset is already tokenized)"
                        className="bg-[#0F0F0F]/80 border-[#D0B284]/30 text-white placeholder:text-[#DCDDCC]/50 h-12 font-mono focus-visible:ring-[#D0B284] focus-visible:border-[#D0B284]"
                      />
                    </FormField>

                    {/* Image Upload */}
                    <FormField
                      label="Asset Images"
                      icon={Camera}
                      error={errors.imageGallery?.message}
                    >
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        />
                        <div className="border-2 border-dashed border-[#D0B284]/40 rounded-xl p-8 text-center hover:border-[#D0B284]/60 transition-all duration-300 bg-[#0F0F0F]/50">
                          {imagePreviews.length > 0 ? (
                            <div className="space-y-6">
                              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {imagePreviews.map((preview, index) => (
                                  <div key={index} className="relative group">
                                    <Image
                                      src={preview.preview}
                                      alt={`Preview ${index + 1}`}
                                      width={200}
                                      height={200}
                                      className="w-full h-32 object-cover rounded-lg border border-[#D0B284]/20"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeImage(index)}
                                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                                    >
                                      <svg
                                        className="h-4 w-4"
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                ))}
                              </div>
                              <div className="border-t border-[#D0B284]/20 pt-4">
                                <p className="text-[#DCDDCC]/70 text-sm">
                                  Click anywhere to add more images
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <div className="w-16 h-16 bg-gradient-to-r from-[#D0B284]/20 to-[#D7BF75]/20 rounded-xl flex items-center justify-center mx-auto">
                                <Upload className="w-8 h-8 text-[#D0B284]" />
                              </div>
                              <div>
                                <p className="text-white font-medium text-lg mb-2">
                                  Upload Asset Images (Optional)
                                </p>
                                <p className="text-[#DCDDCC]/70 text-sm">
                                  PNG, JPG up to 10MB each • Multiple images supported
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </FormField>

                    {/* Upload Progress */}
                    {uploadProgress > 0 && uploadProgress < 100 && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-[#DCDDCC]/70">Uploading images...</span>
                          <span className="text-[#D0B284]">{Math.round(uploadProgress)}%</span>
                        </div>
                        <div className="w-full bg-[#231F20] rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Back and Submit Buttons */}
                    <div className="flex justify-between items-center pt-8">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentStep(1)}
                        className="border-[#D0B284]/50 text-[#D0B284] hover:bg-[#D0B284]/10"
                      >
                        Back to Asset Details
                      </Button>

                      <Button
                        type="submit"
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-4 px-12 text-lg rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl hover:shadow-[#D0B284]/30 transform hover:scale-105"
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
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
                  </FormSection>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-50 flex-shrink-0">
          <Footer />
        </div>
      </div>

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

      {/* Debug Component - Remove after testing */}
      <PrivyDebug />
    </div>
  );
}
