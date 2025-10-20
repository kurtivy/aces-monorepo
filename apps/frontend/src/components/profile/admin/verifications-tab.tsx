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
  FileText,
  Calendar,
  MapPin,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { VerificationsApi, VerificationData } from '@/lib/api/verifications';
import { AdminApi, type VerificationApplication } from '@/lib/api/admin';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function VerificationsTab() {
  const { getAccessToken } = useAuth();
  const [verifications, setVerifications] = useState<VerificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>(
    'PENDING',
  );
  const [selectedVerification, setSelectedVerification] = useState<VerificationData | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [docSignedUrl, setDocSignedUrl] = useState<string | null>(null);
  const [selfieSignedUrl, setSelfieSignedUrl] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageLoadingError, setImageLoadingError] = useState<string | null>(null);
  const [userVerification, setUserVerification] = useState<VerificationApplication | null>(null);
  const [loadingUserVerification, setLoadingUserVerification] = useState(false);
  const [userVerificationError, setUserVerificationError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    const fetchVerifications = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const token = await getAccessToken();
        if (!token) {
          setError('Authentication required');
          return;
        }

        const result =
          statusFilter === 'PENDING'
            ? await VerificationsApi.getPendingVerifications(token)
            : await VerificationsApi.getAllVerifications(token);

        if (result.success) {
          setVerifications(result.data);
        } else {
          setError(result.error || 'Failed to fetch verifications');
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'An error occurred while fetching verifications',
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchVerifications();
  }, [getAccessToken, statusFilter]);

  const filteredVerifications = verifications.filter((verification) => {
    const fullName = `${verification.firstName} ${verification.lastName}`;
    const userName = verification.user?.username || 'Unknown User';
    const userEmail = verification.user?.email || verification.emailAddress || '';

    const matchesSearch =
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || verification.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = async (id: string) => {
    try {
      setIsReviewing(true);
      const token = await getAccessToken();
      if (!token) return;

      const result = await VerificationsApi.reviewVerification(id, 'APPROVED', undefined, token);

      if (result.success) {
        setVerifications((prev) =>
          prev.map((ver) => (ver.id === id ? { ...ver, status: 'APPROVED' as const } : ver)),
        );
        setSelectedVerification(null);
      } else {
        setError(result.error || 'Failed to approve verification');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during approval');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
    try {
      setIsReviewing(true);
      const token = await getAccessToken();
      if (!token) return;

      const result = await VerificationsApi.reviewVerification(id, 'REJECTED', reason, token);

      if (result.success) {
        setVerifications((prev) =>
          prev.map((ver) =>
            ver.id === id ? { ...ver, status: 'REJECTED' as const, rejectionReason: reason } : ver,
          ),
        );
        setSelectedVerification(null);
        setRejectionReason('');
      } else {
        setError(result.error || 'Failed to reject verification');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during rejection');
    } finally {
      setIsReviewing(false);
    }
  };

  // Fetch signed URLs for selected verification images
  const fetchSignedImageUrls = async (verificationId: string) => {
    try {
      setLoadingImages(true);
      setImageLoadingError(null);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }
      const response = await VerificationsApi.getVerificationImages(verificationId, token);
      if (response.success) {
        const images = response.data.images || [];
        const doc = images.find((i) => i.type === 'DOCUMENT');
        const selfie = images.find((i) => i.type === 'SELFIE');
        setDocSignedUrl(doc ? doc.signedUrl : null);
        setSelfieSignedUrl(selfie ? selfie.signedUrl : null);
      } else {
        setImageLoadingError(response.error || 'Failed to load images');
        setDocSignedUrl(null);
        setSelfieSignedUrl(null);
      }
    } catch (err) {
      setImageLoadingError(
        err instanceof Error ? err.message : 'Failed to load images securely. Showing fallback.',
      );
      setDocSignedUrl(null);
      setSelfieSignedUrl(null);
    } finally {
      setLoadingImages(false);
    }
  };

  // Fetch user verification details (for AI metrics)
  const fetchUserVerificationDetails = async (userId: string) => {
    try {
      setLoadingUserVerification(true);
      setUserVerificationError(null);
      const token = await getAccessToken();
      if (!token) throw new Error('Authentication required');
      const res = await AdminApi.getUserVerificationDetails(userId, token);
      setUserVerification(res.data || null);
    } catch (err) {
      setUserVerificationError(
        err instanceof Error ? err.message : 'Failed to load user verification details.',
      );
      setUserVerification(null);
    } finally {
      setLoadingUserVerification(false);
    }
  };

  // When opening a verification, load signed URLs and user verification details
  useEffect(() => {
    if (selectedVerification) {
      setDocSignedUrl(null);
      setSelfieSignedUrl(null);
      setUserVerification(null);
      setImageLoadingError(null);
      setUserVerificationError(null);
      Promise.all([
        fetchSignedImageUrls(selectedVerification.id),
        selectedVerification.user?.id
          ? fetchUserVerificationDetails(selectedVerification.user.id)
          : Promise.resolve(),
      ]).catch(() => {
        /* swallow */
      });
    }
  }, [selectedVerification]);

  // Lightbox helpers
  const openLightbox = (images: string[], startIndex = 0) => {
    const cleaned = images.filter((u): u is string => !!u);
    if (cleaned.length === 0) return;
    setLightboxImages(cleaned);
    setLightboxIndex(Math.max(0, Math.min(startIndex, cleaned.length - 1)));
    setLightboxOpen(true);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    if (lightboxImages.length === 0) return;
    const maxIndex = lightboxImages.length - 1;
    setLightboxIndex((prev) =>
      direction === 'prev' ? (prev > 0 ? prev - 1 : maxIndex) : prev < maxIndex ? prev + 1 : 0,
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'text-[#D7BF75] bg-[#D7BF75]/10';
      case 'APPROVED':
        return 'text-[#184D37] bg-[#184D37]/10';
      case 'REJECTED':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
    }
  };

  const getDocumentTypeLabel = (type: string) => {
    switch (type) {
      case 'DRIVERS_LICENSE':
        return "Driver's License";
      case 'PASSPORT':
        return 'Passport';
      case 'ID_CARD':
        return 'Government ID';
      default:
        return type;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">
            Seller Verifications
          </h2>
        </div>
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
          <div className="p-6">
            <div className="animate-pulse space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-[#D0B284]/10 rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">
            Seller Verifications
          </h2>
        </div>
        <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
          <div className="p-6">
            <div className="text-center py-8">
              <p className="text-red-400 font-jetbrains">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">
          Seller Verifications
        </h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#DCDDCC]" />
            <Input
              placeholder="Search verifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#231F20] border-[#D0B284]/20 text-white w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED')
            }
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            <option value="ALL">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <Button
            onClick={() => setStatusFilter((prev) => prev)}
            variant="ghost"
            size="sm"
            className="text-[#D0B284] hover:bg-[#D0B284]/10"
            disabled={isLoading}
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Verifications Table */}
      <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D0B284]/20">
                <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Applicant
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Document Type
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
              {filteredVerifications.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8">
                    <p className="text-[#DCDDCC] font-jetbrains">No verifications found</p>
                  </td>
                </tr>
              ) : (
                filteredVerifications.map((verification) => (
                  <tr
                    key={verification.id}
                    className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5"
                  >
                    <td className="py-4 px-4">
                      <div>
                        <h3 className="text-white font-medium">
                          {`${verification.firstName} ${verification.lastName}`}
                        </h3>
                        <div className="text-[#DCDDCC] text-sm">
                          {verification.user?.email || verification.emailAddress}
                          {!verification.user && (
                            <span className="text-red-400 ml-2">(Orphaned)</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <FileText className="w-4 h-4 text-[#D0B284]" />
                        <span className="text-white text-sm">
                          {getDocumentTypeLabel(verification.documentType)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <Badge className={`${getStatusColor(verification.status)} border-none`}>
                        {verification.status}
                      </Badge>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <span className="text-[#DCDDCC] text-sm">
                        {formatDate(verification.submittedAt)}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#D0B284] hover:bg-[#D0B284]/10"
                          onClick={() => setSelectedVerification(verification)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Review
                        </Button>
                        {verification.status === 'PENDING' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-[#184D37] hover:bg-[#184D37]/10"
                              onClick={() => handleApprove(verification.id)}
                              disabled={isReviewing}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Approve
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:bg-red-400/10"
                              onClick={() => setSelectedVerification(verification)}
                              disabled={isReviewing}
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

      {/* Verification Detail Modal */}
      <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#231F20] border border-[#D0B284]/20">
          {selectedVerification && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#D0B284] text-xl">
                  Verification Review -{' '}
                  {`${selectedVerification.firstName} ${selectedVerification.lastName}`}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Document Image */}
                {(docSignedUrl || selectedVerification.documentImageUrl) && (
                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase mb-2 block">
                      Document Image
                    </label>
                    {imageLoadingError && (
                      <Alert className="bg-[#D7BF75]/10 border-[#D7BF75]/20 mb-2">
                        <AlertTriangle className="h-4 w-4 text-[#D7BF75]" />
                        <AlertDescription className="text-[#D7BF75] text-sm">
                          {imageLoadingError}
                        </AlertDescription>
                      </Alert>
                    )}
                    {loadingImages && (
                      <div className="mb-2 text-[#DCDDCC] text-sm flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading secure images...
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        openLightbox(
                          [
                            (docSignedUrl || selectedVerification.documentImageUrl) as string,
                            (selfieSignedUrl as string) || '',
                          ],
                          0,
                        )
                      }
                      className="block focus:outline-none"
                      aria-label="Open document image in lightbox"
                    >
                      <Image
                        src={
                          docSignedUrl ||
                          selectedVerification.documentImageUrl ||
                          '/placeholder.svg'
                        }
                        alt="Document"
                        className="w-full h-64 object-cover rounded-lg border border-[#D0B284]/20"
                        width={400}
                        height={300}
                      />
                    </button>
                  </div>
                )}

                {/* Selfie Image */}
                {selfieSignedUrl && (
                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase mb-2 block">
                      Selfie Image
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        openLightbox(
                          [
                            (docSignedUrl || selectedVerification.documentImageUrl) as string,
                            selfieSignedUrl as string,
                          ],
                          1,
                        )
                      }
                      className="block focus:outline-none"
                      aria-label="Open selfie image in lightbox"
                    >
                      <Image
                        src={selfieSignedUrl}
                        alt="Selfie"
                        className="w-full h-64 object-cover rounded-lg border border-[#D0B284]/20"
                        width={400}
                        height={300}
                      />
                    </button>
                  </div>
                )}

                {/* Personal Information */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                      Full Name
                    </label>
                    <p className="text-white mt-1">
                      {`${selectedVerification.firstName} ${selectedVerification.lastName}`}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                        Document Type
                      </label>
                      <p className="text-white mt-1">
                        {getDocumentTypeLabel(selectedVerification.documentType)}
                      </p>
                    </div>
                    <div>
                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                        Document Number
                      </label>
                      <p className="text-white mt-1 font-mono">
                        {selectedVerification.documentNumber}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4 text-[#D0B284]" />
                    <div>
                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                        Date of Birth
                      </label>
                      <p className="text-white">{selectedVerification.dateOfBirth}</p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                      Country of Issue
                    </label>
                    <p className="text-white mt-1">{selectedVerification.countryOfIssue}</p>
                  </div>

                  {selectedVerification.state && (
                    <div>
                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                        State/Province
                      </label>
                      <p className="text-white mt-1">{selectedVerification.state}</p>
                    </div>
                  )}

                  <div className="flex items-start space-x-2">
                    <MapPin className="w-4 h-4 text-[#D0B284] mt-1" />
                    <div>
                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                        Address
                      </label>
                      <p className="text-white">{selectedVerification.address}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Verification Details */}
              <div className="mt-6 space-y-4">
                {loadingUserVerification && (
                  <div className="text-[#DCDDCC] text-sm flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading verification details...
                  </div>
                )}
                {userVerificationError && (
                  <Alert className="bg-red-400/10 border-red-400/20">
                    <AlertTriangle className="h-4 w-4 text-red-400" />
                    <AlertDescription className="text-red-400">
                      {userVerificationError}
                    </AlertDescription>
                  </Alert>
                )}
                {userVerification && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {userVerification.faceComparisonScore !== undefined && (
                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Face Match
                        </label>
                        <p className="text-white mt-1">{userVerification.faceComparisonScore}%</p>
                      </div>
                    )}
                    {userVerification.overallVerificationScore !== undefined && (
                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          Overall Score
                        </label>
                        <p className="text-white mt-1">
                          {userVerification.overallVerificationScore}%
                        </p>
                      </div>
                    )}
                    {userVerification.visionApiRecommendation && (
                      <div>
                        <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                          AI Recommendation
                        </label>
                        <p className="text-white mt-1">
                          {userVerification.visionApiRecommendation}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              {selectedVerification.status === 'PENDING' && (
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                      Rejection Reason (Optional)
                    </label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Provide a reason for rejection..."
                      className="mt-2 bg-black/50 border-[#D0B284]/20 text-white"
                    />
                  </div>

                  <div className="flex justify-end space-x-4">
                    <Button
                      variant="ghost"
                      className="text-red-400 hover:bg-red-400/10"
                      onClick={() => handleReject(selectedVerification.id, rejectionReason)}
                      disabled={isReviewing}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject Verification
                    </Button>
                    <Button
                      className="bg-[#184D37] hover:bg-[#184D37]/80 text-white"
                      onClick={() => handleApprove(selectedVerification.id)}
                      disabled={isReviewing}
                    >
                      <Check className="w-4 h-4 mr-2" />
                      Approve Verification
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Lightbox Modal */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-5xl bg-black border border-[#D0B284]/20">
          <div className="relative">
            {lightboxImages.length > 0 && (
              <Image
                src={lightboxImages[lightboxIndex]}
                alt={`Preview ${lightboxIndex + 1}`}
                width={1600}
                height={900}
                className="w-full h-auto max-h-[80vh] object-contain"
              />
            )}
            {lightboxImages.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => navigateLightbox('prev')}
                >
                  ‹
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white"
                  onClick={() => navigateLightbox('next')}
                >
                  ›
                </Button>
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-sm px-2 py-1 rounded">
                  {lightboxIndex + 1} / {lightboxImages.length}
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
