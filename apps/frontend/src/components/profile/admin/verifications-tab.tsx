'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Search, Eye, FileText, Calendar, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/auth-context';
import { VerificationsApi, VerificationData } from '@/lib/api/verifications';

export function VerificationsTab() {
  const { getAccessToken } = useAuth();
  const [verifications, setVerifications] = useState<VerificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>(
    'ALL',
  );
  const [selectedVerification, setSelectedVerification] = useState<VerificationData | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);

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

        const result = await VerificationsApi.getAllVerifications(token);

        if (result.success) {
          console.log('Verifications API response:', result.data);
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
  }, [getAccessToken]);

  const filteredVerifications = verifications.filter((verification) => {
    const fullName = `${verification.firstName} ${verification.lastName}`;
    const userName = verification.user?.displayName || 'Unknown User';
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

      const result = await VerificationsApi.reviewVerification(id, true, undefined, token);

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

      const result = await VerificationsApi.reviewVerification(id, false, reason, token);

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
                {selectedVerification.documentImageUrl && (
                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase mb-2 block">
                      Document Image
                    </label>
                    <Image
                      src={selectedVerification.documentImageUrl || '/placeholder.svg'}
                      alt="Document"
                      className="w-full h-64 object-cover rounded-lg border border-[#D0B284]/20"
                      width={400}
                      height={300}
                    />
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
    </div>
  );
}
