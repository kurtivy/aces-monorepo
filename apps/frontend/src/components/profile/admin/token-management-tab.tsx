'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Search,
  Eye,
  Check,
  Clock,
  Coins,
  Settings,
  FileText,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/auth-context';
import {
  TokenCreationApi,
  ListingWithTokenStatus,
  TokenParameters,
  TokenCreationStatus,
} from '@/lib/api/token-creation';

export function TokenManagementTab() {
  const { getAccessToken } = useAuth();
  const [listings, setListings] = useState<ListingWithTokenStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TokenCreationStatus>('ALL');
  const [selectedListing, setSelectedListing] = useState<ListingWithTokenStatus | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [showApprovalDialog, setShowApprovalDialog] = useState(false);

  // Token parameter form state
  const [tokenParams, setTokenParams] = useState<TokenParameters>({
    steepness: '100000000',
    floor: '0',
    tokensBondedAt: '800000000',
    curve: 0,
    useVanityMining: false,
    vanityTarget: 'ace',
  });

  useEffect(() => {
    fetchAllStatuses();
  }, []);

  const fetchAllStatuses = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const result = await TokenCreationApi.getAllTokenCreationStatuses(token);

      if (result.success && result.data) {
        setListings(result.data);
      } else {
        setError(result.error || 'Failed to fetch token creation statuses');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveParameters = async () => {
    if (!selectedListing) return;

    try {
      setIsApproving(true);

      const token = await getAccessToken();
      if (!token) {
        setError('Authentication required');
        return;
      }

      const result = await TokenCreationApi.approveTokenParameters(
        selectedListing.id,
        tokenParams,
        token,
      );

      if (result.success) {
        // Refresh the listings
        await fetchAllStatuses();
        setShowApprovalDialog(false);
        setSelectedListing(null);
        // Reset form
        setTokenParams({
          steepness: '100000000',
          floor: '0',
          tokensBondedAt: '800000000',
          curve: 0,
          useVanityMining: false,
          vanityTarget: 'ace',
        });
      } else {
        setError(result.error || 'Failed to approve parameters');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while approving parameters');
    } finally {
      setIsApproving(false);
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case TokenCreationStatus.AWAITING_USER_DETAILS:
        return (
          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-300">
            Awaiting Details
          </Badge>
        );
      case TokenCreationStatus.PENDING_ADMIN_REVIEW:
        return (
          <Badge variant="secondary" className="bg-blue-500/20 text-blue-300">
            Pending Review
          </Badge>
        );
      case TokenCreationStatus.READY_TO_MINT:
        return (
          <Badge variant="secondary" className="bg-green-500/20 text-green-300">
            Ready to Mint
          </Badge>
        );
      case TokenCreationStatus.MINTED:
        return (
          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300">
            Minted
          </Badge>
        );
      case TokenCreationStatus.FAILED:
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">No Status</Badge>;
    }
  };

  const filteredListings = listings.filter((listing) => {
    const matchesSearch =
      listing.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      listing.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      listing.owner.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      listing.owner.walletAddress?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || listing.tokenCreationStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusCounts = () => {
    const counts = {
      total: listings.length,
      awaiting: listings.filter(
        (l) => l.tokenCreationStatus === TokenCreationStatus.AWAITING_USER_DETAILS,
      ).length,
      pending: listings.filter(
        (l) => l.tokenCreationStatus === TokenCreationStatus.PENDING_ADMIN_REVIEW,
      ).length,
      ready: listings.filter((l) => l.tokenCreationStatus === TokenCreationStatus.READY_TO_MINT)
        .length,
      minted: listings.filter((l) => l.tokenCreationStatus === TokenCreationStatus.MINTED).length,
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="bg-[#151c16]/40 border-purple-400/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-sm text-[#DCDDCC]">Total</p>
                <p className="text-xl font-bold text-white">{statusCounts.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#151c16]/40 border-purple-400/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-yellow-400" />
              <div>
                <p className="text-sm text-[#DCDDCC]">Awaiting Details</p>
                <p className="text-xl font-bold text-white">{statusCounts.awaiting}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#151c16]/40 border-purple-400/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-blue-400" />
              <div>
                <p className="text-sm text-[#DCDDCC]">Pending Review</p>
                <p className="text-xl font-bold text-white">{statusCounts.pending}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#151c16]/40 border-purple-400/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Settings className="w-4 h-4 text-green-400" />
              <div>
                <p className="text-sm text-[#DCDDCC]">Ready to Mint</p>
                <p className="text-xl font-bold text-white">{statusCounts.ready}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-[#151c16]/40 border-purple-400/20">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Coins className="w-4 h-4 text-purple-400" />
              <div>
                <p className="text-sm text-[#DCDDCC]">Minted</p>
                <p className="text-xl font-bold text-white">{statusCounts.minted}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#DCDDCC] w-4 h-4" />
          <Input
            placeholder="Search by title, symbol, email, or wallet address..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-[#151c16]/40 border-purple-400/20 text-white placeholder:text-[#DCDDCC]"
          />
        </div>
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as any)}>
          <SelectTrigger className="w-[200px] bg-[#151c16]/40 border-purple-400/20 text-white">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            <SelectItem value={TokenCreationStatus.AWAITING_USER_DETAILS}>
              Awaiting Details
            </SelectItem>
            <SelectItem value={TokenCreationStatus.PENDING_ADMIN_REVIEW}>Pending Review</SelectItem>
            <SelectItem value={TokenCreationStatus.READY_TO_MINT}>Ready to Mint</SelectItem>
            <SelectItem value={TokenCreationStatus.MINTED}>Minted</SelectItem>
            <SelectItem value={TokenCreationStatus.FAILED}>Failed</SelectItem>
          </SelectContent>
        </Select>
        <Button
          onClick={fetchAllStatuses}
          disabled={isLoading}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <TrendingUp className="w-4 h-4" />
          )}
          Refresh
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/40 rounded-lg p-4">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-400" />
          <span className="ml-2 text-[#DCDDCC]">Loading token creation statuses...</span>
        </div>
      )}

      {/* Listings Table */}
      {!isLoading && (
        <div className="bg-[#151c16]/40 border border-purple-400/20 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-purple-400/10">
                <tr>
                  <th className="text-left p-4 text-purple-300 font-medium">Listing</th>
                  <th className="text-left p-4 text-purple-300 font-medium">Owner</th>
                  <th className="text-left p-4 text-purple-300 font-medium">Status</th>
                  <th className="text-left p-4 text-purple-300 font-medium">Last Updated</th>
                  <th className="text-left p-4 text-purple-300 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredListings.map((listing) => (
                  <tr
                    key={listing.id}
                    className="border-t border-purple-400/20 hover:bg-purple-400/5"
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-medium text-white">{listing.title}</p>
                        <p className="text-sm text-[#DCDDCC]">{listing.symbol}</p>
                      </div>
                    </td>
                    <td className="p-4">
                      <div>
                        <p className="text-sm text-white">{listing.owner.email || 'No email'}</p>
                        <p className="text-xs text-[#DCDDCC] font-mono">
                          {listing.owner.walletAddress
                            ? `${listing.owner.walletAddress.slice(0, 6)}...${listing.owner.walletAddress.slice(-4)}`
                            : 'No wallet'}
                        </p>
                      </div>
                    </td>
                    <td className="p-4">{getStatusBadge(listing.tokenCreationStatus)}</td>
                    <td className="p-4">
                      <p className="text-sm text-[#DCDDCC]">
                        {new Date(listing.updatedAt).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedListing(listing)}
                          className="text-purple-400 hover:bg-purple-400/10"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {listing.tokenCreationStatus ===
                          TokenCreationStatus.PENDING_ADMIN_REVIEW && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedListing(listing);
                              setShowApprovalDialog(true);
                            }}
                            className="text-green-400 hover:bg-green-400/10"
                          >
                            <Check className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredListings.length === 0 && !isLoading && (
              <div className="text-center py-8">
                <p className="text-[#DCDDCC]">No listings found matching your criteria.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Listing Details Dialog */}
      <Dialog
        open={!!selectedListing && !showApprovalDialog}
        onOpenChange={() => setSelectedListing(null)}
      >
        <DialogContent className="bg-black border-purple-400/20 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-purple-400">Listing Details</DialogTitle>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-purple-300">Title</Label>
                  <p className="text-white">{selectedListing.title}</p>
                </div>
                <div>
                  <Label className="text-purple-300">Symbol</Label>
                  <p className="text-white">{selectedListing.symbol}</p>
                </div>
              </div>

              <div>
                <Label className="text-purple-300">Description</Label>
                <p className="text-white">{selectedListing.description}</p>
              </div>

              <div>
                <Label className="text-purple-300">Status</Label>
                <div className="mt-1">{getStatusBadge(selectedListing.tokenCreationStatus)}</div>
              </div>

              {selectedListing.userProvidedDetails && (
                <div>
                  <Label className="text-purple-300">User Provided Details</Label>
                  <pre className="text-xs text-[#DCDDCC] bg-[#151c16]/40 p-3 rounded mt-1 overflow-auto">
                    {JSON.stringify(selectedListing.userProvidedDetails, null, 2)}
                  </pre>
                </div>
              )}

              {selectedListing.tokenParameters && (
                <div>
                  <Label className="text-purple-300">Token Parameters</Label>
                  <pre className="text-xs text-[#DCDDCC] bg-[#151c16]/40 p-3 rounded mt-1 overflow-auto">
                    {JSON.stringify(selectedListing.tokenParameters, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Token Parameter Approval Dialog */}
      <Dialog open={showApprovalDialog} onOpenChange={setShowApprovalDialog}>
        <DialogContent className="bg-black border-purple-400/20 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-purple-400">Approve Token Parameters</DialogTitle>
          </DialogHeader>
          {selectedListing && (
            <div className="space-y-4">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-white mb-2">
                  {selectedListing.title} ({selectedListing.symbol})
                </h3>
                <p className="text-sm text-[#DCDDCC]">
                  Configure the token parameters for this listing
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="steepness" className="text-purple-300">
                    Steepness
                  </Label>
                  <Input
                    id="steepness"
                    value={tokenParams.steepness}
                    onChange={(e) =>
                      setTokenParams((prev) => ({ ...prev, steepness: e.target.value }))
                    }
                    className="bg-[#151c16]/40 border-purple-400/20 text-white mt-1"
                    placeholder="100000000"
                  />
                  <p className="text-xs text-[#DCDDCC] mt-1">Range: 1 - 10,000,000,000,000,000</p>
                </div>

                <div>
                  <Label htmlFor="floor" className="text-purple-300">
                    Floor Price
                  </Label>
                  <Input
                    id="floor"
                    value={tokenParams.floor}
                    onChange={(e) => setTokenParams((prev) => ({ ...prev, floor: e.target.value }))}
                    className="bg-[#151c16]/40 border-purple-400/20 text-white mt-1"
                    placeholder="0"
                  />
                  <p className="text-xs text-[#DCDDCC] mt-1">Range: 0 - 1,000,000,000</p>
                </div>
              </div>

              <div>
                <Label htmlFor="tokensBondedAt" className="text-purple-300">
                  Tokens Bonded At
                </Label>
                <Input
                  id="tokensBondedAt"
                  value={tokenParams.tokensBondedAt}
                  onChange={(e) =>
                    setTokenParams((prev) => ({ ...prev, tokensBondedAt: e.target.value }))
                  }
                  className="bg-[#151c16]/40 border-purple-400/20 text-white mt-1"
                  placeholder="800000000"
                />
                <p className="text-xs text-[#DCDDCC] mt-1">Minimum: 1 token</p>
              </div>

              <div>
                <Label htmlFor="curve" className="text-purple-300">
                  Curve Type
                </Label>
                <Select
                  value={tokenParams.curve.toString()}
                  onValueChange={(value) =>
                    setTokenParams((prev) => ({ ...prev, curve: parseInt(value) }))
                  }
                >
                  <SelectTrigger className="bg-[#151c16]/40 border-purple-400/20 text-white mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Exponential (0)</SelectItem>
                    <SelectItem value="1">Linear (1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="useVanityMining"
                    checked={tokenParams.useVanityMining}
                    onCheckedChange={(checked) =>
                      setTokenParams((prev) => ({ ...prev, useVanityMining: !!checked }))
                    }
                  />
                  <Label htmlFor="useVanityMining" className="text-purple-300">
                    Use Vanity Mining
                  </Label>
                </div>

                {tokenParams.useVanityMining && (
                  <div>
                    <Label htmlFor="vanityTarget" className="text-purple-300">
                      Vanity Target
                    </Label>
                    <Input
                      id="vanityTarget"
                      value={tokenParams.vanityTarget}
                      onChange={(e) =>
                        setTokenParams((prev) => ({ ...prev, vanityTarget: e.target.value }))
                      }
                      className="bg-[#151c16]/40 border-purple-400/20 text-white mt-1"
                      placeholder="ace"
                    />
                    <p className="text-xs text-[#DCDDCC] mt-1">
                      Target suffix for the token address
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowApprovalDialog(false)}
                  className="border-purple-400/20 text-purple-300 hover:bg-purple-400/10"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleApproveParameters}
                  disabled={isApproving}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {isApproving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Approving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Approve Parameters
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
