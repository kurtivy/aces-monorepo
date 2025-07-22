import { AdminVerificationManager } from '@/components/admin/admin-verification-manager';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-[#231F20] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-[#D0B284] mb-2">Admin Dashboard</h1>
          <p className="text-[#DCDDCC]">Manage seller verification applications</p>
        </div>

        <AdminVerificationManager />
      </div>
    </div>
  );
}
