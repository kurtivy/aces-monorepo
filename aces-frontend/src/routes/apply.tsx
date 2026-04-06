import { useState, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useWallet } from "~/hooks/use-privy-wallet";
import { WalletModal } from "~/components/wallet-modal";
import { X as XIcon, Upload } from "lucide-react";

export const Route = createFileRoute("/apply")({
  component: ApplyPage,
});

/**
 * ── Asset Type Options ───────────────────────────────────
 * Matches the assetType enum used in the submissions schema.
 * Displayed as a <select> dropdown on the form.
 */
const ASSET_TYPES = [
  "VEHICLE",
  "JEWELRY",
  "COLLECTIBLE",
  "ART",
  "FASHION",
  "ALCOHOL",
  "OTHER",
] as const;

/**
 * Shared input styling — dark surface, subtle golden border,
 * platinum text to match the ACES luxury aesthetic.
 */
const inputClass =
  "w-full rounded border border-golden-beige/15 bg-card-surface px-4 py-3 text-sm text-platinum-grey placeholder:text-platinum-grey/30 focus:border-golden-beige/40 focus:outline-none";

function ApplyPage() {
  const { address, isConnected } = useWallet();

  // ── Wallet not connected — mirror the Portfolio page pattern ──
  // Show a centered prompt asking the user to connect before
  // they can access the submission form.
  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-deep-charcoal">
        <div className="text-center">
          <h1 className="font-heading text-3xl text-golden-beige mb-3">
            Apply to List Your Asset
          </h1>
          <p className="text-platinum-grey/60 mb-6">
            Connect your wallet to submit a listing application
          </p>
          <WalletModal>
            <button className="rounded border border-golden-beige/30 px-8 py-3.5 text-sm font-medium text-golden-beige transition-all hover:border-golden-beige/60 hover:shadow-gold-glow">
              Connect Wallet
            </button>
          </WalletModal>
        </div>
      </div>
    );
  }

  // Wallet connected — render the full application form
  return <ApplyForm walletAddress={address!} />;
}

/**
 * ── Apply Form ───────────────────────────────────────────
 * Controlled form component for submitting an asset listing.
 * Separated from the page component to keep wallet-gate logic
 * clean and ensure walletAddress is always defined here.
 */
function ApplyForm({ walletAddress }: { walletAddress: string }) {
  // ── Convex mutations ──
  const createSubmission = useMutation(api.submissions.create);
  const generateUploadUrl = useMutation(api.storage.generateUploadUrl);

  // ── Form state ──
  const [title, setTitle] = useState("");
  const [symbol, setSymbol] = useState("");
  const [assetType, setAssetType] = useState<string>("");
  const [brand, setBrand] = useState("");
  const [value, setValue] = useState("");
  const [reservePrice, setReservePrice] = useState("");
  const [story, setStory] = useState("");
  const [details, setDetails] = useState("");
  const [provenance, setProvenance] = useState("");
  const [hypeSentence, setHypeSentence] = useState("");

  // ── Contact info ──
  const [contactEmail, setContactEmail] = useState("");
  const [contactTelegram, setContactTelegram] = useState("");

  // ── Image file uploads ──
  // Each entry has a File (for preview) and optional storageId (after upload)
  const [imageFiles, setImageFiles] = useState<{ file: File; preview: string; storageId?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Submission lifecycle state ──
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Handle file selection — add to imageFiles with preview URL */
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const newEntries = files.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setImageFiles((prev) => [...prev, ...newEntries]);
    // Reset the input so the same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  /** Remove an image by index */
  const removeImage = (index: number) => {
    setImageFiles((prev) => {
      // Revoke the object URL to free memory
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  /** Upload all images to Convex storage, returns array of storage IDs */
  const uploadImages = async (): Promise<string[]> => {
    const storageIds: string[] = [];
    for (let i = 0; i < imageFiles.length; i++) {
      setUploadProgress(`Uploading image ${i + 1} of ${imageFiles.length}...`);
      // Step 1: Get a signed upload URL from Convex
      const uploadUrl = await generateUploadUrl();
      // Step 2: POST the file directly to that URL
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": imageFiles[i].file.type },
        body: imageFiles[i].file,
      });
      const { storageId } = await result.json();
      storageIds.push(storageId);
    }
    return storageIds;
  };

  /** Handle form submission — validate, upload images, call mutation */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (imageFiles.length === 0) {
      setError("At least one image is required.");
      return;
    }

    setIsSubmitting(true);

    try {
      // Upload images first, then create the submission with storage IDs
      const storageIds = await uploadImages();
      setUploadProgress("Creating submission...");

      await createSubmission({
        title,
        symbol: symbol.toUpperCase(),
        assetType,
        brand: brand || undefined,
        value: value || undefined,
        reservePrice: reservePrice || undefined,
        story: story || undefined,
        details: details || undefined,
        provenance: provenance || undefined,
        hypeSentence: hypeSentence || undefined,
        imageStorageIds: storageIds,
        walletAddress,
        contactEmail: contactEmail || undefined,
        contactTelegram: contactTelegram || undefined,
      });

      setIsSuccess(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgress("");
    }
  };

  // ── Success state — replaces the form with a confirmation card ──
  if (isSuccess) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-deep-charcoal">
        <div className="max-w-md rounded border border-golden-beige/15 bg-card-surface p-10 text-center">
          {/* Checkmark icon */}
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border border-deep-emerald/40 bg-deep-emerald/10">
            <svg
              className="h-7 w-7 text-deep-emerald"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="font-heading text-2xl text-golden-beige mb-3">
            Submission Received
          </h2>
          <p className="text-sm text-platinum-grey/60 leading-relaxed">
            Your submission is under review. Once approved, your asset will be
            listed on ACES.fun for trading. We'll notify you when there's an
            update.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-deep-charcoal">
      <div className="mx-auto max-w-2xl px-6 py-12 lg:px-10">
        {/* ── Page header ── */}
        <div className="mb-10">
          <p className="text-xs font-medium uppercase tracking-widest text-deep-emerald mb-2">
            Submit
          </p>
          <h1 className="font-heading text-4xl text-golden-beige">
            Apply to List Your Asset
          </h1>
          <p className="mt-3 text-platinum-grey/60">
            Submit your collectible for review. Once approved, it will be listed
            on ACES.fun for trading.
          </p>
        </div>

        {/* ── Submission form ── */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── Title (required) ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
              Title <span className="text-golden-beige/50">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 1969 Rolex Daytona Paul Newman"
              className={inputClass}
            />
          </div>

          {/* ── Symbol / Ticker (required, auto-uppercase) ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
              Symbol / Ticker <span className="text-golden-beige/50">*</span>
            </label>
            <input
              type="text"
              required
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              placeholder="e.g. DAYTONA"
              className={inputClass}
            />
          </div>

          {/* ── Asset Type (required select dropdown) ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
              Asset Type <span className="text-golden-beige/50">*</span>
            </label>
            <select
              required
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className={inputClass}
            >
              <option value="" disabled>
                Select asset type...
              </option>
              {ASSET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          {/* ── Brand (optional) ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
              Brand
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g. Rolex, Ferrari, Louis Vuitton"
              className={inputClass}
            />
          </div>

          {/* ── Value & Reserve Price — side by side on larger screens ── */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
                Estimated Value
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="$0"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
                Reserve Price
              </label>
              <input
                type="text"
                value={reservePrice}
                onChange={(e) => setReservePrice(e.target.value)}
                placeholder="$0"
                className={inputClass}
              />
            </div>
          </div>

          {/* ── Story (optional textarea) ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
              Story
            </label>
            <textarea
              rows={4}
              value={story}
              onChange={(e) => setStory(e.target.value)}
              placeholder="Why does this asset matter?"
              className={inputClass}
            />
          </div>

          {/* ── Details (optional textarea) ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
              Details
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Specs, dimensions, condition..."
              className={inputClass}
            />
          </div>

          {/* ── Provenance (optional textarea) ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
              Provenance
            </label>
            <textarea
              rows={3}
              value={provenance}
              onChange={(e) => setProvenance(e.target.value)}
              placeholder="Ownership history, authentication..."
              className={inputClass}
            />
          </div>

          {/* ── Hype Sentence (optional) ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
              Hype Sentence
            </label>
            <input
              type="text"
              value={hypeSentence}
              onChange={(e) => setHypeSentence(e.target.value)}
              placeholder="One-liner pitch for your asset"
              className={inputClass}
            />
          </div>

          {/* ── Contact Info — email and/or Telegram for follow-up ── */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
                Email
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
                Telegram
              </label>
              <input
                type="text"
                value={contactTelegram}
                onChange={(e) => setContactTelegram(e.target.value)}
                placeholder="@yourusername"
                className={inputClass}
              />
            </div>
          </div>

          {/* ── Image Upload — drag & drop or click to select files ── */}
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-platinum-grey/70">
              Images <span className="text-golden-beige/50">*</span>
            </label>

            {/* Hidden file input — triggered by the upload zone */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Upload zone — click to browse */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded border-2 border-dashed border-golden-beige/15 bg-card-surface px-6 py-8 text-center transition-colors hover:border-golden-beige/30"
            >
              <Upload className="mx-auto h-8 w-8 text-platinum-grey/30 mb-2" />
              <p className="text-sm text-platinum-grey/50">
                Click to upload images
              </p>
              <p className="text-xs text-platinum-grey/30 mt-1">
                JPG, PNG, WebP — max 10MB each
              </p>
            </button>

            {/* Image preview grid */}
            {imageFiles.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {imageFiles.map((entry, index) => (
                  <div key={index} className="relative group aspect-square rounded overflow-hidden border border-golden-beige/10">
                    <img
                      src={entry.preview}
                      alt={`Upload ${index + 1}`}
                      className="h-full w-full object-cover"
                    />
                    {/* Remove button — appears on hover */}
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-deep-charcoal/80 text-platinum-grey/60 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                    >
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Error message — shown below the form fields ── */}
          {error && (
            <div className="rounded border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* ── Submit button — golden-beige, disabled while submitting ── */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded bg-golden-beige px-8 py-3.5 text-sm font-medium text-deep-charcoal transition-all hover:bg-highlight-gold hover:shadow-gold-glow disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (uploadProgress || "Submitting...") : "Submit for Review"}
          </button>
        </form>
      </div>
    </div>
  );
}
