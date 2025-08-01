'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Check,
  X,
  Search,
  Eye,
  Mail,
  Wallet,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/auth/auth-context';
import { AdminApi, type VerificationApplication } from '@/lib/api/admin';
import type { RwaSubmissionWithRelations } from '@aces/utils';
import Image from 'next/image';

type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'LIVE';

export function SubmissionsTab() {
  const { getAccessToken, isAdmin } = useAuth();

  const [submissions, setSubmissions] = useState<RwaSubmissionWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [selectedSubmission, setSelectedSubmission] = useState<RwaSubmissionWithRelations | null>(
    null,
  );
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState<{
    type: 'approve' | 'reject';
    submission: RwaSubmissionWithRelations;
  } | null>(null);
  const [actionResult, setActionResult] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [signedImageUrls, setSignedImageUrls] = useState<string[]>([]);
  const [imageLoadingError, setImageLoadingError] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [userVerification, setUserVerification] = useState<VerificationApplication | null>(null);
  const [loadingUserVerification, setLoadingUserVerification] = useState(false);
  const [userVerificationError, setUserVerificationError] = useState<string | null>(null);

  // Fetch submissions from the backend
  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const status = statusFilter === 'ALL' ? undefined : statusFilter;
      const response = await AdminApi.getSubmissions(status, { limit: 50 }, token);

      setSubmissions(response.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch submissions');
    } finally {
      setLoading(false);
    }
  };

  // Load submissions on component mount and when status filter changes
  useEffect(() => {
    if (isAdmin) {
      fetchSubmissions();
    }
  }, [statusFilter, isAdmin]);

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesSearch =
      submission.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (submission.owner.email || submission.owner.walletAddress || '')
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleApprove = async (submission: RwaSubmissionWithRelations) => {
    setShowConfirmDialog({ type: 'approve', submission });
  };

  const handleReject = async (submission: RwaSubmissionWithRelations) => {
    setShowConfirmDialog({ type: 'reject', submission });
  };

  const confirmApprove = async (id: string) => {
    try {
      setActionLoading(id);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const result = await AdminApi.approveSubmission(id, token);

      // Update local state
      setSubmissions((prev) =>
        prev.map((sub) => (sub.id === id ? { ...sub, status: 'APPROVED' as const } : sub)),
      );

      setActionResult({
        type: 'success',
        message: `Submission approved successfully! ${result.message || 'RWA Listing has been created automatically.'}`,
      });
      setSelectedSubmission(null);
      setShowConfirmDialog(null);
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to approve submission',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const confirmReject = async (id: string, reason?: string) => {
    try {
      setActionLoading(id);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      await AdminApi.rejectSubmission(id, reason || 'No reason provided', token);

      // Update local state
      setSubmissions((prev) =>
        prev.map((sub) =>
          sub.id === id
            ? { ...sub, status: 'REJECTED' as const, rejectionReason: reason || null }
            : sub,
        ),
      );

      setActionResult({
        type: 'success',
        message: 'Submission rejected successfully.',
      });
      setSelectedSubmission(null);
      setShowConfirmDialog(null);
      setRejectionReason('');
    } catch (err) {
      setActionResult({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to reject submission',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'text-[#D7BF75] bg-[#D7BF75]/10';
      case 'APPROVED':
        return 'text-[#184D37] bg-[#184D37]/10';
      case 'REJECTED':
        return 'text-red-400 bg-red-400/10';
      case 'LIVE':
        return 'text-blue-400 bg-blue-400/10';
      default:
        return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
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

  // Helper function to get the first image from imageGallery array
  const getFirstImage = (submission: RwaSubmissionWithRelations) => {
    if (submission.imageGallery && submission.imageGallery.length > 0) {
      return submission.imageGallery[0];
    }
    return '/placeholder.svg';
  };

  // Helper function to get all images from imageGallery array
  const getAllImages = (submission: RwaSubmissionWithRelations) => {
    // Use signed URLs if available, otherwise fall back to original URLs
    if (signedImageUrls.length > 0) {
      return signedImageUrls;
    }
    if (submission.imageGallery && submission.imageGallery.length > 0) {
      return submission.imageGallery;
    }
    return ['/placeholder.svg'];
  };

  // Fetch signed URLs for submission images
  const fetchSignedImageUrls = async (submissionId: string) => {
    try {
      setLoadingImages(true);
      setImageLoadingError(null);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await AdminApi.getSubmissionImages(submissionId, token);
      const urls = response.data.images.map((img) => img.signedUrl);
      setSignedImageUrls(urls);
    } catch (err) {
      console.error('Failed to fetch signed image URLs:', err);
      setImageLoadingError('Failed to load images securely. Showing original URLs as fallback.');
      // Don't set signed URLs, component will fall back to original URLs
    } finally {
      setLoadingImages(false);
    }
  };

  // Fetch user verification details
  const fetchUserVerificationDetails = async (userId: string) => {
    try {
      setLoadingUserVerification(true);
      setUserVerificationError(null);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      const response = await AdminApi.getUserVerificationDetails(userId, token);
      setUserVerification(response.data);
    } catch (err) {
      console.error('Failed to fetch user verification details:', err);
      setUserVerificationError('Failed to load user verification details.');
      setUserVerification(null);
    } finally {
      setLoadingUserVerification(false);
    }
  };

  // Open submission for review and reset gallery index
  const openSubmissionForReview = async (submission: RwaSubmissionWithRelations) => {
    setSelectedSubmission(submission);
    setCurrentImageIndex(0);
    setRejectionReason('');
    setActionResult(null);
    setSignedImageUrls([]); // Reset signed URLs
    setUserVerification(null); // Reset user verification
    setUserVerificationError(null);

    // Fetch signed URLs for this submission and user verification details
    await Promise.all([
      fetchSignedImageUrls(submission.id),
      fetchUserVerificationDetails(submission.owner.id),
    ]);
  };

  // Navigate gallery images
  const navigateGallery = (direction: 'prev' | 'next') => {
    if (!selectedSubmission) return;
    const images = getAllImages(selectedSubmission);
    const maxIndex = images.length - 1;

    if (direction === 'prev') {
      setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : maxIndex));
    } else {
      setCurrentImageIndex((prev) => (prev < maxIndex ? prev + 1 : 0));
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400">Access denied. Admin privileges required.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">Token Submissions</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#DCDDCC]" />
            <Input
              placeholder="Search submissions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#231F20] border-[#D0B284]/20 text-white w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="LIVE">Live</option>
          </select>
          <Button
            onClick={fetchSubmissions}
            variant="ghost"
            size="sm"
            className="text-[#D0B284] hover:bg-[#D0B284]/10"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-400/10 border border-red-400/20 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
          <Button
            onClick={() => setError(null)}
            variant="ghost"
            size="sm"
            className="mt-2 text-red-400 hover:bg-red-400/10"
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Action Result Display */}
      {actionResult && (
        <Alert
          className={`${
            actionResult.type === 'success'
              ? 'bg-[#184D37]/10 border-[#184D37]/20'
              : 'bg-red-400/10 border-red-400/20'
          }`}
        >
          <AlertTriangle
            className={`h-4 w-4 ${
              actionResult.type === 'success' ? 'text-[#184D37]' : 'text-red-400'
            }`}
          />
          <AlertDescription
            className={actionResult.type === 'success' ? 'text-[#184D37]' : 'text-red-400'}
          >
            {actionResult.message}
          </AlertDescription>
          <Button
            onClick={() => setActionResult(null)}
            variant="ghost"
            size="sm"
            className={`mt-2 ${
              actionResult.type === 'success'
                ? 'text-[#184D37] hover:bg-[#184D37]/10'
                : 'text-red-400 hover:bg-red-400/10'
            }`}
          >
            Dismiss
          </Button>
        </Alert>
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D0B284]" />
          <p className="text-[#DCDDCC] mt-2">Loading submissions...</p>
        </div>
      )}

      {/* Submissions Table */}
      {!loading && (
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#D0B284]/20">
                  <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                    Asset
                  </th>
                  <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                    Submitter
                  </th>
                  <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                    Status
                  </th>
                  <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                    Submitted
                  </th>
                  <th className="text-right text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-[#DCDDCC]">
                      No submissions found
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((submission) => (
                    <tr
                      key={submission.id}
                      className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5"
                    >
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-3">
                          <Image
                            src={getFirstImage(submission)}
                            alt={submission.title || 'Asset'}
                            className="w-12 h-12 rounded-lg object-cover border border-[#D0B284]/20"
                            width={48}
                            height={48}
                          />
                          <div>
                            <h3 className="text-white font-medium">{submission.title}</h3>
                            <span className="text-[#DCDDCC] font-jetbrains text-sm">
                              ${submission.symbol}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <div>
                          <div className="text-white font-medium">
                            {submission.owner.email || 'Anonymous User'}
                          </div>
                          <div className="text-[#DCDDCC] text-sm">
                            {submission.email || submission.owner.walletAddress}
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <Badge className={`${getStatusColor(submission.status)} border-none`}>
                          {submission.status}
                        </Badge>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span className="text-[#DCDDCC] text-sm">
                          {formatDate(submission.createdAt.toString())}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#D0B284] hover:bg-[#D0B284]/10"
                            onClick={() => openSubmissionForReview(submission)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Review
                          </Button>
                          {submission.status === 'PENDING' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#184D37] hover:bg-[#184D37]/10"
                                onClick={() => handleApprove(submission)}
                                disabled={actionLoading === submission.id}
                              >
                                {actionLoading === submission.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : (
                                  <Check className="w-4 h-4 mr-1" />
                                )}
                                Approve
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-400 hover:bg-red-400/10"
                                onClick={() => handleReject(submission)}
                              >
                                <X className="w-4 h-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Enhanced Submission Review Modal */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto bg-[#231F20] border border-[#D0B284]/20">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#D0B284] text-xl font-libre-caslon">
                  Reviewing: {selectedSubmission.title} (${selectedSubmission.symbol})
                </DialogTitle>
                <Badge className={`${getStatusColor(selectedSubmission.status)} border-none w-fit`}>
                  {selectedSubmission.status}
                </Badge>
              </DialogHeader>

              <Tabs defaultValue="submission" className="w-full mt-6">
                <TabsList className="bg-transparent border-none p-0 h-auto space-x-6 mb-6">
                  <TabsTrigger
                    value="submission"
                    className="bg-transparent text-[#DCDDCC] text-base font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                  >
                    Submission Details
                  </TabsTrigger>
                  <TabsTrigger
                    value="user"
                    className="bg-transparent text-[#DCDDCC] text-base font-medium data-[state=active]:text-white data-[state=active]:bg-transparent data-[state=active]:shadow-none relative pb-2 px-0 hover:text-white transition-colors duration-200 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-[#D0B284]"
                  >
                    User Details
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="submission" className="mt-0">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-6">
                    {/* Enhanced Image Gallery */}
                    <div className="space-y-4">
                      {/* Image Loading Error Warning */}
                      {imageLoadingError && (
                        <Alert className="bg-[#D7BF75]/10 border-[#D7BF75]/20">
                          <AlertTriangle className="h-4 w-4 text-[#D7BF75]" />
                          <AlertDescription className="text-[#D7BF75] text-sm">
                            {imageLoadingError}
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="relative">
                        {/* Loading indicator for images */}
                        {loadingImages && (
                          <div className="absolute inset-0 bg-black/20 rounded-lg flex items-center justify-center z-10">
                            <div className="bg-black/70 text-white px-3 py-2 rounded flex items-center space-x-2">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="text-sm">Loading secure images...</span>
                            </div>
                          </div>
                        )}

                        <Image
                          src={getAllImages(selectedSubmission)[currentImageIndex]}
                          alt={`${selectedSubmission.title} - Image ${currentImageIndex + 1}`}
                          className="w-full h-80 object-cover rounded-lg border border-[#D0B284]/20"
                          width={500}
                          height={320}
                          onError={() => {
                            if (!imageLoadingError) {
                              setImageLoadingError(
                                'Failed to load this image. It may have been moved or deleted.',
                              );
                            }
                          }}
                        />

                        {/* Gallery Navigation */}
                        {getAllImages(selectedSubmission).length > 1 && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                              onClick={() => navigateGallery('prev')}
                            >
                              <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                              onClick={() => navigateGallery('next')}
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Button>

                            {/* Image Counter */}
                            <div className="absolute bottom-2 right-2 bg-black/70 text-white text-sm px-2 py-1 rounded">
                              {currentImageIndex + 1} of {getAllImages(selectedSubmission).length}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Image Thumbnails */}
                      {getAllImages(selectedSubmission).length > 1 && (
                        <div className="flex space-x-2 overflow-x-auto pb-2">
                          {getAllImages(selectedSubmission).map((image, index) => (
                            <button
                              key={index}
                              onClick={() => setCurrentImageIndex(index)}
                              className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden ${
                                index === currentImageIndex
                                  ? 'border-[#D0B284]'
                                  : 'border-[#D0B284]/20 hover:border-[#D0B284]/50'
                              }`}
                            >
                              <Image
                                src={image}
                                alt={`Thumbnail ${index + 1}`}
                                className="w-full h-full object-cover"
                                width={64}
                                height={64}
                                onError={(e) => {
                                  // Hide failed thumbnails by making them transparent
                                  e.currentTarget.style.opacity = '0.3';
                                }}
                              />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Submission Details */}
                    <div className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                            Symbol
                          </label>
                          <p className="text-white mt-1 font-medium font-jetbrains">
                            ${selectedSubmission.symbol}
                          </p>
                        </div>
                        <div>
                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                            Submitted
                          </label>
                          <p className="text-white mt-1">
                            {formatDate(selectedSubmission.createdAt.toString())}
                          </p>
                        </div>
                      </div>

                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Description
                        </label>
                        <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10">
                          {selectedSubmission.description}
                        </p>
                      </div>

                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Proof of Ownership
                        </label>
                        <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10">
                          {selectedSubmission.proofOfOwnership}
                        </p>
                      </div>

                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Type of Ownership
                        </label>
                        <p className="text-white mt-1 bg-black/30 p-3 rounded border border-[#D0B284]/10">
                          {selectedSubmission.typeOfOwnership}
                        </p>
                      </div>

                      {/* Contact Information */}
                      <div className="space-y-3">
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Contact Information
                        </label>
                        <div className="bg-black/30 p-3 rounded border border-[#D0B284]/10 space-y-2">
                          {selectedSubmission.email && (
                            <div className="flex items-center space-x-2">
                              <Mail className="w-4 h-4 text-[#D0B284]" />
                              <span className="text-white">{selectedSubmission.email}</span>
                            </div>
                          )}

                          {selectedSubmission.owner.walletAddress && (
                            <div className="flex items-center space-x-2">
                              <Wallet className="w-4 h-4 text-[#D0B284]" />
                              <span className="text-white font-mono text-sm break-all">
                                {selectedSubmission.owner.walletAddress}
                              </span>
                            </div>
                          )}

                          {selectedSubmission.location && (
                            <div className="flex items-center space-x-2">
                              <span className="text-[#D0B284]">📍</span>
                              <span className="text-white">{selectedSubmission.location}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedSubmission.rejectionReason && (
                        <div>
                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                            Previous Rejection Reason
                          </label>
                          <p className="text-red-400 mt-1 bg-red-400/10 p-3 rounded border border-red-400/20">
                            {selectedSubmission.rejectionReason}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Review Actions */}
                  {selectedSubmission.status === 'PENDING' && (
                    <div className="mt-8 space-y-4 border-t border-[#D0B284]/20 pt-6">
                      <h3 className="text-lg font-medium text-[#D0B284]">Review Decision</h3>

                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Rejection Reason (Required if rejecting)
                        </label>
                        <Textarea
                          value={rejectionReason}
                          onChange={(e) => setRejectionReason(e.target.value)}
                          placeholder="Provide a detailed reason for rejection..."
                          className="mt-2 bg-black/50 border-[#D0B284]/20 text-white min-h-[100px]"
                        />
                      </div>

                      <div className="flex justify-end space-x-4">
                        <Button
                          variant="ghost"
                          className="text-red-400 hover:bg-red-400/10"
                          onClick={() => handleReject(selectedSubmission)}
                          disabled={actionLoading === selectedSubmission.id}
                        >
                          <X className="w-4 h-4 mr-2" />
                          Reject Submission
                        </Button>
                        <Button
                          className="bg-[#184D37] hover:bg-[#184D37]/80 text-white"
                          onClick={() => handleApprove(selectedSubmission)}
                          disabled={actionLoading === selectedSubmission.id}
                        >
                          <Check className="w-4 h-4 mr-2" />
                          Approve & Create Listing
                        </Button>
                      </div>

                      <Alert className="bg-[#D7BF75]/10 border-[#D7BF75]/20">
                        <AlertTriangle className="h-4 w-4 text-[#D7BF75]" />
                        <AlertDescription className="text-[#D7BF75]">
                          <strong>Note:</strong> Approving this submission will automatically create
                          a RWA Listing that can be made live on the marketplace.
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="user" className="mt-0">
                  <div className="space-y-6">
                    {/* User Verification Loading State */}
                    {loadingUserVerification && (
                      <div className="text-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D0B284]" />
                        <p className="text-[#DCDDCC] mt-2">Loading user verification details...</p>
                      </div>
                    )}

                    {/* User Verification Error */}
                    {userVerificationError && (
                      <Alert className="bg-red-400/10 border-red-400/20">
                        <AlertTriangle className="h-4 w-4 text-red-400" />
                        <AlertDescription className="text-red-400">
                          {userVerificationError}
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* User Verification Details */}
                    {!loadingUserVerification && !userVerificationError && (
                      <>
                        {userVerification ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Personal Information */}
                            <div className="space-y-6">
                              <div>
                                <h3 className="text-lg font-medium text-[#D0B284] mb-4">
                                  Personal Information
                                </h3>
                                <div className="space-y-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                        First Name
                                      </label>
                                      <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                        {userVerification.firstName || 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                        Last Name
                                      </label>
                                      <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                        {userVerification.lastName || 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                      Date of Birth
                                    </label>
                                    <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                      {userVerification.dateOfBirth
                                        ? new Date(
                                            userVerification.dateOfBirth,
                                          ).toLocaleDateString()
                                        : 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                      Email Address
                                    </label>
                                    <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                      {userVerification.emailAddress || 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                      Address
                                    </label>
                                    <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                      {userVerification.address || 'N/A'}
                                    </p>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                        Country
                                      </label>
                                      <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                        {userVerification.countryOfIssue || 'N/A'}
                                      </p>
                                    </div>
                                    <div>
                                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                        State
                                      </label>
                                      <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                        {userVerification.state || 'N/A'}
                                      </p>
                                    </div>
                                  </div>
                                  {(userVerification.twitter || userVerification.website) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {userVerification.twitter && (
                                        <div>
                                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                            Twitter
                                          </label>
                                          <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                            {userVerification.twitter}
                                          </p>
                                        </div>
                                      )}
                                      {userVerification.website && (
                                        <div>
                                          <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                            Website
                                          </label>
                                          <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                            {userVerification.website}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Verification & Document Information */}
                            <div className="space-y-6">
                              <div>
                                <h3 className="text-lg font-medium text-[#D0B284] mb-4">
                                  Verification Status
                                </h3>
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                      Status
                                    </label>
                                    <div className="mt-1">
                                      <Badge
                                        className={`${getStatusColor(userVerification.status)} border-none`}
                                      >
                                        {userVerification.status}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                      Submitted
                                    </label>
                                    <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                      {formatDate(userVerification.submittedAt)}
                                    </p>
                                  </div>
                                  {userVerification.reviewedAt && (
                                    <div>
                                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                        Reviewed
                                      </label>
                                      <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                        {formatDate(userVerification.reviewedAt)}
                                      </p>
                                    </div>
                                  )}
                                  <div>
                                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                      Attempts
                                    </label>
                                    <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                      {userVerification.attempts} / 3
                                    </p>
                                  </div>
                                  {userVerification.rejectionReason && (
                                    <div>
                                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                        Rejection Reason
                                      </label>
                                      <p className="text-red-400 mt-1 bg-red-400/10 p-2 rounded border border-red-400/20">
                                        {userVerification.rejectionReason}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div>
                                <h3 className="text-lg font-medium text-[#D0B284] mb-4">
                                  Document Information
                                </h3>
                                <div className="space-y-4">
                                  <div>
                                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                      Document Type
                                    </label>
                                    <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                      {userVerification.documentType?.replace('_', ' ') || 'N/A'}
                                    </p>
                                  </div>
                                  <div>
                                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                      Document Number
                                    </label>
                                    <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10 font-mono">
                                      {userVerification.documentNumber || 'N/A'}
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Facial Verification */}
                              {(userVerification.facialVerificationStatus ||
                                userVerification.faceComparisonScore !== undefined) && (
                                <div>
                                  <h3 className="text-lg font-medium text-[#D0B284] mb-4">
                                    Facial Verification
                                  </h3>
                                  <div className="space-y-4">
                                    {userVerification.facialVerificationStatus && (
                                      <div>
                                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                          Facial Verification Status
                                        </label>
                                        <div className="mt-1">
                                          <Badge
                                            className={`${getStatusColor(userVerification.facialVerificationStatus)} border-none`}
                                          >
                                            {userVerification.facialVerificationStatus}
                                          </Badge>
                                        </div>
                                      </div>
                                    )}
                                    {userVerification.faceComparisonScore !== undefined && (
                                      <div>
                                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                          Face Comparison Score
                                        </label>
                                        <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                          {userVerification.faceComparisonScore}% match
                                        </p>
                                      </div>
                                    )}
                                    {userVerification.overallVerificationScore !== undefined && (
                                      <div>
                                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                          Overall Score
                                        </label>
                                        <p className="text-white mt-1 bg-black/30 p-2 rounded border border-[#D0B284]/10">
                                          {userVerification.overallVerificationScore}%
                                        </p>
                                      </div>
                                    )}
                                    {userVerification.visionApiRecommendation && (
                                      <div>
                                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                                          AI Recommendation
                                        </label>
                                        <div className="mt-1">
                                          <Badge
                                            className={`${
                                              userVerification.visionApiRecommendation === 'APPROVE'
                                                ? 'text-[#184D37] bg-[#184D37]/10'
                                                : userVerification.visionApiRecommendation ===
                                                    'REJECT'
                                                  ? 'text-red-400 bg-red-400/10'
                                                  : 'text-[#D7BF75] bg-[#D7BF75]/10'
                                            } border-none`}
                                          >
                                            {userVerification.visionApiRecommendation}
                                          </Badge>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <p className="text-[#DCDDCC]">
                              No verification information found for this user.
                            </p>
                            <p className="text-[#DCDDCC]/60 text-sm mt-2">
                              The user may not have submitted account verification yet.
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialogs */}
      <Dialog open={!!showConfirmDialog} onOpenChange={() => setShowConfirmDialog(null)}>
        <DialogContent className="max-w-md bg-[#231F20] border border-[#D0B284]/20">
          {showConfirmDialog && (
            <>
              <DialogHeader>
                <DialogTitle
                  className={`text-xl font-libre-caslon ${
                    showConfirmDialog.type === 'approve' ? 'text-[#184D37]' : 'text-red-400'
                  }`}
                >
                  {showConfirmDialog.type === 'approve'
                    ? 'Approve Submission'
                    : 'Reject Submission'}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                <p className="text-[#DCDDCC]">
                  Are you sure you want to{' '}
                  <span
                    className={`font-medium ${
                      showConfirmDialog.type === 'approve' ? 'text-[#184D37]' : 'text-red-400'
                    }`}
                  >
                    {showConfirmDialog.type}
                  </span>{' '}
                  this submission?
                </p>

                <div className="bg-black/30 p-3 rounded border border-[#D0B284]/10">
                  <p className="text-white font-medium">
                    {showConfirmDialog.submission.title} (${showConfirmDialog.submission.symbol})
                  </p>
                  <p className="text-[#DCDDCC] text-sm mt-1">
                    {showConfirmDialog.submission.description?.substring(0, 100)}
                    {showConfirmDialog.submission.description &&
                    showConfirmDialog.submission.description.length > 100
                      ? '...'
                      : ''}
                  </p>
                </div>

                {showConfirmDialog.type === 'approve' && (
                  <Alert className="bg-[#184D37]/10 border-[#184D37]/20">
                    <Check className="h-4 w-4 text-[#184D37]" />
                    <AlertDescription className="text-[#184D37]">
                      This will automatically create a RWA Listing for the marketplace.
                    </AlertDescription>
                  </Alert>
                )}

                {showConfirmDialog.type === 'reject' && rejectionReason.trim() === '' && (
                  <Alert className="bg-red-400/10 border-red-400/20">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-red-400">
                      Please provide a rejection reason in the review modal before rejecting.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => setShowConfirmDialog(null)}
                    className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    className={`${
                      showConfirmDialog.type === 'approve'
                        ? 'bg-[#184D37] hover:bg-[#184D37]/80 text-white'
                        : 'bg-red-400 hover:bg-red-400/80 text-white'
                    }`}
                    onClick={() => {
                      if (showConfirmDialog.type === 'approve') {
                        confirmApprove(showConfirmDialog.submission.id);
                      } else {
                        if (rejectionReason.trim() === '') {
                          setActionResult({
                            type: 'error',
                            message:
                              'Please provide a rejection reason before rejecting the submission.',
                          });
                          setShowConfirmDialog(null);
                          return;
                        }
                        confirmReject(showConfirmDialog.submission.id, rejectionReason);
                      }
                    }}
                    disabled={
                      actionLoading === showConfirmDialog.submission.id ||
                      (showConfirmDialog.type === 'reject' && rejectionReason.trim() === '')
                    }
                  >
                    {actionLoading === showConfirmDialog.submission.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : showConfirmDialog.type === 'approve' ? (
                      <Check className="w-4 h-4 mr-2" />
                    ) : (
                      <X className="w-4 h-4 mr-2" />
                    )}
                    {showConfirmDialog.type === 'approve'
                      ? 'Approve & Create Listing'
                      : 'Reject Submission'}
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
