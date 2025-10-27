'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '@/lib/auth/auth-context';
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
import { CountrySelect } from '@/components/ui/country-select';
import { AssetSubmissionModal } from '@/components/ui/asset-submission-modal';
import { VerificationAccordionSection } from '@/components/ui/verification-accordion-section';
import { useModal } from '@/lib/contexts/modal-context';

// Helper to get error message as string
const getErrorMessage = (error: any): string | undefined => {
  if (!error) return undefined;
  if (typeof error === 'string') return error;
  if (error.message) return String(error.message);
  return undefined;
};

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

export default function ListTokenForm() {
  const { getAccessToken, isVerifiedSeller, isAuthenticated, user, connectWallet } = useAuth();
  const { openTermsModal } = useModal();

  // Debug logging to see verification status
  console.log('📋 ListTokenForm - User status:', {
    isAuthenticated,
    isVerifiedSeller,
    sellerStatus: user?.sellerStatus,
    user,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<Array<{ preview: string; file: File }>>([]);
  const MAX_IMAGES = 6;
  const [imageLimitMessage, setImageLimitMessage] = useState('');
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const [ownershipDocs, setOwnershipDocs] = useState<{
    BILL_OF_SALE?: { preview: string; file: File };
    CERTIFICATE_OF_AUTH?: { preview: string; file: File };
    INSURANCE_DOC?: { preview: string; file: File };
    DEED_OR_TITLE?: { preview: string; file: File };
    APPRAISAL_DOC?: { preview: string; file: File };
    PROVENANCE_DOC?: { preview: string; file: File };
  }>({});
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  );
  const [submitMessage, setSubmitMessage] = useState<string>('');
  const [submitErrorDetails, setSubmitErrorDetails] = useState<string[]>([]);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);

  // Refs for each section to enable smooth scrolling
  const section1Ref = React.useRef<HTMLDivElement>(null);
  const section2Ref = React.useRef<HTMLDivElement>(null);
  const didMountRef = React.useRef(false);

  // Currency formatting helpers
  const formatCurrency = (value: string): string => {
    // Remove all non-digit characters
    const numbers = value.replace(/\D/g, '');
    if (!numbers) return '';
    // Add commas for thousands
    const formatted = parseInt(numbers).toLocaleString('en-US');
    return `$${formatted}`;
  };

  const parseCurrency = (value: string): string => {
    // Remove $ and commas, return just the number
    return value.replace(/[$,]/g, '');
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    control,
  } = useForm();

  // Watch individual fields for character counting
  const storyValue = watch('story') || '';
  const detailsValue = watch('details') || '';
  const provenanceValue = watch('provenance') || '';
  const hypeSentenceValue = watch('hypeSentence') || '';

  // Section completion states
  const watchedBasicValues = watch([
    'title',
    'symbol',
    'brand',
    'assetType',
    'value',
    'reservePrice',
  ]);
  const isSection1Complete =
    watchedBasicValues.every((value) => value && value.toString().trim() !== '') &&
    imagePreviews.length > 0;

  const isSection2Complete = [storyValue, detailsValue, provenanceValue, hypeSentenceValue].every(
    (v) => v && v.toString().trim() !== '',
  );

  const ownershipDocsCount = Object.keys(ownershipDocs).filter(
    (k) => ownershipDocs[k as keyof typeof ownershipDocs],
  ).length;
  const isSection3Complete = ownershipDocsCount >= 3 && hasAcceptedTerms;

  // Smooth scroll to section when currentStep changes
  React.useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return; // Skip initial auto-scroll on mount
    }
    const sectionRefs = [
      section1Ref,
      section2Ref,
      section2Ref /* placeholder for 3rd replaced below */,
    ];
  }, []);

  // Update refs array including section3Ref and scroll with offset so titles are visible
  const section3Ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!didMountRef.current) return;
    const sectionRefs = [section1Ref, section2Ref, section3Ref];
    const targetEl = sectionRefs[currentStep - 1]?.current;
    const container = document.querySelector('[data-scroll-container]') as HTMLElement | null;
    if (targetEl && container) {
      const containerTop = container.getBoundingClientRect().top + window.scrollY;
      const targetTop = targetEl.getBoundingClientRect().top + window.scrollY;
      const offset = currentStep === 3 ? 64 : 24; // extra space for section 3 header
      const scrollTo = targetTop - containerTop - offset + container.scrollTop;
      container.scrollTo({ top: Math.max(scrollTo, 0), behavior: 'smooth' });
    }
  }, [currentStep]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const remainingSlots = MAX_IMAGES - imagePreviews.length;
      if (remainingSlots <= 0) {
        setImageLimitMessage(`Maximum of ${MAX_IMAGES} images reached.`);
        event.currentTarget.value = '';
        return;
      }
      const toAdd = Array.from(files).slice(0, remainingSlots);
      const newPreviews = toAdd.map((file) => ({ preview: URL.createObjectURL(file), file }));
      setImagePreviews((prev) => [...prev, ...newPreviews]);
      if (files.length > remainingSlots) {
        setImageLimitMessage(
          `Only ${remainingSlots} more image${remainingSlots === 1 ? '' : 's'} allowed (max ${MAX_IMAGES}).`,
        );
      } else {
        setImageLimitMessage('');
      }
      event.currentTarget.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImagePreviews((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index].preview);
      next.splice(index, 1);
      return next;
    });
    setImageLimitMessage('');
  };

  const handleOwnershipDocUpload = (
    docType: keyof typeof ownershipDocs,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // Clean up previous preview if exists
      if (ownershipDocs[docType]) {
        URL.revokeObjectURL(ownershipDocs[docType]!.preview);
      }
      setOwnershipDocs((prev) => ({
        ...prev,
        [docType]: {
          preview: URL.createObjectURL(file),
          file,
        },
      }));
    }
  };

  const removeOwnershipDoc = (docType: keyof typeof ownershipDocs) => {
    if (ownershipDocs[docType]) {
      URL.revokeObjectURL(ownershipDocs[docType]!.preview);
      setOwnershipDocs((prev) => {
        const next = { ...prev };
        delete next[docType];
        return next;
      });
    }
  };

  const onSubmit = handleSubmit(
    async (formData) => {
      console.log('🚀 Form submitted! Data:', formData);
      console.log('📸 Image previews:', imagePreviews.length);
      console.log('📄 Ownership docs:', Object.keys(ownershipDocs).length);

      // Prevent submission if user hasn't submitted verification
      if (!isVerifiedSeller) {
        setSubmitStatus('error');
        setSubmitMessage(
          'Please submit identity verification before listing assets. You can submit assets immediately after submitting your verification.',
        );
        setSubmitErrorDetails([]);
        setIsSubmissionModalOpen(true);
        return;
      }

      // Prevent submission if terms not accepted
      if (!hasAcceptedTerms) {
        setSubmitStatus('error');
        setSubmitMessage('Please accept the ACES Launchpad Agreement to continue.');
        setSubmitErrorDetails([]);
        setIsSubmissionModalOpen(true);
        return;
      }

      setIsSubmitting(true);
      setSubmitStatus('submitting');
      setSubmitMessage('Uploading your asset and documentation...');
      setSubmitErrorDetails([]);
      setIsSubmissionModalOpen(true);
      setUploadProgress(0);

      try {
        const authToken = await getAccessToken();
        if (!authToken) throw new Error('Authentication required. Please connect your wallet.');

        // Validate required images
        if (imagePreviews.length === 0) {
          throw new Error('At least one asset image is required.');
        }

        // Validate ownership documentation - at least 3 required
        const uploadedDocs = Object.entries(ownershipDocs).filter(([_, doc]) => doc !== undefined);
        if (uploadedDocs.length < 3) {
          throw new Error('At least 3 ownership documents are required.');
        }

        const uploadedUrls: string[] = [];
        const totalImages = imagePreviews.length + uploadedDocs.length;
        let uploadedCount = 0;

        // Upload asset images to PUBLIC bucket (aces-product-images)
        console.log('📸 Uploading asset images to public bucket...');
        for (let i = 0; i < imagePreviews.length; i++) {
          const { file } = imagePreviews[i];
          const publicUrl = await SubmissionsApi.uploadImage(file, authToken, 'asset');
          uploadedUrls.push(publicUrl);
          uploadedCount++;
          setUploadProgress((uploadedCount / totalImages) * 100);
        }

        // Upload ownership documentation images to SECURE bucket (aces-secure-documents)
        console.log('🔒 Uploading ownership documents to secure bucket...');
        const ownershipDocumentation: Array<{
          type:
            | 'BILL_OF_SALE'
            | 'CERTIFICATE_OF_AUTH'
            | 'INSURANCE_DOC'
            | 'DEED_OR_TITLE'
            | 'APPRAISAL_DOC'
            | 'PROVENANCE_DOC';
          imageUrl: string;
          uploadedAt: string;
        }> = [];

        for (const [docType, docData] of uploadedDocs) {
          if (docData) {
            const docImageUrl = await SubmissionsApi.uploadImage(
              docData.file,
              authToken,
              'ownership',
            );
            ownershipDocumentation.push({
              type: docType as
                | 'BILL_OF_SALE'
                | 'CERTIFICATE_OF_AUTH'
                | 'INSURANCE_DOC'
                | 'DEED_OR_TITLE'
                | 'APPRAISAL_DOC'
                | 'PROVENANCE_DOC',
              imageUrl: docImageUrl,
              uploadedAt: new Date().toISOString(),
            });
            uploadedCount++;
            setUploadProgress((uploadedCount / totalImages) * 100);
          }
        }

        const submissionData: any = {
          ...formData,
          imageGallery: uploadedUrls,
          ownershipDocumentation,
          location: formData.location || undefined,
        };

        // Debug: Log the final submission data
        console.log('📦 Final submission data being sent:', {
          title: submissionData.title,
          symbol: submissionData.symbol,
          brand: submissionData.brand,
          assetType: submissionData.assetType,
          story: submissionData.story?.substring(0, 50) + '...',
          details: submissionData.details?.substring(0, 50) + '...',
          provenance: submissionData.provenance?.substring(0, 50) + '...',
          value: submissionData.value,
          reservePrice: submissionData.reservePrice,
          hypeSentence: submissionData.hypeSentence?.substring(0, 50) + '...',
          location: submissionData.location,
          imageGalleryCount: submissionData.imageGallery?.length,
          ownershipDocsCount: submissionData.ownershipDocumentation?.length,
        });

        const response = await SubmissionsApi.createTestSubmission(submissionData, authToken);

        if (response.success) {
          setSubmitStatus('success');
          setSubmitMessage(
            'Your asset has been submitted successfully! You will receive an email notification once it has been reviewed and approved.',
          );
          setSubmitErrorDetails([]);
          reset();
          imagePreviews.forEach(({ preview }) => URL.revokeObjectURL(preview));
          setImagePreviews([]);
          // Clean up ownership doc previews
          Object.values(ownershipDocs).forEach((doc) => {
            if (doc) URL.revokeObjectURL(doc.preview);
          });
          setOwnershipDocs({});
          setCurrentStep(1);
        } else {
          setSubmitStatus('error');
          const errorMessage =
            typeof response.error === 'string'
              ? response.error
              : response.error?.message || 'Failed to create token submission';
          setSubmitMessage(errorMessage);
          setSubmitErrorDetails(
            response.error && typeof response.error === 'object' && 'details' in response.error
              ? (response.error.details as string[])
              : [],
          );
        }
      } catch (e) {
        setSubmitStatus('error');
        const errorMessage =
          e instanceof Error ? e.message : 'Network error occurred. Please try again.';
        setSubmitMessage(errorMessage);
        // Attempt to extract backend validation details if present
        const anyError = e as any;
        const details = anyError && anyError.details ? anyError.details : undefined;
        if (Array.isArray(details)) {
          try {
            const parsed = details.map((d: any) => {
              const path = Array.isArray(d.path) ? d.path.join('.') : d.path;
              const message = d.message || String(d);
              return path ? `${path}: ${message}` : message;
            });
            setSubmitErrorDetails(parsed);
          } catch {
            setSubmitErrorDetails([]);
          }
        } else if (details && typeof details === 'object') {
          try {
            setSubmitErrorDetails([JSON.stringify(details)]);
          } catch {
            setSubmitErrorDetails([]);
          }
        } else {
          setSubmitErrorDetails([]);
        }
        console.error(e);
      } finally {
        setIsSubmitting(false);
        setUploadProgress(0);
      }
    },
    (errors) => {
      console.error('❌ Form validation errors:', errors);
    },
  );

  return (
    <div className="relative pointer-events-auto">
      {/* Outer form panel matching Figma */}
      <div
        className={`relative bg-[#151c16]/80 border border-dashed border-[#E6E3D3]/20 rounded-2xl p-8 shadow-[0_10px_40px_rgba(215,191,117,0.06)]`}
      >
        {/* Corner ticks */}
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute left-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 h-3 w-0.5 bg-[#C9AE6A]" />
        <span className="pointer-events-none absolute right-3 bottom-3 w-3 h-0.5 bg-[#C9AE6A]" />

        <form onSubmit={onSubmit} className="space-y-10">
          {/* Section 1 */}
          <div ref={section1Ref} className="scroll-mt-24">
            <VerificationAccordionSection
              icon={Info}
              title="Asset Information"
              description="Tell us about your luxury asset and create its digital identity"
              isCompleted={isSection1Complete}
              isActive={isVerifiedSeller && currentStep === 1}
              stepNumber={1}
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Field
                  label="Token Symbol"
                  icon={Tag}
                  required
                  error={getErrorMessage(errors.symbol)}
                >
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#E6E3D3] font-mono text-base pointer-events-none">
                      $
                    </span>
                    <Input
                      {...register('symbol')}
                      placeholder="LAMBO"
                      className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 font-mono uppercase focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] pl-8"
                      onChange={(e) => {
                        e.target.value = e.target.value.toUpperCase();
                      }}
                    />
                  </div>
                </Field>

                <Field
                  label="Asset Type"
                  icon={Layers}
                  required
                  error={getErrorMessage(errors.assetType)}
                >
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

                <Field label="Location" icon={MapPin} error={getErrorMessage(errors.location)}>
                  <Controller
                    name="location"
                    control={control}
                    render={({ field }) => (
                      <CountrySelect
                        value={field.value}
                        onValueChange={field.onChange}
                        placeholder="Select country"
                      />
                    )}
                  />
                </Field>
              </div>

              <Field
                label="Asset Title"
                icon={FileText}
                required
                error={getErrorMessage(errors.title)}
              >
                <Input
                  {...register('title')}
                  className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A]"
                />
              </Field>

              <Field label="Brand" icon={Tag} required error={getErrorMessage(errors.brand)}>
                <Input
                  {...register('brand')}
                  className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A]"
                />
              </Field>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Field label="Value" required error={getErrorMessage(errors.value)}>
                  <Controller
                    name="value"
                    control={control}
                    render={({ field }) => (
                      <Input
                        value={field.value ? formatCurrency(field.value) : ''}
                        onChange={(e) => {
                          const parsed = parseCurrency(e.target.value);
                          field.onChange(parsed);
                        }}
                        placeholder="$60,000"
                        className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A]"
                      />
                    )}
                  />
                </Field>

                <Field label="Reserve Price" required error={getErrorMessage(errors.reservePrice)}>
                  <Controller
                    name="reservePrice"
                    control={control}
                    render={({ field }) => (
                      <Input
                        value={field.value ? formatCurrency(field.value) : ''}
                        onChange={(e) => {
                          const parsed = parseCurrency(e.target.value);
                          field.onChange(parsed);
                        }}
                        placeholder="$50,000"
                        className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A]"
                      />
                    )}
                  />
                </Field>
              </div>

              {/* Asset Image Upload */}
              <Field label="Asset Images" icon={Camera} required>
                <div className="space-y-1">
                  <div className="relative">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                      disabled={imagePreviews.length >= MAX_IMAGES}
                      className={`absolute inset-0 w-full h-full opacity-0 z-10 ${
                        imagePreviews.length > 0 ? 'pointer-events-none' : 'cursor-pointer'
                      } disabled:cursor-not-allowed`}
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
                          <div className="relative -mx-1">
                            <div className="flex gap-4 overflow-x-auto px-1 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:bg-[#C9AE6A]/40">
                              {imagePreviews.map((preview, index) => (
                                <div key={index} className="relative">
                                  <Image
                                    src={preview.preview}
                                    alt={`Preview ${index + 1}`}
                                    width={128}
                                    height={96}
                                    className="w-32 h-24 object-cover rounded-lg border border-[#E6E3D3]/20"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => removeImage(index)}
                                    className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 transition-all duration-200 shadow-lg"
                                    aria-label="Remove image"
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
                          </div>
                          <div className="border-t border-[#D0B284]/20 pt-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <p className="text-[#DCDDCC]/70 text-sm">
                                {imagePreviews.length >= MAX_IMAGES
                                  ? 'Maximum images reached'
                                  : 'Add more images'}
                              </p>
                              {imagePreviews.length < MAX_IMAGES && (
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() => imageInputRef.current?.click()}
                                  className="border border-dashed border-[#C9AE6A]/60 text-[#C9AE6A] hover:bg-[#C9AE6A]/10 px-3 py-1 h-auto"
                                >
                                  Add images
                                </Button>
                              )}
                            </div>
                            <p className="text-[#E6E3D3]/70 text-sm">
                              {MAX_IMAGES - imagePreviews.length} images left
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
                              Upload Asset Images
                            </p>
                            <p className="text-[#E6E3D3]/70 text-sm">
                              PNG, JPG up to 10MB each • Up to {MAX_IMAGES} images
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {imageLimitMessage ? (
                      <p className="text-red-400 text-xs">{imageLimitMessage}</p>
                    ) : (
                      <span />
                    )}
                    <p className="text-[#E6E3D3]/60 text-xs text-right">
                      {MAX_IMAGES - imagePreviews.length} images left
                    </p>
                  </div>
                </div>
              </Field>

              <div className="flex justify-end pt-4">
                <Button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={!isSection1Complete}
                  className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-semibold px-8 py-3 disabled:opacity-50"
                >
                  Continue to Details
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </VerificationAccordionSection>
          </div>

          {/* Section 2: Asset Story & Details */}
          {currentStep >= 2 && (
            <div ref={section2Ref} className="scroll-mt-24">
              <VerificationAccordionSection
                icon={Info}
                title="Asset Story & Details"
                description="Add descriptive details to help buyers understand the asset’s background and appeal"
                isCompleted={isSection2Complete}
                isActive={isVerifiedSeller && currentStep === 2}
                stepNumber={2}
              >
                <Field label="Story" required error={getErrorMessage(errors.story)}>
                  <div className="space-y-1">
                    <Textarea
                      {...register('story')}
                      maxLength={700}
                      className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 min-h-[120px] focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] resize-none"
                    />
                    <p className="text-[#E6E3D3]/60 text-xs text-right">
                      {storyValue.length}/700 characters available
                    </p>
                  </div>
                </Field>

                <Field label="Details" required error={getErrorMessage(errors.details)}>
                  <div className="space-y-1">
                    <Textarea
                      {...register('details')}
                      maxLength={700}
                      className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 min-h-[120px] focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] resize-none"
                    />
                    <p className="text-[#E6E3D3]/60 text-xs text-right">
                      {detailsValue.length}/700 characters available
                    </p>
                  </div>
                </Field>

                <Field label="Provenance" required error={getErrorMessage(errors.provenance)}>
                  <div className="space-y-1">
                    <Textarea
                      {...register('provenance')}
                      maxLength={700}
                      className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 min-h-[120px] focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] resize-none"
                    />
                    <p className="text-[#E6E3D3]/60 text-xs text-right">
                      {provenanceValue.length}/700 characters available
                    </p>
                  </div>
                </Field>

                <Field label="Hype Sentence" required error={getErrorMessage(errors.hypeSentence)}>
                  <div className="space-y-1">
                    <Textarea
                      {...register('hypeSentence')}
                      maxLength={250}
                      className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 min-h-[80px] focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] resize-none"
                    />
                    <p className="text-[#E6E3D3]/60 text-xs text-right">
                      {hypeSentenceValue.length}/250 characters available
                    </p>
                  </div>
                </Field>

                <div className="flex justify-between items-center pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="border border-dashed border-[#C9AE6A]/60 text-[#C9AE6A] hover:bg-[#C9AE6A]/10"
                  >
                    Back to Asset Information
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    disabled={!isSection2Complete}
                    className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-semibold px-8 py-3 disabled:opacity-50"
                  >
                    Continue to Ownership Verification
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </VerificationAccordionSection>
            </div>
          )}

          {/* Section 3 */}
          {currentStep >= 3 && (
            <div ref={section3Ref} className="scroll-mt-32">
              <VerificationAccordionSection
                icon={Shield}
                title="Proof of Ownership & Verification"
                description="Upload at least 3 of the following ownership documents to verify your asset"
                isCompleted={isSection3Complete}
                isActive={isVerifiedSeller && currentStep === 3}
                stepNumber={3}
              >
                {/* Info box about minimum requirement */}
                <div className="bg-[#D7BF75]/10 border border-[#D7BF75]/30 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="w-5 h-5 text-[#D7BF75]" />
                    <h4 className="text-sm font-semibold text-[#D7BF75]">
                      Documentation Requirements
                    </h4>
                  </div>
                  <p className="text-sm text-[#DCDDCC]/80 leading-relaxed">
                    Please upload at least 3 of the 6 documentation types below. The more
                    documentation you provide, the faster we can verify your ownership.
                  </p>
                  <p className="text-sm text-[#D7BF75] mt-2 font-medium">
                    Uploaded: {ownershipDocsCount} / 6 (minimum 3 required)
                  </p>
                </div>

                {/* Document Upload Fields - 2x3 grid on large screens */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                  {(
                    [
                      { key: 'BILL_OF_SALE', label: 'Bill of Sale/Receipt' },
                      { key: 'CERTIFICATE_OF_AUTH', label: 'Certificate of Authentification' },
                      { key: 'INSURANCE_DOC', label: 'Insurance Documentation' },
                      { key: 'DEED_OR_TITLE', label: 'Documentation of Deed or Title' },
                      { key: 'APPRAISAL_DOC', label: 'Appraisal Documentation' },
                      { key: 'PROVENANCE_DOC', label: 'Provenance Documentation' },
                    ] as const
                  ).map(({ key, label }) => {
                    const doc = ownershipDocs[key];
                    const isPdf =
                      !!doc &&
                      ((doc.file && doc.file.type === 'application/pdf') ||
                        (doc.file &&
                          typeof (doc.file as any).name === 'string' &&
                          (doc.file as any).name.toLowerCase().endsWith('.pdf')));
                    return (
                      <div key={key} className="space-y-2">
                        <label className="flex items-center gap-2 text-[#C9AE6A] font-medium text-sm uppercase tracking-wide">
                          <FileText className="w-4 h-4" />
                          {label}
                        </label>
                        <div className="relative">
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => handleOwnershipDocUpload(key, e)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          />
                          <div
                            className={`border-2 border-dashed rounded-xl p-6 transition-all duration-300 ${
                              doc
                                ? 'border-[#C9AE6A]/70 bg-[#C9AE6A]/15 hover:border-[#C9AE6A]'
                                : 'border-[#E6E3D3]/25 bg-[#0f1511] hover:border-[#C9AE6A]/50'
                            }`}
                          >
                            {/* Corner ticks */}
                            <span
                              className={`pointer-events-none absolute left-2 top-2 h-3 w-0.5 ${doc ? 'bg-[#C9AE6A]' : 'bg-[#C9AE6A]/50'}`}
                            />
                            <span
                              className={`pointer-events-none absolute left-2 top-2 w-3 h-0.5 ${doc ? 'bg-[#C9AE6A]' : 'bg-[#C9AE6A]/50'}`}
                            />
                            <span
                              className={`pointer-events-none absolute right-2 top-2 h-3 w-0.5 ${doc ? 'bg-[#C9AE6A]' : 'bg-[#C9AE6A]/50'}`}
                            />
                            <span
                              className={`pointer-events-none absolute right-2 top-2 w-3 h-0.5 ${doc ? 'bg-[#C9AE6A]' : 'bg-[#C9AE6A]/50'}`}
                            />
                            <span
                              className={`pointer-events-none absolute left-2 bottom-2 h-3 w-0.5 ${doc ? 'bg-[#C9AE6A]' : 'bg-[#C9AE6A]/50'}`}
                            />
                            <span
                              className={`pointer-events-none absolute left-2 bottom-2 w-3 h-0.5 ${doc ? 'bg-[#C9AE6A]' : 'bg-[#C9AE6A]/50'}`}
                            />
                            <span
                              className={`pointer-events-none absolute right-2 bottom-2 h-3 w-0.5 ${doc ? 'bg-[#C9AE6A]' : 'bg-[#C9AE6A]/50'}`}
                            />
                            <span
                              className={`pointer-events-none absolute right-2 bottom-2 w-3 h-0.5 ${doc ? 'bg-[#C9AE6A]' : 'bg-[#C9AE6A]/50'}`}
                            />
                            {doc ? (
                              <div className="flex items-center gap-4">
                                <div className="relative group flex-shrink-0">
                                  {isPdf ? (
                                    <div className="w-32 h-24 flex items-center justify-center rounded-lg border border-[#E6E3D3]/20 bg-[#0f1511]">
                                      <div className="text-center">
                                        <FileText className="w-6 h-6 mx-auto text-[#C9AE6A]" />
                                        <span className="block text-xs text-[#E6E3D3]/80 mt-1">
                                          PDF
                                        </span>
                                      </div>
                                    </div>
                                  ) : (
                                    <Image
                                      src={doc.preview}
                                      alt={label}
                                      width={120}
                                      height={120}
                                      className="w-32 h-24 object-cover rounded-lg border border-[#E6E3D3]/20"
                                    />
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeOwnershipDoc(key)}
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
                                <div className="flex-1">
                                  <p className="text-[#E6E3D3] font-medium mb-1">
                                    ✓ Document Uploaded{isPdf ? ' (PDF)' : ''}
                                  </p>
                                  <p className="text-[#E6E3D3]/70 text-sm">
                                    Click to replace document
                                  </p>
                                  {isPdf && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        window.open(doc.preview, '_blank', 'noopener,noreferrer')
                                      }
                                      className="mt-2 text-[#D7BF75] hover:text-[#C9AE6A] text-xs underline"
                                    >
                                      Open PDF
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-[#0f1511] border border-dashed border-[#E6E3D3]/20 rounded-xl flex items-center justify-center flex-shrink-0">
                                  <Upload className="w-6 h-6 text-[#C9AE6A]" />
                                </div>
                                <div className="flex-1">
                                  <p className="text-[#E6E3D3] font-medium text-sm mb-1">
                                    Upload Document
                                  </p>
                                  <p className="text-[#E6E3D3]/70 text-xs">
                                    Click to upload {label.toLowerCase()} (image or PDF)
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

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

                {/* Terms and Conditions Acceptance */}
                <div className="bg-[#D7BF75]/10 border border-[#D7BF75]/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="terms-acceptance"
                      checked={hasAcceptedTerms}
                      onChange={(e) => setHasAcceptedTerms(e.target.checked)}
                      className="mt-1 w-4 h-4 rounded border-[#D7BF75]/50 bg-[#0f1511] text-[#D7BF75] focus:ring-[#D7BF75] focus:ring-offset-0 cursor-pointer"
                    />
                    <label
                      htmlFor="terms-acceptance"
                      className="text-sm text-[#DCDDCC]/90 leading-relaxed cursor-pointer"
                    >
                      I acknowledge that I have read, understood, and agree to be bound by the{' '}
                      <button
                        type="button"
                        onClick={() => openTermsModal('launchpad')}
                        className="text-[#D7BF75] hover:text-[#C9AE6A] underline font-medium transition-colors"
                      >
                        ACES Launchpad Agreement
                      </button>
                      .<span className="text-red-400 ml-1">*</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-8">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(2)}
                    className="border border-dashed border-[#C9AE6A]/60 text-[#C9AE6A] hover:bg-[#C9AE6A]/10"
                  >
                    Back to Details
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSubmitting || ownershipDocsCount < 3 || !hasAcceptedTerms}
                    className="bg-[#C9AE6A] hover:bg-[#d6bf86] text-black font-bold py-4 px-12 text-lg rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    title={
                      ownershipDocsCount < 3
                        ? 'Please upload at least 3 ownership documents'
                        : !hasAcceptedTerms
                          ? 'Please accept the Launchpad Agreement'
                          : 'Submit your asset for approval'
                    }
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
              </VerificationAccordionSection>
            </div>
          )}
        </form>
      </div>

      {/* Submission Status Modal */}
      <AssetSubmissionModal
        isOpen={isSubmissionModalOpen}
        onClose={() => setIsSubmissionModalOpen(false)}
        status={submitStatus}
        message={submitMessage}
        errorDetails={submitErrorDetails}
        onNavigateToProfile={() => {
          setIsSubmissionModalOpen(false);
          window.location.href = '/profile';
        }}
        onNavigateHome={() => {
          setIsSubmissionModalOpen(false);
          window.location.href = '/';
        }}
      />
    </div>
  );
}
