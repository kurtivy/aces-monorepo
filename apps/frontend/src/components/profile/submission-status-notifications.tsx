'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Check,
  X,
  Clock,
  ExternalLink,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  Eye,
  Calendar,
  FileText,
  Maximize2,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/auth-context';
import { SubmissionsApi, type UserSubmission } from '@/lib/api/submissions';
import { AdminApi } from '@/lib/api/admin';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';

interface AcknowledgedSubmissions {
  [submissionId: string]: boolean;
}

interface MinimizedPendingSubmissions {
  [submissionId: string]: boolean;
}

interface SignedImageUrls {
  [submissionId: string]: string[];
}

export function SubmissionStatusNotifications() {
  const { getAccessToken, user } = useAuth();

  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgedSubmissions, setAcknowledgedSubmissions] = useState<AcknowledgedSubmissions>(
    {},
  );
  const [minimizedPendingSubmissions, setMinimizedPendingSubmissions] = useState<MinimizedPendingSubmissions>(
    {},
  );
  const [selectedSubmissionForDetails, setSelectedSubmissionForDetails] =
    useState<UserSubmission | null>(null);
  const [signedImageUrls, setSignedImageUrls] = useState<SignedImageUrls>({});
  const [loadingImages, setLoadingImages] = useState<string | null>(null);

  // Load acknowledged submissions from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined' && user?.id) {
      const stored = localStorage.getItem(`acknowledged-submissions-${user.id}`);
      if (stored) {
        try {
          setAcknowledgedSubmissions(JSON.parse(stored));
        } catch (err) {
          console.error('Failed to parse acknowledged submissions:', err);
        }
      }

      const storedMinimized = localStorage.getItem(`minimized-pending-submissions-${user.id}`);
      if (storedMinimized) {
        try {
          setMinimizedPendingSubmissions(JSON.parse(storedMinimized));
        } catch (err) {
          console.error('Failed to parse minimized pending submissions:', err);
        }
      }
    }
  }, [user?.id]);

  // Save acknowledged submissions to localStorage
  const saveAcknowledgedSubmissions = (acknowledged: AcknowledgedSubmissions) => {
    if (typeof window !== 'undefined' && user?.id) {
      localStorage.setItem(`acknowledged-submissions-${user.id}`, JSON.stringify(acknowledged));
    }
  };

  // Save minimized pending submissions to localStorage
  const saveMinimizedPendingSubmissions = (minimized: MinimizedPendingSubmissions) => {
    if (typeof window !== 'undefined' && user?.id) {
      localStorage.setItem(`minimized-pending-submissions-${user.id}`, JSON.stringify(minimized));
    }
  };

  // Fetch user submissions
  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await SubmissionsApi.getUserSubmissions({ limit: 10 }, token);
      const newSubmissions = response.data;

      // Check if any minimized pending submissions have changed status
      const updatedMinimized = { ...minimizedPendingSubmissions };
      let hasStatusChanges = false;

      Object.keys(minimizedPendingSubmissions).forEach(submissionId => {
        const submission = newSubmissions.find(s => s.id === submissionId);
        if (submission && submission.status !== 'PENDING') {
          // Status changed from PENDING to APPROVED/REJECTED, remove from minimized
          delete updatedMinimized[submissionId];
          hasStatusChanges = true;
        }
      });

      if (hasStatusChanges) {
        setMinimizedPendingSubmissions(updatedMinimized);
        saveMinimizedPendingSubmissions(updatedMinimized);
      }

      setSubmissions(newSubmissions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSubmissions();
    }
  }, [user]);

  // Acknowledge a submission (dismiss notification)
  const acknowledgeSubmission = (submissionId: string, status: string) => {
    if (status === 'PENDING') {
      // For pending submissions, minimize instead of fully acknowledging
      const newMinimized = { ...minimizedPendingSubmissions, [submissionId]: true };
      setMinimizedPendingSubmissions(newMinimized);
      saveMinimizedPendingSubmissions(newMinimized);
    } else {
      // For approved/rejected submissions, fully acknowledge
      const newAcknowledged = { ...acknowledgedSubmissions, [submissionId]: true };
      setAcknowledgedSubmissions(newAcknowledged);
      saveAcknowledgedSubmissions(newAcknowledged);
    }
  };

  // Fetch signed URLs for submission images
  const fetchSignedImageUrls = async (submissionId: string) => {
    try {
      setLoadingImages(submissionId);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await AdminApi.getSubmissionImages(submissionId, token);
      const urls = response.data.images.map((img) => img.signedUrl);

      setSignedImageUrls((prev) => ({
        ...prev,
        [submissionId]: urls,
      }));
    } catch (err) {
      console.error('Failed to fetch signed image URLs:', err);
      // Don't set signed URLs, component will fall back to original URLs
    } finally {
      setLoadingImages(null);
    }
  };

  // Open submission details modal
  const openSubmissionDetails = async (submission: UserSubmission) => {
    setSelectedSubmissionForDetails(submission);

    // Fetch signed URLs if we don't have them already
    if (!signedImageUrls[submission.id]) {
      await fetchSignedImageUrls(submission.id);
    }
  };

  // Restore a minimized pending submission to full view
  const restoreMinimizedSubmission = (submissionId: string) => {
    const newMinimized = { ...minimizedPendingSubmissions };
    delete newMinimized[submissionId];
    setMinimizedPendingSubmissions(newMinimized);
    saveMinimizedPendingSubmissions(newMinimized);
  };

  // Filter submissions for full notifications (not acknowledged, not minimized)
  const fullNotificationsToShow = submissions.filter((submission) => {
    // Don't show if already acknowledged
    if (acknowledgedSubmissions[submission.id]) return false;

    // Don't show pending submissions that are minimized
    if (submission.status === 'PENDING' && minimizedPendingSubmissions[submission.id]) return false;

    // Always show PENDING submissions while they're pending (unless minimized)
    if (submission.status === 'PENDING') {
      return true;
    }

    // Always show status updates (approved/rejected)
    return submission.status === 'APPROVED' || submission.status === 'REJECTED';
  });

  // Filter submissions for minimized indicators (pending and minimized, but not status-changed)
  const minimizedIndicatorsToShow = submissions.filter((submission) => {
    // Only show pending submissions that are minimized and haven't been fully acknowledged
    return (
      submission.status === 'PENDING' &&
      minimizedPendingSubmissions[submission.id] &&
      !acknowledgedSubmissions[submission.id]
    );
  });

  // Helper function to get the correct image URLs (signed if available, otherwise original)
  const getSubmissionImages = (submission: UserSubmission) => {
    const signedUrls = signedImageUrls[submission.id];
    return signedUrls && signedUrls.length > 0 ? signedUrls : submission.imageGallery;
  };

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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <Check className="w-4 h-4 text-[#184D37]" />;
      case 'REJECTED':
        return <X className="w-4 h-4 text-red-400" />;
      case 'PENDING':
        return <Clock className="w-4 h-4 text-[#D7BF75]" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-[#DCDDCC]" />;
    }
  };

  const getStatusMessage = (submission: UserSubmission) => {
    if (submission.status === 'APPROVED') {
      if (submission.rwaListing?.isLive) {
        return {
          title: 'Submission Approved & Live!',
          message: 'Your submission has been approved and is now live on the marketplace.',
        };
      } else {
        return {
          title: 'Submission Approved!',
          message:
            'Your submission has been approved and a listing has been created. It will be made live soon.',
        };
      }
    } else if (submission.status === 'REJECTED') {
      return {
        title: 'Submission Rejected',
        message:
          submission.rejectionReason ||
          'Your submission has been rejected. Please check the rejection reason below.',
      };
    } else if (submission.status === 'PENDING') {
      if (submission.rwaListing?.isLive) {
        return {
          title: 'Listing Now Live!',
          message: 'Your approved submission is now live on the marketplace.',
        };
      } else {
        return {
          title: 'Submission Under Review',
          message: 'Your submission has been received and is currently being reviewed by our team.',
        };
      }
    }

    return {
      title: 'Status Update',
      message: 'Your submission status has been updated.',
    };
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

  if (!user || loading) {
    return null; // Don't show anything while loading or not authenticated
  }

  if (error) {
    return (
      <Alert className="bg-red-400/10 border-red-400/20 mb-6">
        <AlertTriangle className="h-4 w-4 text-red-400" />
        <AlertDescription className="text-red-400">
          Failed to load submission notifications. {error}
        </AlertDescription>
      </Alert>
    );
  }

  if (fullNotificationsToShow.length === 0 && minimizedIndicatorsToShow.length === 0) {
    return null; // No notifications to show
  }

  return (
    <div className="space-y-4 mb-6">
      {/* Minimized Pending Indicators */}
      {minimizedIndicatorsToShow.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-[#D7BF75] font-jetbrains uppercase tracking-wide">
            Pending Submissions ({minimizedIndicatorsToShow.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {minimizedIndicatorsToShow.map((submission) => (
              <div
                key={submission.id}
                className="bg-[#D7BF75]/10 border border-[#D7BF75]/30 rounded-lg px-3 py-2 flex items-center space-x-2 group hover:bg-[#D7BF75]/20 transition-all"
              >
                <Clock className="w-3 h-3 text-[#D7BF75]" />
                <span 
                  className="text-[#D7BF75] text-sm font-medium truncate max-w-[120px] cursor-pointer"
                  onClick={() => openSubmissionDetails(submission)}
                >
                  {submission.title}
                </span>
                <Badge className="bg-[#D7BF75]/20 text-[#D7BF75] border-none text-xs px-2 py-0">
                  PENDING
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-[#D7BF75] hover:bg-[#D7BF75]/20"
                  onClick={() => restoreMinimizedSubmission(submission.id)}
                  title="Expand submission"
                >
                  <Maximize2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Notifications */}
      {fullNotificationsToShow.length > 0 && (
        <>
          <h3 className="text-lg font-semibold text-[#D0B284] font-libre-caslon">
            Submission Status ({fullNotificationsToShow.length})
          </h3>
        </>
      )}

      {fullNotificationsToShow.map((submission) => {
        const statusInfo = getStatusMessage(submission);
        const isApproved = submission.status === 'APPROVED';
        const isRejected = submission.status === 'REJECTED';
        const images = getSubmissionImages(submission);

        return (
          <div
            key={submission.id}
            className={`${getStatusColor(submission.status)} rounded-xl border-2 overflow-hidden transition-all duration-200 hover:border-opacity-50`}
          >
            {/* Main Card Header */}
            <div className="p-6">
              <div className="flex items-start space-x-4">
                {/* Submission Image */}
                <div className="flex-shrink-0">
                  <Image
                    src={images[0] || '/placeholder.svg'}
                    alt={submission.title}
                    className="w-20 h-20 rounded-xl object-cover border-2 border-[#D0B284]/30 shadow-lg"
                    width={80}
                    height={80}
                    onError={(e) => {
                      // Fallback to original URL if signed URL fails
                      e.currentTarget.src = submission.imageGallery[0] || '/placeholder.svg';
                    }}
                  />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Status Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(submission.status)}
                      <h4 className="font-semibold text-white text-lg font-libre-caslon">
                        {statusInfo.title}
                      </h4>
                    </div>
                    <Badge
                      className={`${getStatusColor(submission.status)} border-none text-xs font-medium px-3 py-1`}
                    >
                      {submission.status}
                    </Badge>
                  </div>

                  {/* Submission Title & Symbol */}
                  <div className="mb-3">
                    <h5 className="text-white font-semibold text-xl">{submission.title}</h5>
                    <p className="text-[#D0B284] font-jetbrains text-lg font-medium">
                      ${submission.symbol}
                    </p>
                  </div>

                  {/* Status Message */}
                  <p className="text-[#DCDDCC] text-sm leading-relaxed mb-4">
                    {statusInfo.message}
                  </p>

                  {/* Quick Info */}
                  <div className="flex items-center space-x-4 text-xs text-[#DCDDCC]">
                    <div className="flex items-center space-x-1">
                      <Calendar className="w-3 h-3" />
                      <span>Submitted: {formatDate(submission.createdAt)}</span>
                    </div>
                    {submission.approvedAt && (
                      <div className="flex items-center space-x-1">
                        <Check className="w-3 h-3 text-[#184D37]" />
                        <span>Approved: {formatDate(submission.approvedAt)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#D0B284]/20">
                <div className="flex items-center space-x-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#D0B284] hover:bg-[#D0B284]/10 font-medium"
                    onClick={() => openSubmissionDetails(submission)}
                    disabled={loadingImages === submission.id}
                  >
                    {loadingImages === submission.id ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Eye className="w-4 h-4 mr-2" />
                    )}
                    View Details
                  </Button>

                  {submission.rwaListing?.isLive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[#184D37] hover:bg-[#184D37]/10 font-medium"
                      onClick={() => {
                        window.open(`/rwa/${submission.rwaListing?.id}`, '_blank');
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Listing
                    </Button>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10 font-medium"
                  onClick={() => acknowledgeSubmission(submission.id, submission.status)}
                >
                  <Check className="w-4 h-4 mr-2" />
                  {submission.status === 'PENDING' ? 'Got it' : 'Acknowledge'}
                </Button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Submission Details Modal */}
      <Dialog
        open={!!selectedSubmissionForDetails}
        onOpenChange={() => setSelectedSubmissionForDetails(null)}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#231F20] border border-[#D0B284]/20">
          {selectedSubmissionForDetails && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#D0B284] text-xl font-libre-caslon">
                  Submission Details: {selectedSubmissionForDetails.title}
                </DialogTitle>
                <Badge
                  className={`${getStatusColor(selectedSubmissionForDetails.status)} border-none w-fit`}
                >
                  {selectedSubmissionForDetails.status}
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
                      {selectedSubmissionForDetails.title}
                    </p>
                  </div>

                  <div>
                    <label className="text-[#D0B284] text-sm font-medium font-jetbrains uppercase tracking-wide">
                      Token Symbol
                    </label>
                    <p className="text-white mt-2 bg-black/30 p-4 rounded-lg border border-[#D0B284]/10 font-mono">
                      ${selectedSubmissionForDetails.symbol}
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
                      {selectedSubmissionForDetails.id}
                    </p>
                  </div>

                  <div>
                    <label className="text-[#D0B284] text-sm font-medium font-jetbrains uppercase tracking-wide">
                      Submission Date
                    </label>
                    <p className="text-white mt-2 bg-black/30 p-4 rounded-lg border border-[#D0B284]/10">
                      {formatDate(selectedSubmissionForDetails.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Image Gallery */}
                <div>
                  <label className="text-[#D0B284] text-sm font-medium font-jetbrains uppercase tracking-wide mb-4 block">
                    Image Gallery ({getSubmissionImages(selectedSubmissionForDetails).length}{' '}
                    images)
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {getSubmissionImages(selectedSubmissionForDetails).map((image, index) => (
                      <div key={index} className="relative group">
                        <Image
                          src={image}
                          alt={`${selectedSubmissionForDetails.title} - Image ${index + 1}`}
                          className="w-full h-32 object-cover rounded-lg border border-[#D0B284]/20 group-hover:border-[#D0B284]/50 transition-all"
                          width={200}
                          height={128}
                          onError={(e) => {
                            // Fallback to original URL if signed URL fails
                            e.currentTarget.src =
                              selectedSubmissionForDetails.imageGallery[index] ||
                              '/placeholder.svg';
                          }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg"></div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Status-Specific Information */}
                {selectedSubmissionForDetails.status === 'REJECTED' &&
                  selectedSubmissionForDetails.rejectionReason && (
                    <div className="bg-red-400/10 border-l-4 border-red-400 p-6 rounded-lg">
                      <h6 className="text-red-300 font-medium font-jetbrains uppercase text-sm mb-3">
                        Rejection Reason
                      </h6>
                      <p className="text-red-300 leading-relaxed">
                        {selectedSubmissionForDetails.rejectionReason}
                      </p>
                    </div>
                  )}

                {selectedSubmissionForDetails.status === 'APPROVED' &&
                  selectedSubmissionForDetails.rwaListing && (
                    <div className="bg-[#184D37]/10 border-l-4 border-[#184D37] p-6 rounded-lg">
                      <h6 className="text-[#184D37] font-medium font-jetbrains uppercase text-sm mb-3">
                        RWA Listing Information
                      </h6>
                      <div className="space-y-3">
                        <p className="text-[#184D37]">
                          <span className="font-medium">Listing ID:</span>{' '}
                          <span className="font-mono">
                            {selectedSubmissionForDetails.rwaListing.id}
                          </span>
                        </p>
                        <p className="text-[#184D37]">
                          <span className="font-medium">Status:</span>{' '}
                          {selectedSubmissionForDetails.rwaListing.isLive ? (
                            <span className="text-[#184D37] font-medium">
                              ✅ Live on Marketplace
                            </span>
                          ) : (
                            <span className="text-[#D7BF75]">⏳ Preparing to go live</span>
                          )}
                        </p>
                        {selectedSubmissionForDetails.approvedAt && (
                          <p className="text-[#184D37]">
                            <span className="font-medium">Approved:</span>{' '}
                            {formatDate(selectedSubmissionForDetails.approvedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                {selectedSubmissionForDetails.status === 'PENDING' && (
                  <div className="bg-[#D7BF75]/10 border-l-4 border-[#D7BF75] p-6 rounded-lg">
                    <h6 className="text-[#D7BF75] font-medium font-jetbrains uppercase text-sm mb-3">
                      Review Status
                    </h6>
                    <p className="text-[#D7BF75] leading-relaxed">
                      Your submission is currently being reviewed by our team. You will be notified
                      once a decision has been made. This process typically takes 2-5 business days.
                    </p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end space-x-4 pt-4 border-t border-[#D0B284]/20">
                  {selectedSubmissionForDetails.rwaListing?.isLive && (
                    <Button
                      className="bg-[#184D37] hover:bg-[#184D37]/80 text-white"
                      onClick={() => {
                        window.open(
                          `/rwa/${selectedSubmissionForDetails.rwaListing?.id}`,
                          '_blank',
                        );
                      }}
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Live Listing
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    onClick={() => setSelectedSubmissionForDetails(null)}
                    className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
