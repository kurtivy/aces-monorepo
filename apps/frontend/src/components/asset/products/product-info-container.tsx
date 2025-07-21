'use client';
import AssetInformation from './asset-info';
import SellerInformation from './seller-info';

interface ProductInfoContainerProps {
  aboutAssetContent: React.ReactNode;
  assetDetails: Array<{ label: string; value: string }>;
  sellerInfo: {
    name: string;
    initials: string;
    listingCount: number;
    aboutText: string;
    details: Array<{
      label: string;
      value: string;
      isButton?: boolean;
      onClick?: () => void;
    }>;
  };
  onQuestionSubmit: (message: string) => void;
  className?: string;
}

export default function ProductInfoContainer({
  aboutAssetContent,
  assetDetails,
  sellerInfo,
  onQuestionSubmit,
  className = '',
}: ProductInfoContainerProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-6">
        {/* Asset Information (About + Details combined) */}
        <AssetInformation aboutContent={aboutAssetContent} details={assetDetails} />

        <div className="border-b bg-transparent border-[#D0B284]/30  mt-6"></div>

        {/* Seller Information (includes contact form) */}
        <SellerInformation
          name={sellerInfo.name}
          initials={sellerInfo.initials}
          listingCount={sellerInfo.listingCount}
          aboutText={sellerInfo.aboutText}
          details={sellerInfo.details}
          onQuestionSubmit={onQuestionSubmit}
        />
      </div>
    </div>
  );
}
