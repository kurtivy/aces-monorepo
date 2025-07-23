'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Check, X, Search, Eye, FileText, Calendar, MapPin } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';

interface VerificationData {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  documentType: string;
  documentNumber: string;
  fullName: string;
  dateOfBirth: string;
  countryOfIssue: string;
  state?: string;
  address: string;
  emailAddress: string;
  documentImageUrl?: string;
  submittedAt: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejectionReason?: string;
}

const SAMPLE_VERIFICATIONS: VerificationData[] = [
  {
    id: '1',
    userId: 'user1',
    userName: 'John Ferrari',
    userEmail: 'collector@example.com',
    documentType: 'DRIVERS_LICENSE',
    documentNumber: 'D123456789',
    fullName: 'John Michael Ferrari',
    dateOfBirth: '1985-03-15',
    countryOfIssue: 'United States',
    state: 'California',
    address: '123 Luxury Lane, Beverly Hills, CA 90210',
    emailAddress: 'collector@example.com',
    documentImageUrl: '/placeholder.svg?height=300&width=400',
    submittedAt: '2024-07-23 14:30',
    status: 'PENDING',
  },
  {
    id: '2',
    userId: 'user2',
    userName: 'Sarah Timepiece',
    userEmail: 'watchcollector@example.com',
    documentType: 'PASSPORT',
    documentNumber: 'P987654321',
    fullName: 'Sarah Elizabeth Timepiece',
    dateOfBirth: '1990-08-22',
    countryOfIssue: 'United Kingdom',
    address: '456 Watch Street, London, UK',
    emailAddress: 'watchcollector@example.com',
    documentImageUrl: '/placeholder.svg?height=300&width=400',
    submittedAt: '2024-07-23 11:15',
    status: 'PENDING',
  },
  {
    id: '3',
    userId: 'user3',
    userName: 'Art Gallery NYC',
    userEmail: 'artdealer@example.com',
    documentType: 'ID_CARD',
    documentNumber: 'ID456789123',
    fullName: 'Robert Art Gallery',
    dateOfBirth: '1975-12-10',
    countryOfIssue: 'United States',
    state: 'New York',
    address: '789 Gallery Ave, New York, NY 10001',
    emailAddress: 'artdealer@example.com',
    submittedAt: '2024-07-22 16:45',
    status: 'APPROVED',
  },
];

export function VerificationsTab() {
  const [verifications, setVerifications] = useState(SAMPLE_VERIFICATIONS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>(
    'PENDING',
  );
  const [selectedVerification, setSelectedVerification] = useState<VerificationData | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const filteredVerifications = verifications.filter((verification) => {
    const matchesSearch =
      verification.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      verification.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      verification.userEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || verification.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleApprove = (id: string) => {
    setVerifications((prev) =>
      prev.map((ver) => (ver.id === id ? { ...ver, status: 'APPROVED' as const } : ver)),
    );
    setSelectedVerification(null);
  };

  const handleReject = (id: string, reason?: string) => {
    setVerifications((prev) =>
      prev.map((ver) =>
        ver.id === id ? { ...ver, status: 'REJECTED' as const, rejectionReason: reason } : ver,
      ),
    );
    setSelectedVerification(null);
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
              {filteredVerifications.map((verification) => (
                <tr
                  key={verification.id}
                  className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5"
                >
                  <td className="py-4 px-4">
                    <div>
                      <h3 className="text-white font-medium">{verification.fullName}</h3>
                      <div className="text-[#DCDDCC] text-sm">{verification.userEmail}</div>
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
                    <span className="text-[#DCDDCC] text-sm">{verification.submittedAt}</span>
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
                          >
                            <Check className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:bg-red-400/10"
                            onClick={() => setSelectedVerification(verification)}
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

      {/* Verification Detail Modal */}
      <Dialog open={!!selectedVerification} onOpenChange={() => setSelectedVerification(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#231F20] border border-[#D0B284]/20">
          {selectedVerification && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#D0B284] text-xl">
                  Verification Review - {selectedVerification.fullName}
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
                    <p className="text-white mt-1">{selectedVerification.fullName}</p>
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
                    >
                      <X className="w-4 h-4 mr-2" />
                      Reject Verification
                    </Button>
                    <Button
                      className="bg-[#184D37] hover:bg-[#184D37]/80 text-white"
                      onClick={() => handleApprove(selectedVerification.id)}
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
