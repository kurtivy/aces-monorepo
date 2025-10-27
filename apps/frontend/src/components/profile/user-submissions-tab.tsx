'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { SubmissionsApi, type UserSubmission } from '@/lib/api/submissions';
import { useAuth } from '@/lib/auth/auth-context';
import { Button } from '@/components/ui/button';
import { SimpleListingsTab } from '@/components/profile/simple-listings-tab';
import { OffersTab } from '@/components/profile/offers-tab';

export function UserSubmissionsTab() {
  const { getAccessToken } = useAuth();
  const [submissions, setSubmissions] = useState<UserSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      if (!token) {
        setSubmissions([]);
        return;
      }
      const res = await SubmissionsApi.getUserSubmissions({ limit: 100 }, token);
      setSubmissions(res.data || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    load();
  }, [load]);

  const pendingSubmissions = useMemo(
    () => submissions.filter((s) => s.status === 'PENDING'),
    [submissions],
  );

  const [isOffersOpen, setIsOffersOpen] = useState(false);

  const renderSubmitted = (items: UserSubmission[]) => {
    return (
      <div className="bg-[#0A120B] rounded-lg border-t border-dashed border-[#D7BF75]/25 relative h-full">
        <span className="pointer-events-none absolute left-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute left-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 top-3 h-3 w-0.5 bg-[#D7BF75]" />
        <span className="pointer-events-none absolute right-3 top-3 w-3 h-0.5 bg-[#D7BF75]" />

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="text-[#D7BF75] text-sm uppercase tracking-wide font-medium">
              Your Submissions
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="text-[#D0B284] hover:bg-[#D0B284]/10"
                onClick={() => setIsOffersOpen(true)}
              >
                View Offers
              </Button>
              <Link href="/launch">
                <Button className="bg-[#D7BF75] text-black hover:bg-[#D7BF75]/80 text-sm px-4 py-2">
                  Create Submission
                </Button>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="animate-pulse space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-16 bg-[#D7BF75]/10 rounded-lg" />
              ))}
            </div>
          ) : error ? (
            <div className="text-red-400 text-sm">{error}</div>
          ) : items.length === 0 ? (
            <div className="text-[#DCDDCC]/70 text-sm py-6">No submitted assets.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-dashed border-[#D7BF75]/25">
                    <th className="text-left text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                      RWA / Ticker
                    </th>
                    <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                      Status
                    </th>
                    <th className="text-center text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                      Submitted
                    </th>
                    <th className="text-right text-[#D7BF75] text-sm uppercase tracking-wide font-medium py-4 px-2">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr key={s.id} className="border-b border-dashed border-[#D7BF75]/10">
                      <td className="py-4 px-2">
                        <div className="flex items-center space-x-3">
                          <Image
                            src={s.imageGallery?.[0] || '/placeholder.svg'}
                            alt={s.title || s.symbol}
                            width={40}
                            height={40}
                            className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                          />
                          <div className="min-w-0">
                            <div className="text-[#E6E3D3] text-sm font-medium truncate">
                              {s.title || s.symbol}
                            </div>
                            <div className="text-[#E6E3D3] font-mono text-xs">${s.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <span className="text-[#D7BF75] text-sm">{s.status}</span>
                      </td>
                      <td className="py-4 px-2 text-center">
                        <span className="text-[#E6E3D3] text-sm">
                          {new Date(s.createdAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </td>
                      <td className="py-4 px-2 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <Link href="/launch">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={true}
                              className="bg-[#D7BF75] hover:bg-[#D7BF75]/80 text-black text-xs"
                            >
                              Pending
                            </Button>
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full space-y-2">
      {/* Offers Modal */}
      {isOffersOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70">
          <div className="bg-[#0f1511] rounded-2xl border border-[#E6E3D3]/25 w-full max-w-4xl max-h-[85vh] overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[#E6E3D3]/10">
              <h3 className="text-[#D0B284] text-lg font-semibold">Offers</h3>
              <button
                onClick={() => setIsOffersOpen(false)}
                className="text-[#D0B284] hover:text-white hover:bg-[#D0B284]/10 rounded p-1"
                aria-label="Close offers"
              >
                ✕
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[75vh]">
              <OffersTab />
            </div>
          </div>
        </div>
      )}
      {/* Only show submissions section when there are pending submissions */}
      {pendingSubmissions.length > 0 && renderSubmitted(pendingSubmissions)}

      {/* Listings section handles approved → finalize → launch flow and shows live listings */}
      <SimpleListingsTab defaultShowPending={true} />
    </div>
  );
}
