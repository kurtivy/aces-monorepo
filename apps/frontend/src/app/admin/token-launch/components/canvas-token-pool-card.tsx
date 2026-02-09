'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowRightLeft, Link2, Loader2 } from 'lucide-react';
import { useTokenLaunch } from '../context';

export function CanvasTokenPoolCard() {
  const {
    effectiveWalletAddress,
    selectedCanvasItem,
    setSelectedCanvasItem,
    setCanvasActionResult,
    canvasItemsWithListingId,
    convexCanvasItems,
    createdListings,
    canvasSetPoolAddressInput,
    setCanvasSetPoolAddressInput,
    canvasLinkTokenAddress,
    setCanvasLinkTokenAddress,
    canvasSetPoolAddressLoading,
    canvasLinkTokenLoading,
    handleUseTokenInLaunchPool,
    handleCanvasSetPoolAddress,
    handleCanvasLinkToken,
    fetchUnlinkedTokens,
    unlinkedTokens,
    unlinkedTokensLoading,
    unlinkedTokensLoadError,
    adminAuthToken,
    canvasActionResult,
  } = useTokenLaunch();

  if (!effectiveWalletAddress) return null;

  const resolvedListing = selectedCanvasItem
    ? createdListings.find((l) => l.id === selectedCanvasItem.listingId)
    : null;
  const hasToken = !!resolvedListing?.tokenId;

  return (
    <Card className="bg-black border-emerald-400/20">
      <CardHeader>
        <CardTitle className="text-white font-libre-caslon flex items-center">
          <Link2 className="w-5 h-5 mr-2 text-emerald-400" />
          Canvas item → Token & Pool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-emerald-500/10 border border-emerald-400/20 rounded-lg">
          <p className="text-sm text-emerald-300 mb-2">
            Pick a canvas item (tile on the infinite canvas), link it to a token if needed, then use
            that token in Launch Pool or set its pool address so /rwa/[symbol] shows the chart and
            swap.
          </p>
        </div>

        <div>
          <Label className="text-[#DCDDCC]">Canvas item</Label>
          <select
            value={selectedCanvasItem?.listingId ?? ''}
            onChange={(e) => {
              const listingId = e.target.value;
              if (!listingId) {
                setSelectedCanvasItem(null);
                setCanvasActionResult(null);
                return;
              }
              const item = canvasItemsWithListingId.find((c) => c.listingId === listingId);
              if (item) {
                setSelectedCanvasItem({
                  listingId: item.listingId,
                  symbol: item.symbol ?? item.ticker ?? '',
                  title: item.title,
                });
                setCanvasActionResult(null);
              }
            }}
            className="w-full bg-black border border-emerald-400/20 text-white rounded-md px-3 py-2 mt-1"
          >
            <option value="">— Select a canvas item —</option>
            {canvasItemsWithListingId.map((item) => (
              <option key={item.listingId} value={item.listingId}>
                {item.title} (${item.symbol ?? item.ticker ?? '?'})
              </option>
            ))}
          </select>
          {convexCanvasItems === undefined && (
            <p className="text-xs text-[#DCDDCC] mt-1">Loading canvas items...</p>
          )}
          {convexCanvasItems?.length === 0 && (
            <p className="text-xs text-amber-400 mt-1">
              No canvas items. Sync canvas from Create Listing section.
            </p>
          )}
        </div>

        {selectedCanvasItem && (
          <div className="space-y-3 pt-2 border-t border-emerald-400/20">
            {!resolvedListing ? (
              <p className="text-sm text-amber-400">
                Listing not found in admin list. Only listings returned by the admin API appear
                here.
              </p>
            ) : (
              <>
                <div className="text-sm text-[#DCDDCC]">
                  <span className="text-emerald-300 font-medium">{resolvedListing.title}</span> (
                  {resolvedListing.symbol})
                  {hasToken && (
                    <span className="block mt-1 font-mono text-xs text-[#DCDDCC]/80">
                      Token: {resolvedListing.tokenId?.slice(0, 10)}...
                      {resolvedListing.tokenId?.slice(-4)}
                    </span>
                  )}
                </div>
                {hasToken ? (
                  <div className="flex flex-col gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleUseTokenInLaunchPool}
                      className="border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10"
                    >
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                      Use this token in Launch Pool
                    </Button>
                    <div>
                      <Label className="text-[#DCDDCC] text-xs">
                        Set pool address (e.g. pool created elsewhere)
                      </Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          value={canvasSetPoolAddressInput}
                          onChange={(e) => setCanvasSetPoolAddressInput(e.target.value)}
                          placeholder="0x..."
                          className="bg-black border-emerald-400/20 text-white font-mono flex-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleCanvasSetPoolAddress}
                          disabled={
                            canvasSetPoolAddressLoading || !canvasSetPoolAddressInput?.trim()
                          }
                          className="border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10"
                        >
                          {canvasSetPoolAddressLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Save'
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Label className="text-[#DCDDCC] text-xs">Link token to this listing</Label>
                    <div className="flex gap-2 mt-1 flex-wrap items-center">
                      <select
                        value={canvasLinkTokenAddress}
                        onChange={(e) => setCanvasLinkTokenAddress(e.target.value)}
                        className="flex-1 min-w-[200px] bg-black border border-emerald-400/20 text-white rounded-md px-3 py-2"
                        disabled={unlinkedTokensLoading}
                      >
                        <option value="">— Select unlinked token —</option>
                        {unlinkedTokens.map((t) => (
                          <option key={t.address} value={t.address}>
                            {t.name} ({t.symbol}) — {t.address.slice(0, 10)}...
                          </option>
                        ))}
                      </select>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fetchUnlinkedTokens()}
                        disabled={unlinkedTokensLoading || !adminAuthToken}
                        className="border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10 shrink-0"
                        title="Refresh list from database"
                      >
                        {unlinkedTokensLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Refresh'
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleCanvasLinkToken}
                        disabled={canvasLinkTokenLoading || !canvasLinkTokenAddress}
                        className="border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10 shrink-0"
                      >
                        {canvasLinkTokenLoading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Link'
                        )}
                      </Button>
                    </div>
                    {unlinkedTokensLoadError && (
                      <p className="text-xs text-red-400 mt-1 flex items-center gap-2 flex-wrap">
                        <span>{unlinkedTokensLoadError}</span>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="text-amber-400 h-auto p-0 text-xs"
                          onClick={() => fetchUnlinkedTokens()}
                        >
                          Retry
                        </Button>
                      </p>
                    )}
                    {!unlinkedTokensLoadError &&
                      unlinkedTokens.length === 0 &&
                      !unlinkedTokensLoading && (
                        <p className="text-xs text-amber-400 mt-1">
                          No unlinked tokens in database. Create a token first or click Refresh to
                          load from DB.
                        </p>
                      )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {canvasActionResult && (
          <div
            className={`p-3 rounded-lg border text-sm ${
              canvasActionResult.startsWith('✅') ||
              canvasActionResult.includes('saved') ||
              canvasActionResult.includes('linked')
                ? 'bg-green-500/10 border-green-400/20 text-green-300'
                : canvasActionResult.startsWith('Token A pre-filled')
                  ? 'bg-cyan-500/10 border-cyan-400/20 text-cyan-300'
                  : 'bg-amber-500/10 border-amber-400/20 text-amber-300'
            }`}
          >
            {canvasActionResult}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
