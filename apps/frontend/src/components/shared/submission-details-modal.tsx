'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, Check, Calendar } from 'lucide-react';
import Image from 'next/image';

export interface SubmissionData {
  id: string;
  title: string;
  symbol: string;
  status: string;
  imageGallery: string[];
  createdAt: string;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  rwaListing?: {
    id: string;
    isLive: boolean;
  } | null;
}

interface SubmissionDetailsModalProps {
  submission: SubmissionData | null;
  isOpen: boolean;
  onClose: () => void;
}

export function SubmissionDetailsModal({
  submission,
  isOpen,
  onClose,
}: SubmissionDetailsModalProps) {
  if (!submission) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'text-[#D7BF75] bg-[#D7BF75]/10 border-[#D7BF75]/20';
      case 'APPROVED':
        return 'text-[#184D37] bg-[#184D37]/10 border-[#184D37]/20';
      case 'REJECTED':
        return 'text-red-400 bg-red-400/10 border-red-400/20';
      default:
        return 'text-[#DCDDCC] bg-[#DCDDCC]/10 border-[#DCDDCC]/20';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#231F20] border border-[#D0B284]/20">
        <DialogHeader>
          <DialogTitle className="text-[#D0B284] text-xl font-libre-caslon">
            Submission Details: {submission.title}
          </DialogTitle>
          <Badge className={`${getStatusColor(submission.status)} border-none w-fit`}>
            {submission.status}
          </Badge>
        </DialogHeader>

        <div className="mt-6 space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[#D0B284] text-sm font-medium font-jetbrains uppercase tracking-wide">
                Asset Title
              </label>
              <p className="text-white mt-2 bg-black/30 p-4 rounded-lg border border-[#D0B284]/10 font-semibold">
                {submission.title}
              </p>
            </div>

            <div>
              <label className="text-[#D0B284] text-sm font-medium font-jetbrains uppercase tracking-wide">
                Token Symbol
              </label>
              <p className="text-white mt-2 bg-black/30 p-4 rounded-lg border border-[#D0B284]/10 font-mono">
                ${submission.symbol}
              </p>
            </div>
          </div>

          {/* Submission Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-[#D0B284] text-sm font-medium font-jetbrains uppercase tracking-wide">
                Submission ID
              </label>
              <p className="text-white mt-2 bg-black/30 p-4 rounded-lg border border-[#D0B284]/10 font-mono text-sm">
                {submission.id}
              </p>
            </div>

            <div>
              <label className="text-[#D0B284] text-sm font-medium font-jetbrains uppercase tracking-wide">
                Submission Date
              </label>
              <p className="text-white mt-2 bg-black/30 p-4 rounded-lg border border-[#D0B284]/10">
                {formatDate(submission.createdAt)}
              </p>
            </div>
          </div>

          {/* Image Gallery */}
          <div>
            <label className="text-[#D0B284] text-sm font-medium font-jetbrains uppercase tracking-wide mb-4 block">
              Image Gallery ({submission.imageGallery.length} images)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {submission.imageGallery.map((image, index) => (
                <div key={index} className="relative group">
                  <Image
                    src={image}
                    alt={`${submission.title} - Image ${index + 1}`}
                    className="w-full h-32 object-cover rounded-lg border border-[#D0B284]/20 group-hover:border-[#D0B284]/50 transition-all"
                    width={200}
                    height={128}
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Status-Specific Information */}
          {submission.status === 'REJECTED' && submission.rejectionReason && (
            <div className="bg-red-400/10 border-l-4 border-red-400 p-6 rounded-lg">
              <h6 className="text-red-300 font-medium font-jetbrains uppercase text-sm mb-3">
                Rejection Reason
              </h6>
              <p className="text-red-300 leading-relaxed">{submission.rejectionReason}</p>
            </div>
          )}

          {submission.status === 'APPROVED' && submission.rwaListing && (
            <div className="bg-[#184D37]/10 border-l-4 border-[#184D37] p-6 rounded-lg">
              <h6 className="text-[#184D37] font-medium font-jetbrains uppercase text-sm mb-3">
                RWA Listing Information
              </h6>
              <div className="space-y-3">
                <p className="text-[#184D37]">
                  <span className="font-medium">Listing ID:</span>{' '}
                  <span className="font-mono">{submission.rwaListing.id}</span>
                </p>
                <p className="text-[#184D37]">
                  <span className="font-medium">Status:</span>{' '}
                  {submission.rwaListing.isLive ? (
                    <span className="text-[#184D37] font-medium">✅ Live on Marketplace</span>
                  ) : (
                    <span className="text-[#D7BF75]">⏳ Preparing to go live</span>
                  )}
                </p>
                {submission.approvedAt && (
                  <p className="text-[#184D37]">
                    <span className="font-medium">Approved:</span>{' '}
                    {formatDate(submission.approvedAt)}
                  </p>
                )}
              </div>
            </div>
          )}

          {submission.status === 'PENDING' && (
            <div className="bg-[#D7BF75]/10 border-l-4 border-[#D7BF75] p-6 rounded-lg">
              <h6 className="text-[#D7BF75] font-medium font-jetbrains uppercase text-sm mb-3">
                Review Status
              </h6>
              <p className="text-[#D7BF75] leading-relaxed">
                Your submission is currently being reviewed by our team. You will be notified once a
                decision has been made. This process typically takes 2-5 business days.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-4 pt-4 border-t border-[#D0B284]/20">
            {submission.rwaListing?.isLive && (
              <Button
                className="bg-[#184D37] hover:bg-[#184D37]/80 text-white"
                onClick={() => {
                  window.open(`/rwa/${submission.rwaListing?.id}`, '_blank');
                }}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                View Live Listing
              </Button>
            )}

            <Button
              variant="ghost"
              onClick={onClose}
              className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

