'use client';

import type React from 'react';

import { useState } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { VerificationApi } from '@/lib/api/verification';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { CalendarIcon, Upload, X, Loader2, Clock } from 'lucide-react';
import Image from 'next/image';

interface VerificationFormProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function VerificationForm({ onSuccess, onCancel }: VerificationFormProps) {
  const { applyForSeller, getAccessToken, user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    documentType: 'DRIVERS_LICENSE',
    documentNumber: '',
    fullName: '',
    dateOfBirth: new Date(),
    countryOfIssue: '',
    state: '',
    address: '',
    emailAddress: '',
    documentImage: null as File | null,
  });

  // Check if user has a pending verification
  const isPending = user?.sellerStatus === 'PENDING';
  const isRejected = user?.sellerStatus === 'REJECTED';

  // If pending, show pending status UI
  if (isPending) {
    return (
      <div className="bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="bg-yellow-500/10 rounded-full p-4 mb-4">
            <Clock className="w-12 h-12 text-yellow-500" />
          </div>
          <h2 className="text-2xl font-bold text-[#D0B284] mb-3">Verification In Progress</h2>
          <p className="text-[#DCDDCC] mb-6 max-w-md">
            Your seller verification application is currently under review. We&apos;ll notify you
            once a decision has been made. This usually takes 1-2 business days.
          </p>
          <div className="flex items-center justify-center space-x-2 text-yellow-500/80">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Under Review</span>
          </div>
        </div>
      </div>
    );
  }

  // If rejected, show rejection message with ability to reapply
  if (isRejected) {
    return (
      <div className="bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20">
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="bg-red-500/10 rounded-full p-4 mb-4">
            <X className="w-12 h-12 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-[#D0B284] mb-3">Verification Rejected</h2>
          <p className="text-[#DCDDCC] mb-2">
            Unfortunately, your previous verification application was not approved.
          </p>
          {user?.rejectionReason && (
            <p className="text-red-400 mb-6 max-w-md">Reason: {user.rejectionReason}</p>
          )}
          <Button
            onClick={() => window.location.reload()}
            className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
          >
            Apply Again
          </Button>
        </div>
      </div>
    );
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        // 5MB limit
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

  const handleDeleteDocument = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error('No auth token available');

      const result = await VerificationApi.deleteVerificationDocument(token);

      if (result.success) {
        setImagePreview(null);
        setFormData({ ...formData, documentImage: null });
      } else {
        setError(result.error || 'Failed to delete document');
      }
    } catch (err) {
      console.error('Error deleting document:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Basic validation
    if (!formData.documentNumber || !formData.fullName || !formData.emailAddress) {
      setError('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      // Create FormData for file upload
      const submitData = new FormData();

      // Handle each field type appropriately
      submitData.append('documentType', formData.documentType);
      submitData.append('documentNumber', formData.documentNumber);
      submitData.append('fullName', formData.fullName);
      submitData.append('dateOfBirth', formData.dateOfBirth.toISOString());
      submitData.append('countryOfIssue', formData.countryOfIssue);
      submitData.append('state', formData.state);
      submitData.append('address', formData.address);
      submitData.append('emailAddress', formData.emailAddress);

      // Handle file separately - now optional
      if (formData.documentImage) {
        submitData.append('documentImage', formData.documentImage);
      }

      const success = await applyForSeller(submitData);
      if (success) {
        onSuccess?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit verification');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-[#231F20] rounded-xl p-6 border border-[#D0B284]/20">
        <h2 className="text-[#D0B284] text-2xl font-bold mb-6">Seller Verification</h2>

        {error && (
          <div className="mb-6 p-3 bg-red-500/20 border border-red-500 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Document Type */}
          <div>
            <Label className="text-[#DCDDCC]">Document Type</Label>
            <Select
              value={formData.documentType}
              onValueChange={(value) => setFormData({ ...formData, documentType: value })}
            >
              <option value="DRIVERS_LICENSE">Driver&apos;s License</option>
              <option value="PASSPORT">Passport</option>
              <option value="ID_CARD">Government ID Card</option>
            </Select>
          </div>

          {/* Document Number */}
          <div>
            <Label className="text-[#DCDDCC]">Document Number *</Label>
            <Input
              value={formData.documentNumber}
              onChange={(e) => setFormData({ ...formData, documentNumber: e.target.value })}
              className="bg-black/50 border-[#D0B284]/20 text-white"
              placeholder="Enter document number"
              required
            />
          </div>

          {/* Full Name */}
          <div>
            <Label className="text-[#DCDDCC]">Full Name *</Label>
            <Input
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="bg-black/50 border-[#D0B284]/20 text-white"
              placeholder="Enter your full name"
              required
            />
          </div>

          {/* Date of Birth */}
          <div>
            <Label className="text-[#DCDDCC]">Date of Birth *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal bg-black/50 border-[#D0B284]/20 text-white"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {format(formData.dateOfBirth, 'PPP')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={formData.dateOfBirth}
                  onSelect={(date) => date && setFormData({ ...formData, dateOfBirth: date })}
                  disabled={(date) => date > new Date() || date < new Date('1900-01-01')}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Country of Issue */}
          <div>
            <Label className="text-[#DCDDCC]">Country of Issue *</Label>
            <Input
              value={formData.countryOfIssue}
              onChange={(e) => setFormData({ ...formData, countryOfIssue: e.target.value })}
              className="bg-black/50 border-[#D0B284]/20 text-white"
              placeholder="Enter country"
              required
            />
          </div>

          {/* State */}
          <div>
            <Label className="text-[#DCDDCC]">State/Province</Label>
            <Input
              value={formData.state}
              onChange={(e) => setFormData({ ...formData, state: e.target.value })}
              className="bg-black/50 border-[#D0B284]/20 text-white"
              placeholder="Enter state/province"
            />
          </div>

          {/* Address */}
          <div className="md:col-span-2">
            <Label className="text-[#DCDDCC]">Address *</Label>
            <Input
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="bg-black/50 border-[#D0B284]/20 text-white"
              placeholder="Enter your address"
              required
            />
          </div>

          {/* Email */}
          <div className="md:col-span-2">
            <Label className="text-[#DCDDCC]">Email Address *</Label>
            <Input
              type="email"
              value={formData.emailAddress}
              onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
              className="bg-black/50 border-[#D0B284]/20 text-white"
              placeholder="Enter your email"
              required
            />
          </div>

          {/* Document Image Upload */}
          <div className="md:col-span-2">
            <Label className="text-[#DCDDCC]">Document Image (Optional for testing)</Label>
            <div className="mt-2">
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-[#D0B284]/20 border-dashed rounded-lg cursor-pointer bg-black/50 hover:bg-black/70 relative">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    {imagePreview ? (
                      <div className="relative w-full h-full">
                        <Image
                          src={imagePreview || '/placeholder.svg'}
                          alt="Document preview"
                          fill
                          className="object-contain"
                        />
                        {/* Delete button overlay */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleDeleteDocument();
                          }}
                          disabled={isDeleting}
                          className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 rounded-full text-white disabled:opacity-50"
                          title="Delete document"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-8 h-8 mb-4 text-[#D0B284]" />
                        <p className="mb-2 text-sm text-[#D0B284]">
                          <span className="font-semibold">Click to upload</span> or drag and drop
                        </p>
                        <p className="text-xs text-[#DCDDCC]">PNG, JPG or PDF (MAX. 5MB)</p>
                        <p className="text-xs text-emerald-400 mt-2">Optional for testing</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg,application/pdf"
                    onChange={handleImageChange}
                  />
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 mt-6">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              className="text-red-400 hover:bg-red-500/20"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
          )}
          <Button
            type="submit"
            variant="ghost"
            className="text-emerald-400 hover:bg-emerald-500/20"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Verification'
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
