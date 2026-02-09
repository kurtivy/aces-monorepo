'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { ImagePlus, Loader2, Trash2 } from 'lucide-react';

export function ListingImageGallery({
  images,
  onChange,
  getAccessToken: _getAccessToken,
}: {
  images: string[];
  onChange: (images: string[]) => void;
  /** No longer used; upload no longer requires auth. Kept for backwards compatibility. */
  getAccessToken?: () => Promise<string | null>;
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const MAX_IMAGES = 6;
  const uploadUrl = '/api/admin/upload-image';

  const doUpload = async (file: File): Promise<boolean> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      credentials: 'same-origin',
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message =
        (typeof body?.error === 'string' && body.error) ||
        (typeof body?.message === 'string' && body.message) ||
        `Upload failed (${res.status})`;
      throw new Error(message);
    }
    const result = await res.json();
    if (result.success && result.imageUrl) {
      onChange([...images, result.imageUrl]);
      return true;
    }
    const failureMessage = (typeof result?.error === 'string' && result.error) || 'Upload failed';
    setUploadError(failureMessage);
    return false;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (images.length >= MAX_IMAGES) {
      setUploadError(`Maximum ${MAX_IMAGES} images allowed`);
      return;
    }
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setUploadError('File size exceeds 2MB limit');
      return;
    }
    const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setUploadError('Invalid file type. Only JPEG, PNG, WebP allowed.');
      return;
    }
    setIsUploading(true);
    setUploadError('');
    try {
      await doUpload(file);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (i: number) => {
    onChange(images.filter((_, j) => j !== i));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-[#DCDDCC]">
          Image Gallery ({images.length}/{MAX_IMAGES}) — GCP Upload
        </Label>
        {uploadError && <span className="text-red-400 text-xs">{uploadError}</span>}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {images.map((url, i) => (
          <div key={i} className="relative p-2 bg-black/30 rounded-lg group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt={`Gallery ${i + 1}`}
              className="w-full h-24 rounded-lg object-cover border border-emerald-400/20"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="100" height="100"%3E%3Crect fill="%23333" width="100" height="100"/%3E%3Ctext x="50" y="55" fill="%23666" text-anchor="middle" font-size="12"%3EImage%3C/text%3E%3C/svg%3E';
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeImage(i)}
              className="absolute top-2 right-2 text-red-400 hover:bg-red-400/10 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={`Remove image ${i + 1}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        ))}
        {images.length < MAX_IMAGES && (
          <label className="flex flex-col items-center justify-center h-24 rounded-lg border-2 border-dashed cursor-pointer bg-black/20 border-emerald-400/30 hover:border-emerald-400/50">
            <input
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
            {isUploading ? (
              <Loader2 className="w-6 h-6 text-emerald-400 animate-spin" />
            ) : (
              <ImagePlus className="w-6 h-6 text-emerald-400" />
            )}
            <span className="text-xs text-[#DCDDCC] mt-1">Upload</span>
          </label>
        )}
      </div>
    </div>
  );
}
