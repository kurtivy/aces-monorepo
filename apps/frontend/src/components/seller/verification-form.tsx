'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { VerificationApi } from '@/lib/api/verification';
import { CameraCapture } from '@/components/camera/camera-capture';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import type { FacialVerificationStatus, VerificationSubmissionData } from '@/lib/api/verification';
import {
  CalendarIcon,
  Upload,
  X,
  Loader2,
  Clock,
  CheckCircle,
  AlertCircle,
  FileText,
  Camera,
  ArrowLeft,
  ArrowRight,
  Shield,
  User,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import Image from 'next/image';

interface VerificationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

// Compact Stepper Component
const StepperComponent = ({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) => {
  const steps = [
    { number: 1, title: 'Basic Info', icon: User },
    { number: 2, title: 'Document Upload', icon: FileText },
    { number: 3, title: 'Identity Check', icon: Camera },
  ];

  return (
    <div className="flex items-center justify-center gap-8 mb-4">
      {steps.map((step, index) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;
        const IconComponent = step.icon;

        return (
          <div key={step.number} className="flex items-center gap-3">
            <div
              className={`
              w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300
              ${
                isActive
                  ? 'bg-[#D0B284] border-[#D0B284] text-black'
                  : isCompleted
                    ? 'bg-[#D0B284] border-[#D0B284] text-black'
                    : 'bg-gray-800 border-gray-600 text-gray-400'
              }
            `}
            >
              {isCompleted ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <IconComponent className="w-4 h-4" />
              )}
            </div>
            <div>
              <p className={`text-xs font-medium ${isActive ? 'text-[#D0B284]' : 'text-gray-400'}`}>
                {step.title}
              </p>
            </div>
            {index < steps.length - 1 && (
              <div className={`w-12 h-0.5 mx-2 ${isCompleted ? 'bg-[#D0B284]' : 'bg-gray-600'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
};

// Compact Form Field Component
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
    <Label className="text-[#DCDDCC] text-xs font-medium flex items-center gap-1">
      {label}
      {required && <span className="text-red-400 text-xs">*</span>}
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

// Custom Date Picker with Year Dropdown
const DatePicker = ({ date, onDateChange }: { date: Date; onDateChange: (date: Date) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(date.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(date.getMonth());

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i);
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];

  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      onDateChange(selectedDate);
      setIsOpen(false);
    }
  };

  const handleYearChange = (year: number) => {
    setSelectedYear(year);
    const newDate = new Date(year, selectedMonth, date.getDate());
    onDateChange(newDate);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start text-left bg-black/50 border-[#D0B284]/20 text-white h-10 text-sm hover:bg-black/70 hover:border-[#D0B284]/40 transition-colors"
        >
          <CalendarIcon className="mr-2 h-4 w-4 text-[#D0B284]" />
          {format(date, 'MMM dd, yyyy')}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-2 bg-[#231F20] border-[#D0B284]/20">
        <div className="space-y-2">
          <div className="flex gap-2">
            <select
              value={selectedYear}
              onChange={(e) => handleYearChange(parseInt(e.target.value))}
              className="bg-black/50 border border-[#D0B284]/20 text-white text-xs px-2 py-1 rounded"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => {
                const month = parseInt(e.target.value);
                setSelectedMonth(month);
                const newDate = new Date(selectedYear, month, date.getDate());
                onDateChange(newDate);
              }}
              className="bg-black/50 border border-[#D0B284]/20 text-white text-xs px-2 py-1 rounded"
            >
              {months.map((month, index) => (
                <option key={index} value={index}>
                  {month}
                </option>
              ))}
            </select>
          </div>
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleDateSelect}
            month={new Date(selectedYear, selectedMonth)}
            disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
            className="text-white"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
};

export function VerificationForm({ onSuccess, onCancel }: VerificationFormProps) {
  const { applyForSeller, getAccessToken, user } = useAuth();

  // Check user status first - before any other hooks to avoid hooks rule violations
  const isPending = user?.sellerStatus === 'PENDING';
  const isRejected = user?.sellerStatus === 'REJECTED';

  // Status screens - early returns before any state hooks
  if (isPending) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div className="bg-gradient-to-br from-[#231F20] to-[#1a1718] rounded-xl border border-[#D0B284]/30 shadow-2xl p-8 max-w-md mx-auto">
          <div className="flex flex-col items-center text-center">
            <div className="bg-yellow-500/10 rounded-full p-4 mb-4">
              <Clock className="w-12 h-12 text-yellow-500" />
            </div>
            <h2 className="text-xl font-bold text-[#D0B284] mb-2">Verification In Progress</h2>
            <p className="text-[#DCDDCC] text-sm mb-4">
              Your application is under review. We'll notify you once complete.
            </p>
            <div className="flex items-center gap-2 text-yellow-500/80">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Under Review</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isRejected) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
        <div className="bg-gradient-to-br from-[#231F20] to-[#1a1718] rounded-xl border border-red-500/30 shadow-2xl p-8 max-w-md mx-auto">
          <div className="flex flex-col items-center text-center">
            <div className="bg-red-500/10 rounded-full p-4 mb-4">
              <X className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-[#D0B284] mb-2">Verification Rejected</h2>
            <p className="text-[#DCDDCC] text-sm mb-2">Your application was not approved.</p>
            {user?.rejectionReason && (
              <div className="bg-red-500/10 border border-red-500/30 rounded p-2 mb-4">
                <p className="text-red-400 text-xs">Reason: {user.rejectionReason}</p>
              </div>
            )}
            <Button
              onClick={() => window.location.reload()}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm px-4 py-2"
            >
              Apply Again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // All state hooks after early returns
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    documentType: 'DRIVERS_LICENSE',
    documentNumber: '',
    fullName: '',
    dateOfBirth: new Date(1990, 0, 1), // Default to a reasonable birth year
    countryOfIssue: '',
    state: '',
    address: '',
    emailAddress: '',
    documentImage: null as File | null,
    postalCode: '',
    phoneNumber: '',
    occupation: '',
  });

  // Facial verification state
  const [showCamera, setShowCamera] = useState(false);
  const [facialVerificationStatus, setFacialVerificationStatus] =
    useState<FacialVerificationStatus | null>(null);
  const [isProcessingFacial, setIsProcessingFacial] = useState(false);
  const [facialVerificationComplete, setFacialVerificationComplete] = useState(false);

  // Test state
  const [isCreatingDummy, setIsCreatingDummy] = useState(false);

  // Document submission state
  const [documentSubmitted, setDocumentSubmitted] = useState(false);
  const [documentVerificationId, setDocumentVerificationId] = useState<string | null>(null);

  // Success state
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Validation
  const validateStep1 = () => {
    const errors: Record<string, string> = {};

    if (!formData.documentNumber.trim()) errors.documentNumber = 'Required';
    if (!formData.fullName.trim()) errors.fullName = 'Required';
    if (!formData.countryOfIssue.trim()) errors.countryOfIssue = 'Required';
    if (!formData.address.trim()) errors.address = 'Required';
    if (!formData.emailAddress.trim()) errors.emailAddress = 'Required';

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (formData.emailAddress && !emailRegex.test(formData.emailAddress)) {
      errors.emailAddress = 'Invalid email format';
    }

    // Optional phone validation if provided
    if (
      formData.phoneNumber &&
      !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phoneNumber.replace(/\s/g, ''))
    ) {
      errors.phoneNumber = 'Invalid phone number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNextStep = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (currentStep === 1 && validateStep1()) {
      // Step 1 → Step 2: Just validate and move to document upload
      setCurrentStep(2);
      setError(null);
    }
  };

  const handleDocumentSubmit = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    if (!formData.documentImage) {
      setError('Please upload a document image first.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setError('Please log in again to continue.');
        return;
      }

      // Prepare document verification data
      const verificationData: VerificationSubmissionData = {
        documentType: formData.documentType,
        documentNumber: formData.documentNumber,
        firstName: formData.fullName.split(' ')[0] || '',
        lastName: formData.fullName.split(' ').slice(1).join(' ') || '',
        dateOfBirth: formData.dateOfBirth.toISOString(),
        countryOfIssue: formData.countryOfIssue,
        state: formData.state,
        address: formData.address,
        emailAddress: formData.emailAddress,
        documentImage: formData.documentImage,
      };

      // Submit document verification
      const result = await VerificationApi.submitVerification(verificationData, token);

      if (result.success) {
        // Document verification submitted successfully
        setDocumentSubmitted(true);
        setDocumentVerificationId(result.data.id);
        setCurrentStep(3);
        setError(null);
      } else {
        setError(result.error || 'Failed to submit document verification');
      }
    } catch (err) {
      console.error('Error submitting document verification:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit document verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if we can proceed to final submission
  const canSubmitVerification = () => {
    return (
      currentStep === 3 &&
      documentSubmitted &&
      facialVerificationComplete &&
      facialVerificationStatus?.facialVerificationStatus === 'COMPLETED'
    );
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError(null);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      setFormData({ ...formData, documentImage: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDeleteDocument = () => {
    setImagePreview(null);
    setFormData({ ...formData, documentImage: null });
  };

  const handleCreateDummyVerification = async () => {
    try {
      setIsCreatingDummy(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        setError('Please log in again to create test verification.');
        return;
      }

      const result = await VerificationApi.createDummyVerification(token);

      if (result.success) {
        // Success! Move to Step 2 to test facial verification
        setCurrentStep(2);
        setError(null);
      } else {
        setError(result.error || 'Failed to create test verification');
      }
    } catch (err) {
      console.error('Error creating dummy verification:', err);
      setError(err instanceof Error ? err.message : 'Failed to create test verification');
    } finally {
      setIsCreatingDummy(false);
    }
  };

  // Check facial verification status on component mount and step changes
  useEffect(() => {
    const checkFacialVerificationStatus = async () => {
      if (currentStep === 3) {
        try {
          const token = await getAccessToken();
          if (token) {
            const result = await VerificationApi.getFacialVerificationStatus(token);
            if (result.success) {
              setFacialVerificationStatus(result.data);
              setFacialVerificationComplete(result.data.facialVerificationStatus === 'COMPLETED');
            }
          } else {
            console.warn('No access token available for facial verification status check');
            // Don't set error here as user might still be loading
          }
        } catch (err) {
          console.error('Error checking facial verification status:', err);
        }
      }
    };

    checkFacialVerificationStatus();
  }, [currentStep, getAccessToken]);

  const handleStartFacialVerification = async () => {
    // Check authentication before starting camera
    const token = await getAccessToken();
    if (!token) {
      console.error('Authentication check failed before starting camera');
      console.error('User object:', user);
      setError('Please log in again to access facial verification.');
      return;
    }

    // Check if user is ready for facial verification
    const readiness = await VerificationApi.isReadyForFacialVerification(token);

    if (!readiness.ready) {
      if (readiness.requiresDocumentFirst) {
        setCurrentStep(1); // Go back to document step
      }
      setError(readiness.reason || 'Cannot start facial verification');
      return;
    }

    setShowCamera(true);
    setError(null);
  };

  const handleCancelCamera = () => {
    setShowCamera(false);
  };

  const handleSelfieCapture = async (imageBlob: Blob) => {
    try {
      setIsProcessingFacial(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        console.error('Authentication failed - user not properly logged in');
        console.error('User object:', user);
        console.error('Is authenticated:', !!user);
        setError('Please log in again to continue with facial verification.');
        setShowCamera(false);
        return;
      }

      // Check if user is ready for facial verification
      const readiness = await VerificationApi.isReadyForFacialVerification(token);

      if (!readiness.ready) {
        if (readiness.requiresDocumentFirst) {
          setCurrentStep(1); // Go back to document step
        }
        setError(readiness.reason || 'Cannot start facial verification');
        setShowCamera(false);
        return;
      }

      const result = await VerificationApi.submitFacialVerification(imageBlob, token);

      if (result.success) {
        setFacialVerificationComplete(true);
        setShowCamera(false);

        // Update the facial verification status
        const statusResult = await VerificationApi.getFacialVerificationStatus(token);
        if (statusResult.success) {
          setFacialVerificationStatus(statusResult.data);
        }

        // Show message from backend response
        if (result.data.message) {
          // If it's a manual review message, show it as info (not an error)
          if (result.data.recommendation === 'MANUAL_REVIEW') {
            setError(result.data.message);
          } else if (result.data.recommendation === 'APPROVE') {
            setError(null);
          } else {
            setError(result.data.message);
          }
        } else {
          setError(null);
        }
      } else {
        setError(result.error || 'Failed to process facial verification');
      }
    } catch (err) {
      console.error('Facial verification error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process facial verification');
    } finally {
      setIsProcessingFacial(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Only allow submission on the final step
    if (currentStep !== 3) {
      return;
    }

    // Check if facial verification is complete
    if (!canSubmitVerification()) {
      setError('Please complete facial verification before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      // At this point, both document and facial verification are already submitted
      // Show success message

      setShowSuccessMessage(true);

      // Auto-close after 3 seconds
      setTimeout(() => {
        onSuccess?.();
      }, 3000);
    } catch (err) {
      console.error('Error finalizing verification:', err);
      setError(err instanceof Error ? err.message : 'Failed to finalize verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 1: Document Information
  const renderStep1 = () => (
    <div className="space-y-4">
      {/* Document Type and Number - Full Width */}
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Document Type" required>
          <select
            value={formData.documentType}
            onChange={(e) => setFormData({ ...formData, documentType: e.target.value })}
            className="w-full px-3 py-2 bg-black/50 border border-[#D0B284]/20 rounded text-white text-sm hover:border-[#D0B284]/40 transition-colors"
          >
            <option value="DRIVERS_LICENSE">Driver's License</option>
            <option value="PASSPORT">Passport</option>
            <option value="ID_CARD">Government ID</option>
          </select>
        </FormField>

        <FormField label="Document Number" required error={validationErrors.documentNumber}>
          <Input
            value={formData.documentNumber}
            onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
            className="bg-black/50 border-[#D0B284]/20 text-white h-10 text-sm hover:border-[#D0B284]/40 transition-colors"
            placeholder="Enter document number"
          />
        </FormField>
      </div>

      {/* Personal Information - 3 Columns */}
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Full Name" required error={validationErrors.fullName}>
          <Input
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            className="bg-black/50 border-[#D0B284]/20 text-white h-10 text-sm hover:border-[#D0B284]/40 transition-colors"
            placeholder="Full legal name"
          />
        </FormField>

        <FormField label="Date of Birth" required>
          <DatePicker
            date={formData.dateOfBirth}
            onDateChange={(date) => setFormData({ ...formData, dateOfBirth: date })}
          />
        </FormField>

        <FormField label="Email Address" required error={validationErrors.emailAddress}>
          <Input
            type="email"
            value={formData.emailAddress}
            onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
            className="bg-black/50 border-[#D0B284]/20 text-white h-10 text-sm hover:border-[#D0B284]/40 transition-colors"
            placeholder="Email address"
          />
        </FormField>
      </div>

      {/* Location Information - 3 Columns */}
      <div className="grid grid-cols-3 gap-4">
        <FormField label="Country of Issue" required error={validationErrors.countryOfIssue}>
          <Input
            value={formData.countryOfIssue}
            onChange={(e) => setFormData({ ...formData, countryOfIssue: e.target.value })}
            className="bg-black/50 border-[#D0B284]/20 text-white h-10 text-sm hover:border-[#D0B284]/40 transition-colors"
            placeholder="Country"
          />
        </FormField>

        <FormField label="State/Province">
          <Input
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
            className="bg-black/50 border-[#D0B284]/20 text-white h-10 text-sm hover:border-[#D0B284]/40 transition-colors"
            placeholder="State or province"
          />
        </FormField>

        <FormField label="Postal Code">
          <Input
            value={formData.postalCode || ''}
            onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
            className="bg-black/50 border-[#D0B284]/20 text-white h-10 text-sm hover:border-[#D0B284]/40 transition-colors"
            placeholder="Postal code"
          />
        </FormField>
      </div>

      {/* Address - Full Width */}
      <FormField label="Street Address" required error={validationErrors.address}>
        <Input
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          className="bg-black/50 border-[#D0B284]/20 text-white h-10 text-sm hover:border-[#D0B284]/40 transition-colors"
          placeholder="Full street address"
        />
      </FormField>

      {/* TEST BUTTON - Create dummy verification */}
      <div className="pt-4 border-t border-[#D0B284]/20">
        <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
            <h4 className="text-xs font-semibold text-blue-400">Testing Mode</h4>
          </div>
          <p className="text-xs text-blue-300 leading-tight mb-3">
            Create a dummy verification record to test facial verification functionality without
            completing the full form.
          </p>
          <Button
            type="button"
            onClick={handleCreateDummyVerification}
            disabled={isCreatingDummy}
            className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-2 h-8"
          >
            {isCreatingDummy ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Creating...
              </>
            ) : (
              <>🧪 Create Test Verification</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );

  // Step 2: Document Upload
  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="bg-[#D0B284]/10 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
          <FileText className="w-8 h-8 text-[#D0B284]" />
        </div>
        <h3 className="text-lg font-semibold text-[#D0B284] mb-2">Upload Your Document</h3>
        <p className="text-sm text-gray-400">
          Please upload a clear photo of your{' '}
          {formData.documentType.replace('_', ' ').toLowerCase()}
        </p>
      </div>

      {/* Document Upload */}
      <div className="max-w-md mx-auto">
        <FormField label="Document Image" required>
          <div className="flex items-center justify-center w-full">
            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-[#D0B284]/20 border-dashed rounded cursor-pointer bg-black/30 hover:bg-black/50 transition-all group">
              {imagePreview ? (
                <div className="relative w-full h-full p-4">
                  <Image
                    src={imagePreview}
                    alt="Document preview"
                    fill
                    className="object-contain rounded"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleDeleteDocument();
                    }}
                    className="absolute top-2 right-2 p-2 bg-red-500 hover:bg-red-600 rounded-full text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="text-center p-8">
                  <Upload className="w-12 h-12 mb-4 text-[#D0B284] mx-auto" />
                  <p className="text-base text-[#D0B284] font-medium mb-2">Upload Document</p>
                  <p className="text-sm text-[#DCDDCC]">PNG, JPG (MAX 5MB)</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Make sure all text is clearly visible and the image is well-lit
                  </p>
                </div>
              )}
              <input
                type="file"
                className="hidden"
                accept="image/png,image/jpeg"
                onChange={handleImageChange}
              />
            </label>
          </div>
        </FormField>
      </div>

      {/* Submit Document Button */}
      <div className="text-center">
        <Button
          type="button"
          onClick={handleDocumentSubmit}
          disabled={!formData.documentImage || isSubmitting}
          className={`font-medium px-6 py-3 rounded text-sm ${
            formData.documentImage && !isSubmitting
              ? 'bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black'
              : 'bg-gray-600 text-gray-300 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading Document...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Submit Document
            </>
          )}
        </Button>
      </div>
    </div>
  );

  // Step 3: Identity Verification (Selfie)
  const renderStep3 = () => {
    // When camera is active, use full-width layout for better spacing
    if (showCamera) {
      return (
        <div className="space-y-6">
          {/* Document Upload Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <FormField label="Document Image">
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-[#D0B284]/20 border-dashed rounded cursor-pointer bg-black/30 hover:bg-black/50 transition-all group">
                    {imagePreview ? (
                      <div className="relative w-full h-full p-2">
                        <Image
                          src={imagePreview}
                          alt="Document preview"
                          fill
                          className="object-contain rounded"
                        />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteDocument();
                          }}
                          className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 rounded-full text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="w-4 h-4 mb-1 text-[#D0B284] mx-auto" />
                        <p className="text-xs text-[#D0B284] font-medium">Upload Document</p>
                      </div>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/png,image/jpeg"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>
              </FormField>
            </div>

            <div className="flex items-center">
              <div className="bg-green-500/10 border border-green-500/30 rounded p-3 w-full">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <h4 className="text-xs font-semibold text-green-400">Ready for Selfie</h4>
                </div>
                <p className="text-xs text-green-400">Document step completed</p>
              </div>
            </div>
          </div>

          {/* Camera Interface - Full Width */}
          <div className="space-y-4">
            <div className="bg-[#D0B284]/5 border border-[#D0B284]/20 rounded p-4">
              <div className="flex items-center gap-2 mb-2">
                <Camera className="w-5 h-5 text-[#D0B284]" />
                <h4 className="text-sm font-semibold text-[#D0B284]">Take Your Selfie</h4>
              </div>
              <p className="text-sm text-[#DCDDCC] leading-relaxed">
                Position your face clearly in the camera and ensure good lighting for the best
                results.
              </p>
            </div>

            <div className="flex justify-center">
              <div style={{ width: '400px', height: '300px' }}>
                <CameraCapture
                  onCapture={handleSelfieCapture}
                  onCancel={handleCancelCamera}
                  isUploading={isProcessingFacial}
                />
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Default two-column layout when camera is not active
    return (
      <div className="grid grid-cols-2 gap-4 min-h-[300px]">
        {/* Document Upload */}
        <div>
          <FormField label="Document Image">
            <div className="flex items-center justify-center w-full">
              <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-[#D0B284]/20 border-dashed rounded cursor-pointer bg-black/30 hover:bg-black/50 transition-all group">
                {imagePreview ? (
                  <div className="relative w-full h-full p-2">
                    <Image
                      src={imagePreview}
                      alt="Document preview"
                      fill
                      className="object-contain rounded"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDeleteDocument();
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-500 hover:bg-red-600 rounded-full text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="w-6 h-6 mb-2 text-[#D0B284] mx-auto" />
                    <p className="text-xs text-[#D0B284] font-medium">Upload Document</p>
                    <p className="text-xs text-[#DCDDCC]">PNG, JPG (MAX 5MB)</p>
                  </div>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg"
                  onChange={handleImageChange}
                />
              </label>
            </div>
          </FormField>
        </div>

        {/* Facial Verification Section */}
        <div className="space-y-4">
          {/* Status Display */}
          {facialVerificationStatus && (
            <div
              className={`p-3 rounded border ${
                facialVerificationStatus.facialVerificationStatus === 'COMPLETED'
                  ? 'bg-green-500/10 border-green-500/30'
                  : facialVerificationStatus.facialVerificationStatus === 'FAILED'
                    ? 'bg-red-500/10 border-red-500/30'
                    : 'bg-[#D0B284]/5 border-[#D0B284]/20'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Shield
                  className={`w-4 h-4 ${
                    facialVerificationStatus.facialVerificationStatus === 'COMPLETED'
                      ? 'text-green-400'
                      : facialVerificationStatus.facialVerificationStatus === 'FAILED'
                        ? 'text-red-400'
                        : 'text-[#D0B284]'
                  }`}
                />
                <h4
                  className={`text-xs font-semibold ${
                    facialVerificationStatus.facialVerificationStatus === 'COMPLETED'
                      ? 'text-green-400'
                      : facialVerificationStatus.facialVerificationStatus === 'FAILED'
                        ? 'text-red-400'
                        : 'text-[#D0B284]'
                  }`}
                >
                  Facial Verification
                  {facialVerificationStatus.facialVerificationStatus === 'COMPLETED' && ' ✓'}
                  {facialVerificationStatus.facialVerificationStatus === 'FAILED' && ' ✗'}
                </h4>
              </div>

              {facialVerificationStatus.facialVerificationStatus === 'COMPLETED' ? (
                <div className="space-y-2">
                  <p className="text-xs text-green-400">
                    Facial verification completed successfully!
                  </p>
                  {facialVerificationStatus.overallScore && (
                    <p className="text-xs text-[#DCDDCC]">
                      Overall Score: {Math.round(facialVerificationStatus.overallScore)}%
                    </p>
                  )}
                  {facialVerificationStatus.visionApiRecommendation && (
                    <p className="text-xs text-[#DCDDCC]">
                      Status: {facialVerificationStatus.visionApiRecommendation}
                    </p>
                  )}
                </div>
              ) : facialVerificationStatus.facialVerificationStatus === 'FAILED' ? (
                <div className="space-y-2">
                  <p className="text-xs text-red-400">
                    Facial verification failed. Please try again.
                  </p>
                  <Button
                    onClick={handleStartFacialVerification}
                    size="sm"
                    className="bg-[#D0B284] hover:bg-[#D0B284]/80 text-black text-xs"
                    disabled={!facialVerificationStatus.canStartFacialVerification}
                  >
                    <Camera className="w-3 h-3 mr-1" />
                    Try Again
                  </Button>
                </div>
              ) : facialVerificationStatus.canStartFacialVerification ? (
                <div className="space-y-2">
                  <p className="text-xs text-[#DCDDCC] leading-tight">
                    Complete your verification by taking a selfie.
                  </p>
                  <Button
                    onClick={handleStartFacialVerification}
                    size="sm"
                    className="bg-[#D0B284] hover:bg-[#D0B284]/80 text-black text-xs"
                  >
                    <Camera className="w-3 h-3 mr-1" />
                    Start Facial Verification
                  </Button>
                </div>
              ) : (
                <p className="text-xs text-gray-400">
                  {facialVerificationStatus.reason ||
                    'Please complete document verification first.'}
                </p>
              )}
            </div>
          )}

          {/* Initial prompt if no status yet */}
          {!facialVerificationStatus && (
            <div className="bg-[#D0B284]/5 border border-[#D0B284]/20 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-[#D0B284]" />
                <h4 className="text-xs font-semibold text-[#D0B284]">Facial Verification</h4>
              </div>
              <p className="text-xs text-[#DCDDCC] leading-tight mb-3">
                Complete your verification by taking a selfie.
              </p>
              <Button
                onClick={handleStartFacialVerification}
                size="sm"
                className="bg-[#D0B284] hover:bg-[#D0B284]/80 text-black text-xs"
              >
                <Camera className="w-3 h-3 mr-1" />
                Start Facial Verification
              </Button>
            </div>
          )}

          {/* Debug info - remove this after fixing */}
          {facialVerificationStatus && (
            <div className="mt-2 p-2 bg-blue-500/10 border border-blue-500/30 rounded text-xs">
              <p className="text-blue-400 font-semibold">Debug Info:</p>
              <p className="text-blue-300">
                Status: {facialVerificationStatus.facialVerificationStatus}
              </p>
              <p className="text-blue-300">
                Can Start: {facialVerificationStatus.canStartFacialVerification ? 'Yes' : 'No'}
              </p>
              <p className="text-blue-300">Reason: {facialVerificationStatus.reason || 'None'}</p>
              <Button
                onClick={() => {
                  setFacialVerificationStatus(null);
                  setFacialVerificationComplete(false);
                  setShowCamera(false);
                }}
                size="sm"
                className="mt-2 bg-blue-500 hover:bg-blue-600 text-white text-xs"
              >
                Reset Status
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      {/* Modal with 4:3 aspect ratio */}
      <div
        className="bg-gradient-to-br from-[#231F20] to-[#1a1718] rounded-xl border border-[#D0B284]/30 shadow-2xl overflow-hidden"
        style={{
          width: '800px',
          height: '600px',
          maxWidth: '90vw',
          maxHeight: '90vh',
        }}
      >
        <div className="h-full flex flex-col p-6">
          {/* Header */}
          <div className="text-center mb-4">
            <div className="inline-flex items-center justify-center w-10 h-10 bg-[#D0B284]/10 rounded-full mb-2">
              <User className="w-5 h-5 text-[#D0B284]" />
            </div>
            <h2 className="text-lg font-bold text-[#D0B284]">Seller Verification</h2>
            <p className="text-xs text-gray-400">Secure your account with identity verification</p>
          </div>

          {/* Stepper */}
          <StepperComponent currentStep={currentStep} totalSteps={3} />

          {/* Success Message */}
          {showSuccessMessage && (
            <div className="mb-3 p-4 bg-green-500/10 border border-green-500/30 rounded flex items-start gap-2">
              <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-green-400 text-sm font-semibold">Verification Submitted!</p>
                <p className="text-green-300 text-xs mt-1">
                  Thank you for submitting your verification. Please wait to hear back from us.
                  We'll review your application and get back to you soon.
                </p>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && !showSuccessMessage && (
            <div className="mb-3 p-2 bg-red-500/10 border border-red-500/30 rounded flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* Form Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <form onSubmit={handleSubmit} className="h-full">
              <div className="min-h-full flex flex-col">
                <div className="flex-1">
                  {currentStep === 1 && renderStep1()}
                  {currentStep === 2 && renderStep2()}
                  {currentStep === 3 && renderStep3()}
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between items-center mt-4 pt-3 border-t border-[#D0B284]/20">
                  <div>
                    {currentStep > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={handlePreviousStep}
                        className="text-gray-400 hover:text-white hover:bg-gray-800/50 px-3 py-1 rounded text-xs h-8"
                      >
                        <ArrowLeft className="w-3 h-3 mr-1" />
                        Previous
                      </Button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    {onCancel && (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={onCancel}
                        className="text-red-400 hover:bg-red-500/20 px-3 py-1 rounded text-xs h-8"
                        disabled={isSubmitting}
                      >
                        Cancel
                      </Button>
                    )}

                    {currentStep === 1 ? (
                      <Button
                        type="button"
                        onClick={(e) => handleNextStep(e)}
                        disabled={isSubmitting}
                        className="bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-medium px-4 py-1 rounded text-xs h-8 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Continue
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    ) : currentStep === 2 ? null : ( // Step 2 uses its own submit button in renderStep2()
                      <Button
                        type="submit"
                        className={`font-medium px-4 py-1 rounded text-xs h-8 ${
                          canSubmitVerification()
                            ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white'
                            : 'bg-gray-600 text-gray-300 cursor-not-allowed'
                        }`}
                        disabled={isSubmitting || !canSubmitVerification() || showSuccessMessage}
                        title={
                          !canSubmitVerification()
                            ? 'Complete facial verification to submit'
                            : undefined
                        }
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            Submitting...
                          </>
                        ) : canSubmitVerification() ? (
                          <>
                            <Shield className="w-3 h-3 mr-1" />
                            Submit Verification
                          </>
                        ) : (
                          <>
                            <Shield className="w-3 h-3 mr-1" />
                            Complete Facial Verification
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
