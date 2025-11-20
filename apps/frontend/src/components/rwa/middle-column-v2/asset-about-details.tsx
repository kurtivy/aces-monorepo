'use client';

import { useState } from 'react';
import {
  MapPin,
  X,
  ChevronDown,
  ShieldCheck,
  FileBadge2,
  FileCheck2,
  Stamp,
  ScrollText,
  FileText,
  type LucideIcon,
} from 'lucide-react';
import type { DatabaseListing, OwnershipDocumentType } from '@/types/rwa/section.types';

interface AssetAboutDetailsV2Props {
  title: string;
  description?: string | null;
  onClose?: () => void;
  listing?: DatabaseListing | null;
}

export function AssetAboutDetailsV2({
  title,
  description,
  onClose,
  listing,
}: AssetAboutDetailsV2Props) {
  const [openSection, setOpenSection] = useState<'Story' | 'Details' | 'Provenance'>('Story');

  const ownershipDocs = listing?.submission?.ownershipDocumentation;
  const docTypeLookup: Record<OwnershipDocumentType, { label: string; icon: LucideIcon }> = {
    BILL_OF_SALE: { label: 'Bill of Sale', icon: FileBadge2 },
    CERTIFICATE_OF_AUTH: {
      label: 'Certificate of Authenticity',
      icon: Stamp,
    },
    INSURANCE_DOC: {
      label: 'Insurance Documentation',
      icon: ShieldCheck,
    },
    DEED_OR_TITLE: {
      label: 'Deed or Title',
      icon: ScrollText,
    },
    APPRAISAL_DOC: {
      label: 'Appraisal Documentation',
      icon: FileCheck2,
    },
    PROVENANCE_DOC: {
      label: 'Provenance Documentation',
      icon: FileText,
    },
  };

  const verifiedDocTypes = Array.isArray(ownershipDocs)
    ? Array.from(
        new Set(
          ownershipDocs
            .map((doc) => doc?.type)
            .filter(
              (type): type is OwnershipDocumentType =>
                Boolean(type && type in docTypeLookup),
            ),
        ),
      )
    : [];

  const parseContent = (content?: string | null) =>
    content
      ? content
          .split(/\n+/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
      : [];

  const fallbackText = 'Additional information coming soon.';
  const cards = [
    {
      title: 'Story',
      paragraphs: parseContent(listing?.story ?? description ?? listing?.description ?? null),
    },
    {
      title: 'Details',
      paragraphs: parseContent(
        listing?.details ?? description ?? listing?.description ?? listing?.story ?? null,
      ),
    },
    {
      title: 'Provenance',
      paragraphs: parseContent(listing?.provenance ?? null),
    },
  ];

  const hasAnyCardContent = cards.some((card) => card.paragraphs.length > 0);
  const location = listing?.location || 'Worldwide';

  return (
    <div className="relative h-full flex flex-col gap-4 bg-[#151c16] p-6">
      {onClose ? (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#D0B284] hover:text-white transition-colors"
          aria-label="Close overlay"
        >
          <X className="h-6 w-6" />
        </button>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold text-white font-neue-world uppercase tracking-wide">
          AUCTION DETAILS
        </h2>
        {title ? (
          <>
            <p className="mt-1 text-xs uppercase tracking-widest text-[#D0B284]/80 font-proxima-nova">
              {title}
            </p>
            <div className="flex items-center pt-1">
              <span className="text-[#D0B284]/80 text-xs font-proxima-nova uppercase tracking-widest">
                LOCATION
              </span>
              <MapPin className="w-3 h-3 text-white mx-1 flex items-center" />
              <span className="text-white text-xs font-semibold font-proxima-nova tracking-wider">
                {location}
              </span>
            </div>
          </>
        ) : null}
      </div>

      {verifiedDocTypes.length > 0 ? (
        <div className="rounded-lg border border-[#D0B284]/25 bg-black/30 p-3 shadow-[0_10px_20px_rgba(0,0,0,0.14)]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#D0B284]" />
              <div>
                <p className="text-[11px] uppercase tracking-[0.18em] text-[#D0B284] font-neue-world">
                  Ownership Verification
                </p>
                <p className="text-[11px] text-[#DCDDCC]/80 font-proxima-nova">
                  {verifiedDocTypes.length} verification document
                  {verifiedDocTypes.length === 1 ? '' : 's'} confirmed
                </p>
              </div>
            </div>
            <span className="rounded-full border border-[#D0B284]/30 bg-[#D0B284]/10 px-2.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-[#D0B284] font-semibold">
              Verified
            </span>
          </div>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
            {verifiedDocTypes.map((type) => {
              const meta = docTypeLookup[type];
              const Icon = meta.icon;
              return (
                <div
                  key={type}
                  className="inline-flex items-center gap-2 rounded-md border border-[#D0B284]/25 bg-[#D0B284]/10 px-3 py-2"
                >
                  <Icon className="h-4 w-4 text-[#D0B284]" />
                  <div className="text-xs font-semibold text-white">{meta.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {hasAnyCardContent ? (
        <div className="flex flex-col">
          <div className="flex flex-col gap-4">
            {cards.map((card) => {
              const isOpen = openSection === card.title;
              return (
                <div
                  key={card.title}
                  className="relative overflow-hidden rounded-xl border border-black/10 bg-black/40 p-4 shadow-[0_10px_20px_rgba(0,0,0,0.12)]"
                >
                  <div className="pointer-events-none absolute inset-0">
                    <div className="absolute inset-5 rounded-lg bg-black/60 blur-2xl" />
                  </div>

                  <span className="absolute top-2 left-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                  <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                  <span className="absolute bottom-2 left-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />
                  <span className="absolute bottom-2 right-2 h-2 w-2 rounded-full bg-[#D0B284]/80" />

                  <div className="relative flex h-full flex-col gap-3">
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() =>
                        setOpenSection(card.title as 'Story' | 'Details' | 'Provenance')
                      }
                      className="flex w-full items-center justify-between text-left"
                    >
                      <span className="text-base font-semibold uppercase tracking-[0.35em] text-[#D0B284] font-neue-world">
                        {card.title}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-[#D0B284] transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isOpen ? (
                      card.paragraphs.length > 0 ? (
                        card.paragraphs.map((paragraph, index) => (
                          <p
                            key={`${card.title}-${index}`}
                            className="text-sm leading-relaxed text-white font-proxima-nova"
                          >
                            {paragraph}
                          </p>
                        ))
                      ) : (
                        <p className="text-sm leading-relaxed text-white font-proxima-nova">
                          {fallbackText}
                        </p>
                      )
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center border border-dashed border-[#D0B284]/20 rounded-lg p-6">
          <div className="text-[#DCDDCC] text-base md:text-lg">No description available yet</div>
          <div className="text-[#8F9B8F] text-xs md:text-sm mt-2">
            {title
              ? `Details for ${title} will be provided once the asset listing is finalized.`
              : 'Details will be provided once the asset listing is finalized.'}
          </div>
        </div>
      )}
    </div>
  );
}
