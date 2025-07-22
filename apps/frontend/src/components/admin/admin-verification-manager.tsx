'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth/auth-context';
import { AdminApi, type VerificationApplication } from '@/lib/api/admin';
import { VerificationApplicationCard } from '@/components/admin/verification-application-card';
import { VerificationDetailsModal } from '@/components/admin/verification-details-modal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, RefreshCw, Users, CheckCircle, XCircle, Clock } from 'lucide-react';

export function AdminVerificationManager() {
  const { getAccessToken, user } = useAuth();
  const [applications, setApplications] = useState<VerificationApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedApplication, setSelectedApplication] = useState<VerificationApplication | null>(
    null,
  );
  const [processing, setProcessing] = useState<string | null>(null);

  // Check if user is admin (you might want to add this to your auth context)
  const isAdmin = user?.role === 'ADMIN';

  const fetchApplications = async () => {
    if (!isAdmin) {
      setError('Admin access required');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) throw new Error('No access token available');

      const data = await AdminApi.getPendingVerifications(token);
      setApplications(data);
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  };

  const handleProcessVerification = async (
    verificationId: string,
    approve: boolean,
    rejectionReason?: string,
  ) => {
    try {
      setProcessing(verificationId);
      const token = await getAccessToken();
      if (!token) throw new Error('No access token available');

      await AdminApi.processVerification(verificationId, approve, rejectionReason, token);

      // Remove the processed application from the list
      setApplications((prev) => prev.filter((app) => app.id !== verificationId));

      // Close modal if open
      if (selectedApplication?.id === verificationId) {
        setSelectedApplication(null);
      }
    } catch (err) {
      console.error('Error processing verification:', err);
      setError(err instanceof Error ? err.message : 'Failed to process verification');
    } finally {
      setProcessing(null);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <XCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold text-[#D0B284] mb-2">Access Denied</h2>
          <p className="text-[#DCDDCC] text-center">
            You need admin privileges to access this page.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-[#D0B284] mb-4" />
          <p className="text-[#DCDDCC]">Loading verification applications...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <XCircle className="w-16 h-16 text-red-500 mb-4" />
          <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
          <p className="text-[#DCDDCC] text-center mb-4">{error}</p>
          <Button onClick={fetchApplications} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pendingCount = applications.length;
  const stats = {
    pending: pendingCount,
    total: pendingCount, // For now, only showing pending
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#DCDDCC]">
              Pending Applications
            </CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#D0B284]">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#DCDDCC]">Total Applications</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#D0B284]">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-[#DCDDCC]">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchApplications} variant="outline" size="sm">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Applications List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[#D0B284]">Verification Applications</CardTitle>
        </CardHeader>
        <CardContent>
          {applications.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-[#D0B284] mb-2">All Caught Up!</h3>
              <p className="text-[#DCDDCC]">No pending verification applications at the moment.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((application) => (
                <VerificationApplicationCard
                  key={application.id}
                  application={application}
                  onViewDetails={() => setSelectedApplication(application)}
                  onApprove={() => handleProcessVerification(application.id, true)}
                  onReject={(reason: string) =>
                    handleProcessVerification(application.id, false, reason)
                  }
                  processing={processing === application.id}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Details Modal */}
      {selectedApplication && (
        <VerificationDetailsModal
          application={selectedApplication}
          open={!!selectedApplication}
          onClose={() => setSelectedApplication(null)}
          onApprove={() => handleProcessVerification(selectedApplication.id, true)}
          onReject={(reason: string) =>
            handleProcessVerification(selectedApplication.id, false, reason)
          }
          processing={processing === selectedApplication.id}
        />
      )}
    </div>
  );
}
