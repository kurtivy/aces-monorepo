'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Search, Eye, Mail, Twitter, Wallet } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';

interface SubmissionData {
  id: string;
  name: string;
  symbol: string;
  description: string;
  email: string;
  proofOfOwnership: string;
  destinationWallet?: string;
  twitterLink?: string;
  imageUrl: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  submitterName: string;
  rejectionReason?: string;
}

const SAMPLE_SUBMISSIONS: SubmissionData[] = [
  {
    id: '1',
    name: '2023 Ferrari SF90 Stradale',
    symbol: 'SF90',
    description:
      'Limited edition Ferrari SF90 Stradale with only 1,200 miles. Pristine condition with all original documentation.',
    email: 'collector@example.com',
    proofOfOwnership: 'VIN: ZFF9NFA2XP0123456',
    destinationWallet: '0x742d35Cc6634C0532925a3b8D0C9e3e3d4c5c3',
    twitterLink: 'https://twitter.com/ferraricollector',
    imageUrl: '/canvas-image/Nike-SB-Dunks-Lobster.webp',
    status: 'PENDING',
    submittedAt: '2024-07-23 14:30',
    submitterName: 'John Ferrari',
  },
  {
    id: '2',
    name: 'Rolex Daytona Paul Newman',
    symbol: 'DAYTONA',
    description:
      'Vintage 1970 Rolex Daytona with Paul Newman dial. Extremely rare and authenticated by Rolex.',
    email: 'watchcollector@example.com',
    proofOfOwnership: 'Serial: 2648123, Certificate of Authenticity included',
    imageUrl:
      '/canvas-image/Shohei-Ohtani-Los-Angeles-Angels-Autographed-Fanatics-Authentic-Game-Used-MLB-Baseball-from-2018-Rookie-Season-Limited-Edition-Number-1-of-5.webp',
    status: 'PENDING',
    submittedAt: '2024-07-23 11:15',
    submitterName: 'Sarah Timepiece',
  },
  {
    id: '3',
    name: 'Basquiat Original Painting',
    symbol: 'BASQUIAT',
    description: 'Original Jean-Michel Basquiat painting from 1982. Provenance fully documented.',
    email: 'artdealer@example.com',
    proofOfOwnership: 'Certificate of Authenticity, Gallery Documentation',
    imageUrl:
      '/canvas-image/Tom-Brady-New-England-Patriots-Autographed-Riddell-1982-1989-Throwback-Speed-Flex-Authentic-Helmet.webp',
    status: 'APPROVED',
    submittedAt: '2024-07-22 16:45',
    submitterName: 'Art Gallery NYC',
  },
];

export function SubmissionsTab() {
  const [submissions, setSubmissions] = useState(SAMPLE_SUBMISSIONS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>(
    'PENDING',
  );
  const [selectedSubmission, setSelectedSubmission] = useState<SubmissionData | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesSearch =
      submission.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      submission.submitterName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || submission.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = (id: string) => {
    setSubmissions((prev) =>
      prev.map((sub) => (sub.id === id ? { ...sub, status: 'APPROVED' as const } : sub)),
    );
    setSelectedSubmission(null);
  };

  const handleReject = (id: string, reason?: string) => {
    setSubmissions((prev) =>
      prev.map((sub) =>
        sub.id === id ? { ...sub, status: 'REJECTED' as const, rejectionReason: reason } : sub,
      ),
    );
    setSelectedSubmission(null);
    setRejectionReason('');
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

      {/* Submissions Table */}
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
              {filteredSubmissions.map((submission) => (
                <tr
                  key={submission.id}
                  className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5"
                >
                  <td className="py-4 px-4">
                    <div className="flex items-center space-x-3">
                      <Image
                        src={submission.imageUrl || '/placeholder.svg'}
                        alt={submission.name}
                        className="w-12 h-12 rounded-lg object-cover border border-[#D0B284]/20"
                        width={48}
                        height={48}
                      />
                      <div>
                        <h3 className="text-white font-medium">{submission.name}</h3>
                        <span className="text-[#DCDDCC] font-jetbrains text-sm">
                          ${submission.symbol}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <div>
                      <div className="text-white font-medium">{submission.submitterName}</div>
                      <div className="text-[#DCDDCC] text-sm">{submission.email}</div>
                    </div>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <Badge className={`${getStatusColor(submission.status)} border-none`}>
                      {submission.status}
                    </Badge>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className="text-[#DCDDCC] text-sm">{submission.submittedAt}</span>
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
                          >
                            <Check className="w-4 h-4 mr-1" />
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Submission Detail Modal */}
      <Dialog open={!!selectedSubmission} onOpenChange={() => setSelectedSubmission(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#231F20] border border-[#D0B284]/20">
          {selectedSubmission && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#D0B284] text-xl">
                  {selectedSubmission.name} (${selectedSubmission.symbol})
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Image */}
                <div>
                  <Image
                    src={selectedSubmission.imageUrl || '/placeholder.svg'}
                    alt={selectedSubmission.name}
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

                  <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center space-x-2">
                      <Mail className="w-4 h-4 text-[#D0B284]" />
                      <span className="text-white">{selectedSubmission.email}</span>
                    </div>

                    {selectedSubmission.destinationWallet && (
                      <div className="flex items-center space-x-2">
                        <Wallet className="w-4 h-4 text-[#D0B284]" />
                        <span className="text-white font-mono text-sm">
                          {selectedSubmission.destinationWallet}
                        </span>
                      </div>
                    )}

                    {selectedSubmission.twitterLink && (
                      <div className="flex items-center space-x-2">
                        <Twitter className="w-4 h-4 text-[#D0B284]" />
                        <a
                          href={selectedSubmission.twitterLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#D0B284] hover:underline"
                        >
                          {selectedSubmission.twitterLink}
                        </a>
                      </div>
                    )}
                  </div>
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
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject Submission
                    </Button>
                    <Button
                      className="bg-[#184D37] hover:bg-[#184D37]/80 text-white"
                      onClick={() => handleApprove(selectedSubmission.id)}
                    >
                      <Check className="w-4 h-4 mr-2" />
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
