'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Search, Eye, Mail, Wallet, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAuth } from '@/lib/auth/auth-context';
import { AdminApi } from '@/lib/api/admin';
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

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(id);
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Authentication required');
      }

      await AdminApi.approveSubmission(id, token);

      // Update local state
      setSubmissions((prev) =>
        prev.map((sub) => (sub.id === id ? { ...sub, status: 'APPROVED' as const } : sub)),
      );
      setSelectedSubmission(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve submission');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string, reason?: string) => {
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
      setSelectedSubmission(null);
      setRejectionReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject submission');
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
                            onClick={() => setSelectedSubmission(submission)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                          {submission.status === 'PENDING' && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-[#184D37] hover:bg-[#184D37]/10"
                                onClick={() => handleApprove(submission.id)}
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
                                onClick={() => setSelectedSubmission(submission)}
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

      {/* Submission Detail Modal */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#231F20] border border-[#D0B284]/20">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#D0B284] text-xl">
                  {selectedSubmission.title} (${selectedSubmission.symbol})
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Image */}
                <div>
                  <Image
                    src={getFirstImage(selectedSubmission)}
                    alt={selectedSubmission.title || 'Asset'}
                    className="w-full h-64 object-cover rounded-lg border border-[#D0B284]/20"
                    width={400}
                    height={300}
                  />
                </div>

                {/* Details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                      Description
                    </label>
                    <p className="text-white mt-1">{selectedSubmission.description}</p>
                  </div>

                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                      Proof of Ownership
                    </label>
                    <p className="text-white mt-1">{selectedSubmission.proofOfOwnership}</p>
                  </div>

                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                      Type of Ownership
                    </label>
                    <p className="text-white mt-1">{selectedSubmission.typeOfOwnership}</p>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {selectedSubmission.email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="w-4 h-4 text-[#D0B284]" />
                        <span className="text-white">{selectedSubmission.email}</span>
                      </div>
                    )}

                    {selectedSubmission.owner.walletAddress && (
                      <div className="flex items-center space-x-2">
                        <Wallet className="w-4 h-4 text-[#D0B284]" />
                        <span className="text-white font-mono text-sm">
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

                  {selectedSubmission.rejectionReason && (
                    <div>
                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                        Rejection Reason
                      </label>
                      <p className="text-red-400 mt-1">{selectedSubmission.rejectionReason}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              {selectedSubmission.status === 'PENDING' && (
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
                      onClick={() => handleReject(selectedSubmission.id, rejectionReason)}
                      disabled={actionLoading === selectedSubmission.id}
                    >
                      {actionLoading === selectedSubmission.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <X className="w-4 h-4 mr-2" />
                      )}
                      Reject Submission
                    </Button>
                    <Button
                      className="bg-[#184D37] hover:bg-[#184D37]/80 text-white"
                      onClick={() => handleApprove(selectedSubmission.id)}
                      disabled={actionLoading === selectedSubmission.id}
                    >
                      {actionLoading === selectedSubmission.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <Check className="w-4 h-4 mr-2" />
                      )}
                      Approve Submission
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
