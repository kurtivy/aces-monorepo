'use client';

import { useState } from 'react';
import { type VerificationApplication } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  User,
  Calendar,
  MapPin,
  Mail,
  FileText,
  Check,
  X,
  Loader2,
  CreditCard,
  Globe,
  MapPinned,
} from 'lucide-react';
import Image from 'next/image';

interface VerificationDetailsModalProps {
  application: VerificationApplication;
  open: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  processing: boolean;
}

export function VerificationDetailsModal({
  application,
  open,
  onClose,
  onApprove,
  onReject,
  processing,
}: VerificationDetailsModalProps) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleReject = () => {
    if (rejectionReason.trim()) {
      onReject(rejectionReason.trim());
      setShowRejectForm(false);
      setRejectionReason('');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOfBirth = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#231F20] border-[#D0B284]/20">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#D0B284]">
            Verification Application Details
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <Card className="bg-[#1A1A1A] border-[#D0B284]/20">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-[#D0B284] mb-2">
                    {application.fullName}
                  </h3>
                  <div className="flex items-center gap-4 text-sm text-[#DCDDCC]">
                    <div className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {application.user.username || 'No username'}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {formatDate(application.submittedAt)}
                    </div>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                  {application.status}
                </Badge>
              </div>
            </CardHeader>
          </Card>

          {/* Personal Information */}
          <Card className="bg-[#1A1A1A] border-[#D0B284]/20">
            <CardHeader>
              <CardTitle className="text-[#D0B284]">Personal Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-[#DCDDCC]">Full Name</label>
                    <p className="text-[#D0B284] font-medium">{application.fullName}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#DCDDCC]">Date of Birth</label>
                    <p className="text-[#D0B284] font-medium">
                      {formatDateOfBirth(application.dateOfBirth)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-[#DCDDCC]">Email Address</label>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-[#DCDDCC]" />
                      <p className="text-[#D0B284] font-medium">{application.emailAddress}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-[#DCDDCC]">Country of Issue</label>
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-[#DCDDCC]" />
                      <p className="text-[#D0B284] font-medium">{application.countryOfIssue}</p>
                    </div>
                  </div>
                  {application.state && (
                    <div>
                      <label className="text-sm font-medium text-[#DCDDCC]">State/Province</label>
                      <div className="flex items-center gap-2">
                        <MapPinned className="w-4 h-4 text-[#DCDDCC]" />
                        <p className="text-[#D0B284] font-medium">{application.state}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-[#DCDDCC]">Address</label>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-[#DCDDCC]" />
                      <p className="text-[#D0B284] font-medium">{application.address}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Document Information */}
          <Card className="bg-[#1A1A1A] border-[#D0B284]/20">
            <CardHeader>
              <CardTitle className="text-[#D0B284]">Document Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium text-[#DCDDCC]">Document Type</label>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#DCDDCC]" />
                    <p className="text-[#D0B284] font-medium">{application.documentType}</p>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#DCDDCC]">Document Number</label>
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#DCDDCC]" />
                    <p className="text-[#D0B284] font-medium">{application.documentNumber}</p>
                  </div>
                </div>
              </div>

              {application.documentImageUrl && (
                <div>
                  <label className="text-sm font-medium text-[#DCDDCC] mb-2 block">
                    Uploaded Document
                  </label>
                  <div className="border border-[#D0B284]/20 rounded-lg p-4 bg-black/20">
                    <Image
                      src={application.documentImageUrl}
                      alt="Verification document"
                      className="max-w-full h-auto max-h-96 mx-auto rounded-lg"
                      width={400}
                      height={300}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Application History */}
          <Card className="bg-[#1A1A1A] border-[#D0B284]/20">
            <CardHeader>
              <CardTitle className="text-[#D0B284]">Application History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#DCDDCC]">Submission Date</label>
                  <p className="text-[#D0B284] font-medium">
                    {formatDate(application.submittedAt)}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#DCDDCC]">Attempts</label>
                  <p className="text-[#D0B284] font-medium">{application.attempts}</p>
                </div>
                {application.lastAttemptAt && (
                  <div>
                    <label className="text-sm font-medium text-[#DCDDCC]">Last Attempt</label>
                    <p className="text-[#D0B284] font-medium">
                      {formatDate(application.lastAttemptAt)}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* User Information */}
          <Card className="bg-[#1A1A1A] border-[#D0B284]/20">
            <CardHeader>
              <CardTitle className="text-[#D0B284]">User Account Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-[#DCDDCC]">User ID</label>
                  <p className="text-[#D0B284] font-mono text-sm">{application.user.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#DCDDCC]">Wallet Address</label>
                  <p className="text-[#D0B284] font-mono text-sm">
                    {application.user.walletAddress || 'Not connected'}
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-[#DCDDCC]">Account Created</label>
                <p className="text-[#D0B284] font-medium">
                  {formatDate(application.user.createdAt)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Rejection Form */}
          {showRejectForm && (
            <Card className="bg-red-500/10 border-red-500/20">
              <CardHeader>
                <CardTitle className="text-red-400">Rejection Reason</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Please provide a clear reason for rejection..."
                  className="bg-black/50 border-red-500/30 text-white placeholder:text-gray-500"
                  rows={4}
                />
                <div className="flex gap-3">
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={!rejectionReason.trim() || processing}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {processing ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <X className="w-4 h-4 mr-2" />
                    )}
                    Confirm Rejection
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectionReason('');
                    }}
                    disabled={processing}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Buttons */}
          {!showRejectForm && (
            <div className="flex gap-3 pt-4 border-t border-[#D0B284]/20">
              <Button
                onClick={onApprove}
                disabled={processing}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {processing ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Check className="w-4 h-4 mr-2" />
                )}
                Approve Application
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowRejectForm(true)}
                disabled={processing}
                className="bg-red-600 hover:bg-red-700"
              >
                <X className="w-4 h-4 mr-2" />
                Reject Application
              </Button>
              <Button variant="outline" onClick={onClose} disabled={processing}>
                Close
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
