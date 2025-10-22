'use client';

import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { useAuth } from '@/lib/auth/auth-context';
import { VerificationApi } from '@/lib/api/verification';
import { CameraCapture } from '@/components/camera/camera-capture';
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
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import {
  Upload,
  CheckCircle,
  AlertCircle,
  FileText,
  User,
  Calendar as CalendarIcon,
  Shield,
  Info,
  ChevronRight,
  MapPin,
  Mail,
  Camera,
} from 'lucide-react';
import { VerificationAccordionSection } from '@/components/ui/verification-accordion-section';
import { VerificationSubmissionModal } from '@/components/ui/verification-submission-modal';
import { CountrySelect } from '@/components/ui/country-select';

// Form data interface matching Prisma AccountVerification model
interface VerificationFormData {
  documentType: 'DRIVERS_LICENSE' | 'PASSPORT' | 'ID_CARD';
  documentNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date;
  countryOfIssue: string;
  state?: string;
  address: string;
  emailAddress: string;
  documentImage?: any; // File will be handled separately
}

// Reuse the Section and Field components from list-token-form
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

interface VerificationFormProps {
  disabled?: boolean;
}

export function VerificationForm({ disabled = false }: VerificationFormProps) {
  const { getAccessToken, user, refreshUserProfile } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [documentImagePreview, setDocumentImagePreview] = useState<{
    preview: string;
    file: File;
  } | null>(null);
  const [selfieImagePreview, setSelfieImagePreview] = useState<{
    preview: string;
    file: File;
  } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>(
    'idle',
  );
  const [submitMessage, setSubmitMessage] = useState<string>('');
  const [submitErrorDetails, setSubmitErrorDetails] = useState<string[]>([]);
  const [isSubmissionModalOpen, setIsSubmissionModalOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Refs for each section to enable smooth scrolling
  const section1Ref = React.useRef<HTMLDivElement>(null);
  const section2Ref = React.useRef<HTMLDivElement>(null);
  const section3Ref = React.useRef<HTMLDivElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    control,
    setValue,
  } = useForm<VerificationFormData>({
    mode: 'onChange',
  });

  // Check if user already has verification status
  React.useEffect(() => {
    if (user?.sellerStatus === 'PENDING') {
      setSubmitStatus('success');
      setSubmitMessage('Your verification is currently under review. Please wait for approval.');
    } else if (user?.sellerStatus === 'APPROVED') {
      setSubmitStatus('success');
      setSubmitMessage('Your identity has been successfully verified!');
    } else if (user?.sellerStatus === 'REJECTED') {
      setSubmitStatus('error');
      setSubmitMessage(
        'Your previous verification was rejected. Please resubmit with correct information.',
      );
    }
  }, [user]);

  // Smooth scroll to section when currentStep changes
  React.useEffect(() => {
    const sectionRefs = [section1Ref, section2Ref, section3Ref];
    const targetRef = sectionRefs[currentStep - 1];

    if (targetRef?.current) {
      targetRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }
  }, [currentStep]);

  const watchedValues = watch(['firstName', 'lastName', 'emailAddress', 'dateOfBirth', 'address']);
  const isSection1Complete = watchedValues.every(
    (value: any) =>
      value &&
      (typeof value === 'string' ? value.trim() !== '' : value !== null && value !== undefined),
  );

  // Check if section 2 (document) is complete
  const isSection2Complete = isSection1Complete && documentImagePreview !== null;

  // Check if all sections are complete for final submission
  const isAllSectionsComplete = isSection2Complete && selfieImagePreview !== null;

  const handleDocumentImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (documentImagePreview) {
        URL.revokeObjectURL(documentImagePreview.preview);
      }
      setDocumentImagePreview({
        preview: URL.createObjectURL(file),
        file,
      });
    }
  };

  const removeDocumentImage = () => {
    if (documentImagePreview) {
      URL.revokeObjectURL(documentImagePreview.preview);
      setDocumentImagePreview(null);
    }
  };

  const handleSelfieCapture = (imageBlob: Blob) => {
    console.log('📸 Selfie captured, processing...', { size: imageBlob.size });

    // Convert Blob to File if it's not already a File
    const imageFile =
      imageBlob instanceof File
        ? imageBlob
        : new File([imageBlob], 'selfie.jpg', { type: 'image/jpeg' });

    // Clean up previous preview
    if (selfieImagePreview) {
      URL.revokeObjectURL(selfieImagePreview.preview);
    }

    // Set new image preview
    const preview = URL.createObjectURL(imageFile);
    setSelfieImagePreview({
      preview,
      file: imageFile,
    });

    console.log('✅ Selfie preview set:', { filename: imageFile.name, size: imageFile.size });

    // Close camera with slight delay to ensure state update
    setTimeout(() => {
      setShowCamera(false);
      console.log('📷 Camera closed, selfie ready for submission');
    }, 150);
  };

  const handleCameraCancel = () => {
    setShowCamera(false);
  };

  const removeSelfieImage = () => {
    if (selfieImagePreview) {
      URL.revokeObjectURL(selfieImagePreview.preview);
      setSelfieImagePreview(null);
    }
  };

  const onSubmit = handleSubmit(async (formData) => {
    // Early exit if form is not ready for submission
    if (isSubmitting || !isAllSectionsComplete) {
      console.log('Form submission blocked - not ready:', { isSubmitting, isAllSectionsComplete });
      return;
    }

    console.log('🚀 Starting verification submission...');
    setIsSubmitting(true);
    setSubmitStatus('submitting');
    setSubmitMessage('Processing your verification documents and selfie...');
    setSubmitErrorDetails([]);
    setIsSubmissionModalOpen(true);

    try {
      console.log('🔑 Getting authentication token...');
      const authToken = await getAccessToken();
      if (!authToken) throw new Error('Authentication required. Please connect your wallet.');
      console.log('✅ Authentication token obtained');

      // Small delay to ensure state updates are complete
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Re-check completion status after delay
      const hasDocumentImage = documentImagePreview !== null;
      const hasSelfieImage = selfieImagePreview !== null;
      const isFormComplete = isSection1Complete && hasDocumentImage && hasSelfieImage;

      console.log('🔍 Form validation check:', {
        isSection1Complete,
        hasDocumentImage,
        hasSelfieImage,
        isFormComplete,
        documentImagePreview: !!documentImagePreview,
        selfieImagePreview: !!selfieImagePreview,
      });

      // Validate required images with more descriptive error messages
      if (!hasDocumentImage) {
        console.log('❌ Validation failed: Missing document image');
        throw new Error('Please upload a photo of your identification document before submitting.');
      }
      if (!hasSelfieImage) {
        console.log('❌ Validation failed: Missing selfie image');
        throw new Error('Please take a selfie photo before submitting your verification.');
      }
      if (!isFormComplete) {
        console.log('❌ Validation failed: Form incomplete');
        throw new Error('Please complete all required sections before submitting.');
      }

      console.log('✅ All validation checks passed, proceeding with submission');

      // Prepare verification data to match backend VerificationSubmissionData interface
      const verificationData = {
        documentType: formData.documentType as 'DRIVERS_LICENSE' | 'PASSPORT' | 'ID_CARD',
        documentNumber: formData.documentNumber,
        firstName: formData.firstName,
        lastName: formData.lastName,
        dateOfBirth: formData.dateOfBirth.toISOString(),
        countryOfIssue: formData.countryOfIssue,
        state: formData.state || undefined,
        address: formData.address,
        emailAddress: formData.emailAddress,
        documentImage: documentImagePreview.file,
      };

      console.log('📄 Step 1: Submitting document verification...');
      // Step 1: Submit document verification
      const documentResponse = await VerificationApi.submitVerification(
        verificationData,
        authToken,
      );
      console.log('📄 Document verification response:', documentResponse);

      if (!documentResponse.success) {
        console.error('❌ Document verification failed:', documentResponse.error);
        setSubmitStatus('error');
        const errorMessage = documentResponse.error || 'Failed to submit document verification';
        setSubmitMessage(errorMessage);
        // Check if response has details (API might return details in error object)
        if ('details' in documentResponse && documentResponse.details) {
          setSubmitErrorDetails(
            (documentResponse as any).details.map((d: any) => d.message || d.toString()),
          );
        }
        return;
      }

      console.log('✅ Document verification successful');
      setSubmitMessage('Document verification successful. Processing facial verification...');

      console.log('📸 Step 2: Submitting facial verification (selfie)...');
      // Step 2: Submit facial verification (selfie)
      const facialResponse = await VerificationApi.submitFacialVerification(
        selfieImagePreview.file,
        authToken,
      );
      console.log('📸 Facial verification response:', facialResponse);

      if (facialResponse.success) {
        console.log('✅ Facial verification successful!');
        const wasAutoApproved = facialResponse.data.autoApproved;
        console.log('📊 Auto-approved:', wasAutoApproved);

        setSubmitStatus('success');
        setSubmitMessage(
          wasAutoApproved
            ? 'Verification approved! Your identity has been verified and you can now submit luxury assets for tokenization.'
            : 'Verification submitted successfully! Your application requires manual review, but you can still submit assets while we process your verification.',
        );

        console.log('🔄 Refreshing user profile...');
        // Refresh user profile to get updated status
        await refreshUserProfile();
        console.log('✅ User profile refreshed');

        // Keep modal open with navigation buttons
        // Don't clear form or close modal yet - user will navigate away via buttons
      } else {
        console.error('❌ Facial verification failed:', facialResponse.error);
        setSubmitStatus('error');
        const errorMessage = facialResponse.error || 'Failed to submit facial verification';
        setSubmitMessage(errorMessage);
        // Check if response has details (API might return details in error object)
        if ('details' in facialResponse && facialResponse.details) {
          setSubmitErrorDetails(
            (facialResponse as any).details.map((d: any) => d.message || d.toString()),
          );
        }
      }
    } catch (e) {
      console.error('💥 Exception during submission:', e);
      setSubmitStatus('error');
      setSubmitMessage(
        e instanceof Error ? e.message : 'Network error occurred. Please try again.',
      );
      setSubmitErrorDetails([
        e instanceof Error ? e.message : 'Network error occurred. Please try again.',
      ]);
      console.error('Full error details:', e);
    } finally {
      console.log('🏁 Submission process completed, isSubmitting set to false');
      setIsSubmitting(false);
    }
  });

  // If user is already verified, show success state
  if (user?.sellerStatus === 'APPROVED') {
    return (
      <div className="relative pointer-events-auto">
        <div className="relative bg-[#151c16]/80 border border-dashed border-[#E6E3D3]/20 rounded-2xl p-8 shadow-[0_10px_40px_rgba(215,191,117,0.06)]">
          <div className="text-center py-12">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-3xl font-bold text-[#D0B284] mb-4">Verification Complete!</h2>
            <p className="text-[#E6E3D3]/80 text-lg mb-6">
              Your identity has been successfully verified. You can now submit luxury assets for
              tokenization.
            </p>
            <Button
              onClick={() => (window.location.href = '/launch')}
              className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black font-medium px-8 py-3"
            >
              Submit Your First Asset
            </Button>
          </div>
        </div>
      </div>
    );
  }

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

        <form onSubmit={onSubmit} className="space-y-6">
          {/* Section 1: Personal Information */}
          <div ref={section1Ref} className="scroll-mt-8">
            <VerificationAccordionSection
              icon={User}
              title="Personal Information"
              description="Provide your basic personal details as they appear on your identification document"
              isCompleted={isSection1Complete}
              isActive={currentStep === 1}
              stepNumber={1}
            >
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Field label="First Name" icon={User} required error={errors.firstName?.message}>
                  <Input
                    {...register('firstName')}
                    placeholder="John"
                    disabled={disabled}
                    className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </Field>

                <Field label="Last Name" icon={User} required error={errors.lastName?.message}>
                  <Input
                    {...register('lastName')}
                    placeholder="Doe"
                    disabled={disabled}
                    className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Field
                  label="Email Address"
                  icon={Mail}
                  required
                  error={errors.emailAddress?.message}
                >
                  <Input
                    {...register('emailAddress')}
                    type="email"
                    placeholder="john.doe@example.com"
                    disabled={disabled}
                    className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </Field>

                <Field
                  label="Date of Birth"
                  icon={CalendarIcon}
                  required
                  error={errors.dateOfBirth?.message}
                >
                  <Controller
                    name="dateOfBirth"
                    control={control}
                    render={({ field }) => {
                      const [open, setOpen] = useState(false);
                      return (
                        <Popover
                          open={disabled ? false : open}
                          onOpenChange={disabled ? undefined : setOpen}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              disabled={disabled}
                              className="w-full justify-between font-normal bg-[#0f1511] border border-[#E6E3D3]/20 text-[#D7BF75] h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {field.value ? format(field.value, 'PPP') : 'Select date of birth'}
                              <CalendarIcon className="h-4 w-4 text-[#D7BF75]" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-auto overflow-hidden p-0 bg-[#151c16] border border-[#E6E3D3]/20"
                            align="start"
                            side="bottom"
                            sideOffset={4}
                            avoidCollisions={false}
                          >
                            <Calendar
                              mode="single"
                              selected={field.value}
                              captionLayout="dropdown"
                              fromYear={1900}
                              toYear={new Date().getFullYear()}
                              disabled={(date) =>
                                date > new Date() || date < new Date('1900-01-01')
                              }
                              onSelect={(date) => {
                                field.onChange(date);
                                setOpen(false);
                              }}
                              showOutsideDays={false}
                              fixedWeeks={false}
                              className="bg-[#151c16] text-[#D7BF75] p-3"
                              classNames={{
                                caption_label: 'hidden',
                                nav: 'hidden',
                                nav_button: 'hidden',
                                nav_button_previous: 'hidden',
                                nav_button_next: 'hidden',
                                dropdowns: 'flex justify-center gap-2',
                                dropdown:
                                  'bg-[#0f1511] border border-[#E6E3D3]/20 text-[#D7BF75] text-sm rounded-md px-3 py-2 outline-none focus:ring-1 focus:ring-[#C9AE6A]',
                                weekday:
                                  'text-[#D7BF75]/60 font-normal text-xs w-9 h-9 flex items-center justify-center',
                                day_button:
                                  'text-[#E6E3D3] hover:bg-[#C9AE6A]/10 hover:text-[#D7BF75]',
                                day_selected:
                                  'bg-[#C9AE6A] text-black hover:bg-[#C9AE6A] hover:text-black focus:bg-[#C9AE6A] focus:text-black',
                                day_today: 'bg-[#D7BF75]/20 text-[#D7BF75]',
                                day_outside: 'text-[#E6E3D3]/30 opacity-50',
                                day_disabled: 'text-[#E6E3D3]/30 opacity-50',
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      );
                    }}
                  />
                </Field>
              </div>

              <Field label="Address" icon={MapPin} required error={errors.address?.message}>
                <Textarea
                  {...register('address')}
                  placeholder="123 Main Street, City, State/Province, Postal Code"
                  disabled={disabled}
                  className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 min-h-[80px] focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </Field>

              <div className="flex justify-end pt-4">
                <Button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  disabled={disabled || !isSection1Complete}
                  className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-semibold px-8 py-3 disabled:opacity-50"
                >
                  Continue to Document
                  <ChevronRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </VerificationAccordionSection>
          </div>

          {/* Section 2: Document Information */}
          {currentStep >= 2 && (
            <div ref={section2Ref} className="scroll-mt-8">
              <VerificationAccordionSection
                icon={FileText}
                title="Identity Document"
                description="Upload a clear photo of your government-issued identification document"
                isCompleted={isSection2Complete}
                isActive={currentStep === 2}
                stepNumber={2}
              >
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Field
                    label="Document Type"
                    icon={FileText}
                    required
                    error={errors.documentType?.message}
                  >
                    <Controller
                      name="documentType"
                      control={control}
                      render={({ field }) => (
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={disabled}
                        >
                          <SelectTrigger className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] disabled:opacity-50 disabled:cursor-not-allowed">
                            <SelectValue placeholder="Select document type" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#151c16] border border-[#E6E3D3]/20 text-[#E6E3D3]">
                            <SelectItem value="DRIVERS_LICENSE" className="hover:bg-[#C9AE6A]/10">
                              Driver's License
                            </SelectItem>
                            <SelectItem value="PASSPORT" className="hover:bg-[#C9AE6A]/10">
                              Passport
                            </SelectItem>
                            <SelectItem value="ID_CARD" className="hover:bg-[#C9AE6A]/10">
                              National ID Card
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </Field>

                  <Field
                    label="Document Number"
                    icon={FileText}
                    required
                    error={errors.documentNumber?.message}
                  >
                    <Input
                      {...register('documentNumber')}
                      placeholder="123456789"
                      disabled={disabled}
                      className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Field
                    label="Country of Issue"
                    icon={MapPin}
                    required
                    error={errors.countryOfIssue?.message}
                  >
                    <Controller
                      name="countryOfIssue"
                      control={control}
                      render={({ field }) => (
                        <CountrySelect
                          value={field.value}
                          onValueChange={field.onChange}
                          disabled={disabled}
                          placeholder="Select country of issue"
                        />
                      )}
                    />
                  </Field>

                  <Field label="State/Province" icon={MapPin} error={errors.state?.message}>
                    <Input
                      {...register('state')}
                      placeholder="California (optional)"
                      disabled={disabled}
                      className="bg-[#0f1511] border border-[#E6E3D3]/20 text-[#E6E3D3] placeholder:text-[#E6E3D3]/45 h-12 focus-visible:ring-[#C9AE6A] focus-visible:border-[#C9AE6A] disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </Field>
                </div>

                {/* Document Image Upload */}
                <Field label="Document Photo" icon={Camera} required>
                  <div className="relative">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleDocumentImageUpload}
                      disabled={disabled}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
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
                      {documentImagePreview ? (
                        <div className="space-y-6">
                          <div className="flex justify-center">
                            <div className="relative group">
                              <Image
                                src={documentImagePreview.preview}
                                alt="Document preview"
                                width={300}
                                height={300}
                                className="w-full max-w-md h-64 object-cover rounded-lg border border-[#E6E3D3]/20"
                              />
                              <button
                                type="button"
                                onClick={removeDocumentImage}
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
                          </div>
                          <div className="border-t border-[#D0B284]/20 pt-4">
                            <p className="text-[#DCDDCC]/70 text-sm">
                              Click to replace document image
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
                              Upload Document Photo
                            </p>
                            <p className="text-[#E6E3D3]/70 text-sm">
                              Take a clear photo of your ID. Ensure all text is readable and the
                              image is well-lit.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Field>

                <div className="flex justify-between items-center pt-8">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    disabled={disabled}
                    className="border border-dashed border-[#C9AE6A]/60 text-[#C9AE6A] hover:bg-[#C9AE6A]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Back to Personal Info
                  </Button>

                  <Button
                    type="button"
                    onClick={() => setCurrentStep(3)}
                    disabled={disabled || !isSection2Complete}
                    className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-semibold px-8 py-3 disabled:opacity-50"
                  >
                    Continue to Selfie
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </Button>
                </div>
              </VerificationAccordionSection>
            </div>
          )}

          {/* Section 3: Selfie Verification */}
          {currentStep >= 3 && (
            <div ref={section3Ref} className="scroll-mt-8">
              <VerificationAccordionSection
                icon={Camera}
                title="Identity Verification"
                description="Take a selfie to verify your identity matches your uploaded document. Please remove head and face wear such as masks, hats, or glasses, for the best results."
                isCompleted={isAllSectionsComplete}
                isActive={currentStep === 3}
                stepNumber={3}
              >
                {/* Camera Interface */}
                {showCamera ? (
                  <div className="space-y-6">
                    <div className="bg-[#D7BF75]/10 border border-[#D7BF75]/30 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Camera className="w-5 h-5 text-[#D7BF75]" />
                        <h4 className="text-sm font-semibold text-[#D7BF75]">Take Your Selfie</h4>
                      </div>
                      <p className="text-sm text-[#DCDDCC]/80 leading-relaxed">
                        Position your face clearly in the camera and ensure good lighting. This
                        photo will be compared with your ID document.
                      </p>
                    </div>

                    <div className="flex justify-center">
                      <div style={{ width: '400px', height: '300px' }}>
                        <CameraCapture
                          onCapture={handleSelfieCapture}
                          onCancel={handleCameraCancel}
                          isUploading={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Selfie Upload */}
                    <Field label="Selfie Photo" icon={Camera} required>
                      {selfieImagePreview ? (
                        <div className="space-y-4">
                          <div className="flex justify-center">
                            <div className="relative group">
                              <Image
                                src={selfieImagePreview.preview}
                                alt="Selfie preview"
                                width={300}
                                height={300}
                                className="w-full max-w-md h-64 object-cover rounded-lg border border-[#E6E3D3]/20"
                              />
                              <button
                                type="button"
                                onClick={removeSelfieImage}
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
                          </div>
                          <div className="flex justify-center">
                            <Button
                              type="button"
                              onClick={() => setShowCamera(true)}
                              variant="outline"
                              className="border border-dashed border-[#C9AE6A]/60 text-[#C9AE6A] hover:bg-[#C9AE6A]/10"
                            >
                              <Camera className="w-4 h-4 mr-2" />
                              Retake Selfie
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="relative">
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

                            <div className="space-y-4">
                              <div className="w-16 h-16 bg-[#0f1511] border border-dashed border-[#E6E3D3]/20 rounded-xl flex items-center justify-center mx-auto">
                                <Camera className="w-8 h-8 text-[#C9AE6A]" />
                              </div>
                              <div>
                                <p className="text-[#E6E3D3] font-medium text-lg mb-2">
                                  Take Your Selfie
                                </p>
                                <p className="text-[#E6E3D3]/70 text-sm mb-4">
                                  Use your device camera to take a clear selfie for identity
                                  verification
                                </p>
                                <Button
                                  type="button"
                                  onClick={() => setShowCamera(true)}
                                  disabled={disabled}
                                  className="bg-gradient-to-r from-[#D7BF75] to-[#C9AE6A] hover:from-[#C9AE6A] hover:to-[#D7BF75] text-black font-medium px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Camera className="w-4 h-4 mr-2" />
                                  Open Camera
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Field>

                    <div className="flex justify-between items-center pt-8">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCurrentStep(2)}
                        disabled={disabled}
                        className="border border-dashed border-[#C9AE6A]/60 text-[#C9AE6A] hover:bg-[#C9AE6A]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Back to Document
                      </Button>

                      <Button
                        type="submit"
                        disabled={disabled || isSubmitting || !isAllSectionsComplete}
                        className="bg-[#C9AE6A] hover:bg-[#d6bf86] text-black font-bold py-4 px-12 text-lg rounded-xl transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                        title={
                          disabled
                            ? 'Please connect your wallet to submit verification'
                            : !isAllSectionsComplete
                              ? !documentImagePreview
                                ? 'Please upload a document image first'
                                : !selfieImagePreview
                                  ? 'Please take a selfie photo first'
                                  : 'Complete all sections to submit'
                              : 'Submit your verification for review'
                        }
                      >
                        {isSubmitting ? (
                          <div className="flex items-center gap-3">
                            <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            Submitting...
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <Shield className="w-5 h-5" />
                            {isAllSectionsComplete
                              ? 'Submit for Verification'
                              : !selfieImagePreview
                                ? 'Take Selfie to Continue'
                                : 'Complete All Steps'}
                          </div>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </VerificationAccordionSection>
            </div>
          )}
        </form>

        {/* Submission Status Modal */}
        <VerificationSubmissionModal
          isOpen={isSubmissionModalOpen}
          onClose={() => setIsSubmissionModalOpen(false)}
          status={submitStatus}
          message={submitMessage}
          errorDetails={submitErrorDetails}
          onNavigateToLaunch={() => {
            setIsSubmissionModalOpen(false);
            window.location.href = '/launch';
          }}
          onNavigateHome={() => {
            setIsSubmissionModalOpen(false);
            window.location.href = '/';
          }}
        />
      </div>
    </div>
  );
}

// Default export for backward compatibility
export default VerificationForm;
