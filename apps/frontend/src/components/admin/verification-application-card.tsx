'use client';

import { useState } from 'react';
import { type VerificationApplication } from '@/lib/api/admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { User, Calendar, MapPin, Mail, FileText, Eye, Check, X, Loader2 } from 'lucide-react';

interface VerificationApplicationCardProps {
  application: VerificationApplication;
  onViewDetails: () => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  processing: boolean;
}

export function VerificationApplicationCard({
  application,
  onViewDetails,
  onApprove,
  onReject,
  processing,
}: VerificationApplicationCardProps) {
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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card className="bg-[#1A1A1A] border-[#D0B284]/20">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-[#D0B284]">{application.fullName}</h3>
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                {application.status}
              </Badge>
            </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={onViewDetails}
            className="border-[#D0B284]/20 text-[#D0B284] hover:bg-[#D0B284]/10"
          >
            <Eye className="w-4 h-4 mr-2" />
            View Details
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Application Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#DCDDCC]" />
              <span className="text-[#DCDDCC]">Document:</span>
              <span className="text-[#D0B284]">{application.documentType}</span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#DCDDCC]" />
              <span className="text-[#DCDDCC]">Email:</span>
              <span className="text-[#D0B284]">{application.emailAddress}</span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-[#DCDDCC]" />
              <span className="text-[#DCDDCC]">Country:</span>
              <span className="text-[#D0B284]">{application.countryOfIssue}</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#DCDDCC]" />
              <span className="text-[#DCDDCC]">Attempts:</span>
              <span className="text-[#D0B284]">{application.attempts}</span>
            </div>
          </div>
        </div>

        {/* Rejection Form */}
        {showRejectForm && (
          <div className="space-y-3 p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            <label className="text-sm font-medium text-red-400">Rejection Reason (Required)</label>
            <Textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Please provide a clear reason for rejection..."
              className="bg-black/50 border-red-500/30 text-white placeholder:text-gray-500"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                size="sm"
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
                size="sm"
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectionReason('');
                }}
                disabled={processing}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {!showRejectForm && (
          <div className="flex gap-3 pt-2">
            <Button
              variant="default"
              onClick={onApprove}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {processing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Approve
            </Button>
            <Button
              variant="destructive"
              onClick={() => setShowRejectForm(true)}
              disabled={processing}
              className="bg-red-600 hover:bg-red-700"
            >
              <X className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
