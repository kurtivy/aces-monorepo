"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

const assetDetails = [
  { label: "Year:", value: "1991" },
  { label: "Location:", value: "Los Angeles, CA" },
  { label: "Address:", value: "123 Main St, Los Angeles, CA 90001" },
  { label: "Condition:", value: "Mint" },
  { label: "Mileage:", value: "59,000 km (~37,000 miles)" },
  { label: "Engine:", value: "3.3L Turbocharged Flat-Six" },
  { label: "Transmission:", value: "5-Speed G50 Manual" },
  { label: "Color:", value: "Rubystone Red (G4)" },
]

export default function AssetAboutDetails() {
  const [isExpanded, setIsExpanded] = useState(false)

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="space-y-8">
      {/* About This Asset Section */}
      <div className="bg-[#231F20] rounded-lg border border-[#D0B284]/20 p-6">
        <h2 className="text-white text-2xl font-bold mb-6">About This Asset</h2>

        <div className="space-y-4">
          {/* Scrollable content container */}
          <div
            className={`overflow-y-auto pr-2 space-y-4 scrollbar-thin scrollbar-thumb-[#D0B284] scrollbar-track-[#231F20] transition-all duration-300 ${
              isExpanded ? "max-h-96" : "max-h-32"
            }`}
          >
            {/* Always visible content */}
            <p className="text-white leading-relaxed mb-4 text-base">
              Presenting an exceptionally rare and highly sought-after{" "}
              <strong className="text-white">1991 Porsche 911 (964) Turbo</strong> finished in{" "}
              <strong className="text-white">Rubystone Red (G4)</strong> — one of only{" "}
              <strong className="text-white">five factory paint-to-sample examples</strong> ever produced in this
              striking color worldwide. This collector-grade 964 Turbo is a European-spec (RoW) car that represents the
              pinnacle of early 1990s Porsche engineering, wrapped in a color that is as bold as it is iconic.
            </p>

            {/* Additional content that becomes visible when expanded */}
            <p className="mb-4 text-base leading-relaxed text-white">
              Under the rear decklid lies Porsche&apos;s legendary{" "}
              <strong className="text-white">3.3-liter turbocharged flat-six</strong>, producing{" "}
              <strong className="text-white">320 horsepower and 332 lb-ft of torque</strong>, mated to a 5-speed G50
              manual transmission and rear-wheel drive. Originally derived from the 930 Turbo engine, the powertrain in
              the 964 Turbo delivers improved reliability, smoother power delivery, and modernized electronics,
              including Bosch Motronic management and ABS.
            </p>

            <p className="mb-4 text-base leading-relaxed text-white">
              The exterior showcases the classic widebody Turbo silhouette with its muscular arches, integrated fog
              lights, and the instantly recognizable &quot;whale tail&quot; rear spoiler. Factory{" "}
              <strong className="text-white">17&quot; Cup wheels</strong> complement the aggressive stance, while the{" "}
              <strong className="text-white">Rubystone Red paintwork</strong> elevates this example into a league of its
              own—instantly recognizable and beloved by enthusiasts for its daring originality.
            </p>

            <p className="mb-4 text-base leading-relaxed text-white">
              The interior features the classic 964 Turbo cabin with sport seats, a leather-wrapped steering wheel, and
              the distinctive Turbo gauge cluster. Every detail has been meticulously maintained, from the original
              radio to the pristine door panels and carpeting.
            </p>

            <p className="mb-4 text-base leading-relaxed text-white">
              This particular example has been garage-kept and driven sparingly, resulting in exceptional preservation
              of both mechanical and cosmetic elements. The paint shows no signs of fade or oxidation, and the interior
              remains supple and crack-free.
            </p>

            <p className="text-base leading-relaxed text-white">
              With only 59,000 kilometers on the odometer and comprehensive service records, this 964 Turbo represents a
              rare opportunity to own one of the most desirable and collectible Porsches ever made, finished in the most
              exclusive color available.
            </p>
          </div>

          {/* Read More/Less Button */}
          <button
            onClick={toggleExpanded}
            className="flex items-center gap-2 text-[#D0B284] hover:text-[#D7BF75] transition-colors duration-200 text-sm font-medium"
          >
            {isExpanded ? (
              <>
                <span>view less</span>
                <ChevronUp size={16} />
              </>
            ) : (
              <>
                <span>view more</span>
                <ChevronDown size={16} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Asset Details Section */}
      <div className="bg-[#231F20] rounded-lg border border-[#D0B284]/20 p-6">
        <h2 className="text-white text-2xl font-bold mb-6">Asset Details</h2>

        <div className="space-y-4">
          {assetDetails.map((detail, index) => (
            <div
              key={index}
              className="flex justify-between items-start py-2 border-b border-[#D0B284]/10 last:border-b-0"
            >
              <span className="text-[#DCDDCC] text-base font-medium min-w-[120px]">{detail.label}</span>
              <span className="text-white text-base font-medium text-right flex-1">{detail.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
