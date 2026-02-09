'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FileText, Loader2, Plus, RefreshCw, X } from 'lucide-react';
import { useTokenLaunch } from '../context';
import type { ListingAssetType } from '../types';
import { ListingImageGallery } from './listing-image-gallery';

export function CreateListingCard() {
  const {
    effectiveWalletAddress,
    listingForm,
    setListingForm,
    listingLoading,
    listingResult,
    syncCanvasLoading,
    syncCanvasResult,
    syncUsersLoading,
    syncUsersResult,
    handleCreateListing,
    handleSyncCanvas,
    handleSyncUsersToConvex,
    getAdminAccessToken,
    createdTokens,
    unlinkedTokens,
  } = useTokenLaunch();

  if (!effectiveWalletAddress) return null;

  const allTokens = (() => {
    const seen = new Set(createdTokens.map((t) => t.address.toLowerCase()));
    const all = [...createdTokens];
    unlinkedTokens.forEach((t) => {
      if (!seen.has(t.address.toLowerCase())) {
        seen.add(t.address.toLowerCase());
        all.push(t);
      }
    });
    return all;
  })();

  return (
    <Card className="bg-black border-emerald-400/20">
      <CardHeader>
        <CardTitle className="text-white font-libre-caslon flex items-center">
          <FileText className="w-5 h-5 mr-2 text-emerald-400" />
          Create Listing
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-emerald-500/10 border border-emerald-400/20 rounded-lg">
          <p className="text-sm text-emerald-300 mb-2">
            <strong>Step 2:</strong> Create a listing for your tokenized asset
          </p>
          <p className="text-xs text-emerald-200/70">
            Link your created token to a listing. The listing will start as not live and can be
            activated later.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-[#DCDDCC]">Title *</Label>
            <Input
              value={listingForm.title}
              onChange={(e) => setListingForm((p) => ({ ...p, title: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="Asset Title"
            />
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Symbol *</Label>
            <Input
              value={listingForm.symbol}
              onChange={(e) => setListingForm((p) => ({ ...p, symbol: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="ASSET"
            />
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Asset Type *</Label>
            <select
              value={listingForm.assetType}
              onChange={(e) =>
                setListingForm((p) => ({ ...p, assetType: e.target.value as ListingAssetType }))
              }
              className="w-full bg-black border border-emerald-400/20 text-white rounded-md px-3 py-2"
            >
              <option value="VEHICLE">Vehicle</option>
              <option value="JEWELRY">Jewelry</option>
              <option value="COLLECTIBLE">Collectible</option>
              <option value="ART">Art</option>
              <option value="FASHION">Fashion</option>
              <option value="ALCOHOL">Alcohol</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Link Token (Optional)</Label>
            <select
              value={listingForm.tokenId}
              onChange={(e) => setListingForm((p) => ({ ...p, tokenId: e.target.value }))}
              className="w-full bg-black border border-emerald-400/20 text-white rounded-md px-3 py-2"
            >
              <option value="">-- Select a token --</option>
              {allTokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.name} ({token.symbol}) - {token.address.slice(0, 10)}...
                </option>
              ))}
            </select>
            <p className="text-xs text-[#DCDDCC] mt-1">
              Tokens from DB (unlinked) + tokens created this session
            </p>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[#DCDDCC]">Brand</Label>
            <Input
              value={listingForm.brand}
              onChange={(e) => setListingForm((p) => ({ ...p, brand: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="Brand name"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[#DCDDCC]">Story</Label>
            <Textarea
              value={listingForm.story}
              onChange={(e) => setListingForm((p) => ({ ...p, story: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="Tell the story of this asset..."
              rows={3}
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[#DCDDCC]">Details</Label>
            <Textarea
              value={listingForm.details}
              onChange={(e) => setListingForm((p) => ({ ...p, details: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="Additional details..."
              rows={3}
            />
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Provenance</Label>
            <Textarea
              value={listingForm.provenance}
              onChange={(e) => setListingForm((p) => ({ ...p, provenance: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="Ownership history..."
              rows={2}
            />
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Value (USD)</Label>
            <Input
              value={listingForm.value}
              onChange={(e) => setListingForm((p) => ({ ...p, value: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="e.g. 50000"
            />
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Reserve Price (USD)</Label>
            <Input
              value={listingForm.reservePrice}
              onChange={(e) => setListingForm((p) => ({ ...p, reservePrice: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="Minimum sale price"
            />
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Starting Bid Price (USD)</Label>
            <Input
              value={listingForm.startingBidPrice}
              onChange={(e) => setListingForm((p) => ({ ...p, startingBidPrice: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="Minimum bid amount"
            />
          </div>
          <div>
            <Label className="text-[#DCDDCC]">Launch Date</Label>
            <Input
              type="datetime-local"
              value={listingForm.launchDate}
              onChange={(e) => setListingForm((p) => ({ ...p, launchDate: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
            />
            <p className="text-xs text-[#DCDDCC] mt-1">When the asset will go live for sale</p>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[#DCDDCC]">Hype Sentence</Label>
            <Input
              value={listingForm.hypeSentence}
              onChange={(e) => setListingForm((p) => ({ ...p, hypeSentence: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="Short catchy tagline..."
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[#DCDDCC]">Location</Label>
            <Input
              value={listingForm.location}
              onChange={(e) => setListingForm((p) => ({ ...p, location: e.target.value }))}
              className="bg-black border-emerald-400/20 text-white"
              placeholder="e.g. Miami, FL"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-[#DCDDCC]">Hype Points (bullet points)</Label>
            <div className="space-y-2">
              {listingForm.hypePoints.map((point, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={point}
                    onChange={(e) => {
                      const next = [...listingForm.hypePoints];
                      next[i] = e.target.value;
                      setListingForm((p) => ({ ...p, hypePoints: next }));
                    }}
                    className="bg-black border-emerald-400/20 text-white flex-1"
                    placeholder={`Point ${i + 1}`}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setListingForm((p) => ({
                        ...p,
                        hypePoints: p.hypePoints.filter((_, j) => j !== i),
                      }))
                    }
                    className="text-red-400 hover:bg-red-400/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setListingForm((p) => ({ ...p, hypePoints: [...p.hypePoints, ''] }))}
                className="border-emerald-400/40 text-emerald-300"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add point
              </Button>
            </div>
          </div>
          <div className="md:col-span-2">
            <Label className="text-[#DCDDCC]">Asset Details (key-value)</Label>
            <div className="space-y-2">
              {Object.entries(listingForm.assetDetails).map(([key, val], i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={key}
                    onChange={(e) => {
                      const next = { ...listingForm.assetDetails };
                      delete next[key];
                      next[e.target.value] = val;
                      setListingForm((p) => ({ ...p, assetDetails: next }));
                    }}
                    className="bg-black border-emerald-400/20 text-white w-32"
                    placeholder="Key"
                  />
                  <Input
                    value={val}
                    onChange={(e) => {
                      const next = { ...listingForm.assetDetails };
                      next[key] = e.target.value;
                      setListingForm((p) => ({ ...p, assetDetails: next }));
                    }}
                    className="bg-black border-emerald-400/20 text-white flex-1"
                    placeholder="Value"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const next = { ...listingForm.assetDetails };
                      delete next[key];
                      setListingForm((p) => ({ ...p, assetDetails: next }));
                    }}
                    className="text-red-400 hover:bg-red-400/10"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setListingForm((p) => ({
                    ...p,
                    assetDetails: { ...p.assetDetails, [`key_${Date.now()}`]: '' },
                  }))
                }
                className="border-emerald-400/40 text-emerald-300"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add detail
              </Button>
            </div>
          </div>
          <div className="md:col-span-2 flex flex-wrap gap-6 items-center">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={listingForm.showOnCanvas}
                onChange={(e) => setListingForm((p) => ({ ...p, showOnCanvas: e.target.checked }))}
                className="rounded border-emerald-400/40 bg-black text-emerald-500"
              />
              <span className="text-sm text-emerald-200">Show on canvas</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={listingForm.isFeatured}
                onChange={(e) => setListingForm((p) => ({ ...p, isFeatured: e.target.checked }))}
                className="rounded border-emerald-400/40 bg-black text-emerald-500"
              />
              <span className="text-sm text-emerald-200">Featured (homepage)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={listingForm.showOnDrops}
                onChange={(e) => setListingForm((p) => ({ ...p, showOnDrops: e.target.checked }))}
                className="rounded border-emerald-400/40 bg-black text-emerald-500"
              />
              <span className="text-sm text-emerald-200">Show on drops page</span>
            </label>
          </div>
          <div className="md:col-span-2">
            <ListingImageGallery
              images={listingForm.imageGallery}
              onChange={(imageGallery) => setListingForm((p) => ({ ...p, imageGallery }))}
              getAccessToken={getAdminAccessToken}
            />
          </div>
        </div>

        <Button
          onClick={handleCreateListing}
          disabled={listingLoading || !listingForm.title || !listingForm.symbol}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          {listingLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Listing...
            </>
          ) : (
            <>
              <FileText className="w-4 h-4 mr-2" />
              Create Listing
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleSyncCanvas}
          disabled={syncCanvasLoading}
          className="w-full border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10"
        >
          {syncCanvasLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing canvas...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync canvas (repopulate from DB after restart)
            </>
          )}
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleSyncUsersToConvex}
          disabled={syncUsersLoading}
          className="w-full border-amber-400/40 text-amber-200 hover:bg-amber-500/10"
        >
          {syncUsersLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Syncing users...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4 mr-2" />
              Sync users to Convex (one-time backfill)
            </>
          )}
        </Button>

        {listingResult && (
          <div
            className={`p-3 rounded-lg border ${
              listingResult.startsWith('✅')
                ? 'bg-green-500/10 border-green-400/20 text-green-300'
                : 'bg-red-500/10 border-red-400/20 text-red-300'
            }`}
          >
            {listingResult}
          </div>
        )}
        {syncCanvasResult && (
          <div
            className={`p-3 rounded-lg border ${
              syncCanvasResult.startsWith('✅')
                ? 'bg-green-500/10 border-green-400/20 text-green-300'
                : 'bg-red-500/10 border-red-400/20 text-red-300'
            }`}
          >
            {syncCanvasResult}
          </div>
        )}
        {syncUsersResult && (
          <div
            className={`p-3 rounded-lg border ${
              syncUsersResult.startsWith('✅')
                ? 'bg-green-500/10 border-green-400/20 text-green-300'
                : 'bg-red-500/10 border-red-400/20 text-red-300'
            }`}
          >
            {syncUsersResult}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
