'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { usePrivy } from '@privy-io/react-auth';
import { useAuth } from '@/lib/auth/auth-context';
import { CreateSubmissionSchema } from '@aces/utils';
import { SubmissionsApi } from '@/lib/api/submissions';
import Image from 'next/image';
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
import {
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  MapPin,
  Tag,
  Camera,
  Shield,
  Info,
  ChevronRight,
  Layers,
} from 'lucide-react';

// Local form UI primitives tuned to Figma
function Section({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="p-3 bg-[#0f1511] border border-dashed border-[#E6E3D3]/15 rounded-xl">
          <Icon className="w-6 h-6 text-[#C9AE6A]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-[#D0B284] mb-1">{title}</h2>
          <p className="text-[#E6E3D3]/70 text-sm">{description}</p>
        </div>
      </div>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

function Field({
  label,
  icon: Icon,
  error,
  required,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-[#C9AE6A] font-medium text-sm uppercase tracking-wide">
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
}

function Steps({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center mb-10">
      <div className="flex items-center gap-4">
        {[1, 2].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 ${
                step <= current
                  ? 'bg-[#E6E3D3] text-black'
                  : 'bg-[#0f1511] border-2 border-dashed border-[#E6E3D3]/30 text-[#C9AE6A]'
              }`}
            >
              {step <= current ? <CheckCircle className="w-5 h-5" /> : step}
            </div>
            {step < 2 && <div className="mx-2 w-14 border-t border-dashed border-[#E6E3D3]/30" />}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ListTokenForm() {
  const { user, ready } = usePrivy();
  const { getAccessToken } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<Array<{ preview: string; file: File }>>([]);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [submitMessage, setSubmitMessage] = useState<string>('');
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
      setImagePreviews((prev) => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
  };

  const onSubmit = handleSubmit(async (formData) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');
    setSubmitMessage('');
    setUploadProgress(0);
    try {
      const authToken = await getAccessToken();
      if (!authToken) throw new Error('Authentication required. Please connect your wallet.');

      const uploadedUrls: string[] = [];
      for (let i = 0; i < imagePreviews.length; i++) {
        const { file } = imagePreviews[i];
        const publicUrl = await SubmissionsApi.uploadImage(file, authToken);
        uploadedUrls.push(publicUrl);
        setUploadProgress(((i + 1) / imagePreviews.length) * 100);
      }

      const submissionData = {
        ...formData,
        imageGallery: uploadedUrls,
        location: formData.location || undefined,
      };
      const response = await SubmissionsApi.createTestSubmission(submissionData, authToken);

      if (response.success) {
        setSubmitStatus('success');
        setSubmitMessage(
          'Token submission created successfully! It will be reviewed for approval.',
        );
        reset();
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
    } catch (e) {
      setSubmitStatus('error');
      setSubmitMessage('Network error occurred. Please try again.');
      console.error(e);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  });

  return (
    <div className="relative pointer-events-auto">
      {/* Outer form panel matching Figma */}
      <div className="relative bg-[#151c16]/80 border border-dashed border-[#E6E3D3]/20 rounded-2xl p-8 shadow-[0_10px_40px_rgba(215,191,117,0.06)]">
        {/* Corner ticks */}
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

        {/* <Steps current={currentStep} /> */}

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

        <form onSubmit={onSubmit} className="space-y-10">
          {/* Section 1 */}
          <Section
            icon={Info}
            title="Asset Information"
            description="Tell us about your luxury asset and create its digital identity"
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Field label="Token Symbol" icon={Tag} required error={errors.symbol?.message}>
                <Input
                  {...register('symbol')}
                  placeholder="LAMBO"
                  className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 font-mono uppercase focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A]"
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                  }}
                />
              </Field>

              <Field label="Asset Type" icon={Layers} required error={errors.assetType?.message}>
                <Controller
                  name="assetType"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A]">
                        <SelectValue
                          placeholder="Select asset type"
                          className="text-[#E6E3D3]/50"
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[#151c16] border border-[#E6E3D3]/20 text-[#E6E3D3]">
                        <SelectItem value="VEHICLE" className="hover:bg-[#C9AE6A]/10">
                          Vehicle
                        </SelectItem>
                        <SelectItem value="JEWELRY" className="hover:bg-[#C9AE6A]/10">
                          Jewelry
                        </SelectItem>
                        <SelectItem value="COLLECTIBLE" className="hover:bg-[#C9AE6A]/10">
                          Collectible
                        </SelectItem>
                        <SelectItem value="ART" className="hover:bg-[#C9AE6A]/10">
                          Art
                        </SelectItem>
                        <SelectItem value="FASHION" className="hover:bg-[#C9AE6A]/10">
                          Fashion
                        </SelectItem>
                        <SelectItem value="ALCOHOL" className="hover:bg-[#C9AE6A]/10">
                          Alcohol
                        </SelectItem>
                        <SelectItem value="OTHER" className="hover:bg-[#C9AE6A]/10">
                          Other
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </Field>
            </div>

            <Field label="Asset Title" icon={FileText} required error={errors.title?.message}>
              <Input
                {...register('title')}
                placeholder="e.g., 2023 Lamborghini Huracán STO"
                className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A]"
              />
            </Field>

            <Field label="Asset Description" required error={errors.description?.message}>
              <Textarea
                {...register('description')}
                placeholder="Provide detailed information about your luxury asset, including condition, specifications, unique features, and any relevant history..."
                className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 min-h-[120px] focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] resize-none"
              />
            </Field>

            <Field label="Location" icon={MapPin} error={errors.location?.message}>
              <Input
                {...register('location')}
                placeholder="e.g., Los Angeles, CA"
                className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A]"
              />
            </Field>

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
          </Section>

          {/* Section 2 */}
          {currentStep >= 2 && (
            <Section
              icon={Shield}
              title="Proof of Ownership & Verification"
              description="Provide documentation and proof to verify your ownership of the asset"
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Field label="Type of Ownership" required error={errors.typeOfOwnership?.message}>
                  <Input
                    {...register('typeOfOwnership')}
                    placeholder="Vehicle Title, Deed, Certificate, etc."
                    className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A]"
                  />
                </Field>

                <Field label="Proof Identifier" required error={errors.proofOfOwnership?.message}>
                  <Input
                    {...register('proofOfOwnership')}
                    placeholder="VIN#, Serial#, Certificate# etc."
                    className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A]"
                  />
                </Field>
              </div>

              {/* Image Upload */}
              <Field label="Asset Images" icon={Camera} error={errors.imageGallery?.message}>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="border-2 border-dashed border-[#E6E3D3]/25 rounded-xl p-8 text-center hover:border-[#C9AE6A]/50 transition-all duration-300 bg-[#0f1511]">
                    {/* Corner ticks */}
                    <span className="pointer-events-none absolute left-2 top-2 h-3 w-0.5 bg-[#C9AE6A]" />
                    <span className="pointer-events-none absolute left-2 top-2 w-3 h-0.5 bg-[#C9AE6A]" />
                    <span className="pointer-events-none absolute right-2 top-2 h-3 w-0.5 bg-[#C9AE6A]" />
                    <span className="pointer-events-none absolute right-2 top-2 w-3 h-0.5 bg-[#C9AE6A]" />
                    <span className="pointer-events-none absolute left-2 bottom-2 h-3 w-0.5 bg-[#C9AE6A]" />
                    <span className="pointer-events-none absolute left-2 bottom-2 w-3 h-0.5 bg-[#C9AE6A]" />
                    <span className="pointer-events-none absolute right-2 bottom-2 h-3 w-0.5 bg-[#C9AE6A]" />
                    <span className="pointer-events-none absolute right-2 bottom-2 w-3 h-0.5 bg-[#C9AE6A]" />
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
                                className="w-full h-32 object-cover rounded-lg border border-[#E6E3D3]/20"
                              />
                              <button
                                type="button"
                                onClick={() => removeImage(index)}
                                className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shadow-lg"
                              >
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
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
                        <div className="w-16 h-16 bg-[#0f1511] border border-dashed border-[#E6E3D3]/20 rounded-xl flex items-center justify-center mx-auto">
                          <Upload className="w-8 h-8 text-[#C9AE6A]" />
                        </div>
                        <div>
                          <p className="text-[#E6E3D3] font-medium text-lg mb-2">
                            Upload Asset Images (Optional)
                          </p>
                          <p className="text-[#E6E3D3]/70 text-sm">
                            PNG, JPG up to 10MB each • Multiple images supported
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Field>

              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#E6E3D3]/70">Uploading images...</span>
                    <span className="text-[#C9AE6A]">{Math.round(uploadProgress)}%</span>
                  </div>
                  <div className="w-full bg-[#0f1511] rounded-full h-2">
                    <div
                      className="bg-[#C9AE6A] h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center pt-8">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="border border-dashed border-[#C9AE6A]/60 text-[#C9AE6A] hover:bg-[#C9AE6A]/10"
                >
                  Back to Asset Details
                </Button>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[#C9AE6A] hover:bg-[#d6bf86] text-black font-bold py-4 px-12 text-lg rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Submitting...
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">Submit for Approval</div>
                  )}
                </Button>
              </div>
            </Section>
          )}
        </form>
      </div>
    </div>
  );
}
