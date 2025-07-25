'use client';
import PhotoGallery from '@/components/old/asset/photo-gallery/photo-gallery';
import SwapInterface from '@/components/old/rwa/swap-interface';
import TokenGraph from '@/components/old/asset/token/token-graph';
import TokenInformation from '@/components/old/asset/token/token-information';
import ProductCarousel from '@/components/old/asset/product-carousel';
import OfferDrawer from '@/components/old/rwa/drawers/offer-drawer';
import CheckoutDrawer from '@/components/old/rwa/drawers/checkout-drawer';
import Footer from '@/components/ui/custom/footer';
import LaunchHeader from '@/components/new-launch/launch-header';
import AnimatedDotsBackground from '@/components/ui/custom/animated-dots-background';

// Import new modular components
import ProductInfoContainer from '@/components/old/asset/products/product-info-container';
import TokenInformationContainer from '@/components/old/asset/token/token-info-container';
import { tokenData } from '@/data/token-sample-data';

export default function ProductPage() {
  // Asset Details Data
  const assetDetails = [
    { label: 'Year:', value: '1991' },
    { label: 'Location:', value: 'Los Angeles, CA' },
    { label: 'Address:', value: '123 Main St, Los Angeles, CA 90001' },
    { label: 'Condition:', value: 'Mint' },
    { label: 'Mileage:', value: '59,000 km (~37,000 miles)' },
    { label: 'Engine:', value: '3.3L Turbocharged Flat-Six' },
    { label: 'Transmission:', value: '5-Speed G50 Manual' },
    { label: 'Color:', value: 'Rubystone Red (G4)' },
  ];

  // Seller Information Data
  const sellerInfo = {
    name: 'BLACKSTONE HERITAGE',
    initials: 'BH',
    listingCount: 3847,
    aboutText:
      "Established in 1987, Blackstone Heritage has been at the forefront of luxury asset acquisition and curation for over three decades. Based in the heart of Monaco, our boutique firm specializes in sourcing the world's most exclusive and historically significant collectibles, from rare vintage automobiles and limited-edition timepieces to contemporary art and precious metals. Our founder, Alexander Blackstone, began his career as a private curator for European nobility and has since built an unparalleled network of collectors, auction houses, and private dealers across six continents. We pride ourselves on our meticulous authentication process, comprehensive provenance research, and white-glove concierge services that ensure every transaction exceeds our clients' expectations. Our team of specialists includes certified appraisers, restoration experts, and market analysts who work together to identify and secure assets that not only represent exceptional craftsmanship but also demonstrate strong investment potential. From our climate-controlled facilities in Monaco, Geneva, and Dubai, we maintain one of the world's most prestigious private collections, carefully curated for discerning collectors who appreciate rarity, authenticity, and historical significance. Our clientele includes royal families, Fortune 500 executives, and internationally renowned collectors who trust us to identify opportunities that align with their sophisticated tastes and investment objectives.",
    details: [
      { label: 'Founded:', value: '1987' },
      { label: 'Headquarters:', value: 'Monaco, Monte Carlo' },
      { label: 'Last updated:', value: 'January 15, 2025' },
      { label: 'Member since:', value: 'March 2019' },
      { label: 'Specialization:', value: 'Luxury Collectibles & Investment Assets' },
    ],
  };

  // Handle question submission
  const handleQuestionSubmit = (message: string) => {
    console.log('Question submitted:', message);
    // Add your question submission logic here
    // Could be API call, email service, etc.
  };

  // About Asset Content (JSX)
  const aboutAssetContent = (
    <>
      <p className="text-white leading-relaxed mb-4 text-base">
        Presenting an exceptionally rare and highly sought-after{' '}
        <strong className="text-white ">1991 Porsche 911 (964) Turbo</strong> finished in{' '}
        <strong className="text-white">Rubystone Red (G4)</strong> — one of only{' '}
        <strong className="text-white">five factory paint-to-sample examples</strong> ever produced
        in this striking color worldwide. This collector-grade 964 Turbo is a European-spec (RoW)
        car that represents the pinnacle of early 1990s Porsche engineering, wrapped in a color that
        is as bold as it is iconic.
      </p>
      <p className="mb-4 text-base leading-relaxed text-white">
        Under the rear decklid lies Porsche&apos;s legendary{' '}
        <strong className="text-white">3.3-liter turbocharged flat-six</strong>, producing{' '}
        <strong className="text-white">320 horsepower and 332 lb-ft of torque</strong>, mated to a
        5-speed G50 manual transmission and rear-wheel drive. Originally derived from the 930 Turbo
        engine, the powertrain in the 964 Turbo delivers improved reliability, smoother power
        delivery, and modernized electronics, including Bosch Motronic management and ABS.
      </p>
      <p className="mb-4 text-base leading-relaxed text-white">
        The exterior showcases the classic widebody Turbo silhouette with its muscular arches,
        integrated fog lights, and the instantly recognizable &quot;whale tail&quot; rear spoiler.
        Factory <strong className="text-white">17&quot; Cup wheels</strong> complement the
        aggressive stance, while the <strong className="text-white">Rubystone Red paintwork</strong>{' '}
        elevates this example into a league of its own—instantly recognizable and beloved by
        enthusiasts for its daring originality.
      </p>
      <p className="mb-4 text-base leading-relaxed text-white">
        Inside, the cabin is appointed in <strong className="text-white">black leather</strong>,
        with <strong className="text-white">power-adjustable heated seats</strong>,{' '}
        <strong className="text-white">electric sunroof</strong>,{' '}
        <strong className="text-white">air conditioning</strong>, and a period-correct{' '}
        <strong className="text-white">Blaupunkt Symphony stereo</strong>. Every element remains
        faithful to the original specification, and the vehicle comes with its{' '}
        <strong className="text-white">Porsche Certificate of Authenticity</strong>, original
        stamped books, and matching numbers for engine and gearbox.
      </p>
      <p className="mb-4 text-base leading-relaxed text-white">
        This 964 Turbo has been <strong className="text-white">meticulously maintained</strong>,
        showing approximately{' '}
        <strong className="text-white">59,000 kilometers (~37,000 miles)</strong> on the odometer.
        It has undergone regular servicing and remains in superb mechanical and cosmetic condition
        throughout—including a well-preserved undercarriage and factory-correct finishes.
      </p>

      <h2 className="text-2xl font-semibold mt-10 mb-4 text-white">Highlights</h2>
      <ul className="list-disc list-inside space-y-2 text-base leading-relaxed text-white">
        <li>
          <strong className="text-white">Matching Numbers</strong> (engine, transaxle, and chassis
          verified by Porsche Certificate of Authenticity)
        </li>
        <li>
          <strong className="text-white">Factory Paint-to-Sample Color: Rubystone Red (G4)</strong>{' '}
          – 1 of only ~5 produced worldwide
        </li>
        <li>
          <strong className="text-white">3.3L Turbocharged Flat-Six Engine</strong> producing 320 hp
        </li>
        <li>
          <strong className="text-white">5-Speed G50 Manual Transmission</strong> with rear-wheel
          drive and limited-slip differential
        </li>
        <li>
          <strong className="text-white">European-Specification (RoW)</strong> model with 17&quot;
          Cup wheels and desirable lightweight features
        </li>
        <li>
          <strong className="text-white">Black Leather Interior</strong> with heated power seats and
          original Blaupunkt Symphony stereo
        </li>
        <li>
          <strong className="text-white">Porsche Stamped Book Pack & Service Records</strong>
        </li>
        <li>
          <strong className="text-white">Approximately 59,000 km (~37,000 miles)</strong> –
          low-mileage, collector-grade condition
        </li>
      </ul>

      <p className="mt-8 text-base leading-relaxed text-white">
        Offered today in fully documented, investment-grade condition, this Rubystone Red 964 Turbo
        is an exceptional opportunity to own one of the{' '}
        <strong className="text-white">
          rarest and most collectible air-cooled Porsche Turbos
        </strong>{' '}
        ever built. Whether added to a curated collection or enjoyed on the road, this is a car that
        celebrates Porsche&apos;s legacy in unmistakable style.
      </p>
    </>
  );

  return (
    <div className="min-h-screen relative">
      <AnimatedDotsBackground
        opacity={0.2}
        dotSpacing={32}
        dotSize={1}
        animationSpeed={0.8}
        waveType="radial"
        minOpacity={0.08}
        className="z-0"
      />
      <div className="relative z-10">
        <LaunchHeader />

        {/* Full-width Photo Gallery */}
        <div className="w-full">
          <PhotoGallery />
        </div>

        {/* Product Header */}
        <div className="max-w-7xl mx-auto px-2 md:px-4 lg:px-6 border border-[#D0B284]/30 rounded-xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2 py-6">
              1991 Porsche 964 Turbo Rubystone Red 1-of-5 Limited Edition Paint
            </h1>
            <div className="flex justify-between items-center">
              <p className="text-[#DCDDCC]">Los Angeles, CA</p>
              <p className="text-3xl font-bold text-white">$690,000</p>
            </div>
          </div>
        </div>

        {/* Main Content Area with Sticky Layout */}
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Scrollable Content (2/3 width) */}
            <div className="lg:col-span-2 space-y-8">
              {/* New Modular Product Information */}
              <ProductInfoContainer
                aboutAssetContent={aboutAssetContent}
                assetDetails={assetDetails}
                sellerInfo={sellerInfo}
                onQuestionSubmit={handleQuestionSubmit}
                // defaultOpen={true}
              />
              <TokenInformationContainer
                tokenGraph={<TokenGraph />}
                tokenInformation={<TokenInformation />}
                activity={tokenData.activity}
                holders={tokenData.holders}
                defaultOpen={false}
              />
            </div>

            {/* Right Column - Sticky Swap Interface (1/3 width) */}
            <div className="lg:col-span-1">
              <div className="sticky top-4 space-y-4 max-h-[calc(100vh-2rem)] overflow-y-auto pt-6">
                {/* Offer and Checkout Buttons */}
                <div className="bg-[#231f20]/50 rounded-xl p-4 border border-[#D0B284]/20">
                  <div className="flex gap-3 w-full">
                    <OfferDrawer
                      itemTitle="1991 Porsche 964 Turbo"
                      itemImage="/canvas-images/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp"
                      tokenAddress="0x7300...0219FE"
                      onOfferSubmit={(amount, duration) => {
                        console.log('Offer submitted:', { amount, duration });
                        // Add your offer submission logic here
                      }}
                    >
                      <button className="flex-1 rounded-xl border border-[#D0B284] px-8 py-1 text-sm font-bold bg-black text-[#D0B284] hover:bg-[#D0B284]/10 transition-colors whitespace-nowrap">
                        MAKE OFFER
                      </button>
                    </OfferDrawer>
                    <CheckoutDrawer
                      itemTitle="1991 Porsche 964 Turbo"
                      itemImage="/canvas-images/1991-Porsche-964-Turbo-Rubystone-Red-1-of-5-Limited-Edition-Paint.webp"
                      itemPrice="13.6849 ETH"
                      itemPriceUSD="$47K"
                      collectionName="ACES Collection"
                      onPurchase={(paymentMethod) => {
                        console.log('Purchase completed with:', paymentMethod);
                        // Add your purchase logic here
                      }}
                    >
                      <button className="flex-1 rounded-xl bg-[#D0B284] px-8 py-1 text-sm font-bold text-[#231F20] hover:bg-[#D0B284]/90 transition-colors whitespace-nowrap">
                        BUY NOW
                      </button>
                    </CheckoutDrawer>
                  </div>
                </div>

                <SwapInterface tokenSymbol="KRUGER" />
              </div>
            </div>
          </div>
        </div>

        {/* Product Carousel - Appears after scrolling past sticky content */}
        <div className="mt-16">
          <ProductCarousel />
        </div>
        <Footer />
      </div>
    </div>
  );
}
