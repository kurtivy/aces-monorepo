"use client"

import { useState } from "react"
import Image from "next/image"
import { Copy, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface PlaceBidsInterfaceProps {
  itemTitle?: string
  itemImage?: string
  tokenAddress?: string
  retailPrice?: number
  topOffer?: number
  onOfferSubmit?: (offerAmount: number, duration: number) => void
}

export default function PlaceBidsInterface({
  itemTitle = "King Solomon's Baby",
  itemImage = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/1-XLO1yYFWUAiJQZnkumrWt6GLOfTUV0.jpeg",
  tokenAddress = "0x7300...0219FE",
  retailPrice = 47000,
  topOffer = 45200,
  onOfferSubmit,
}: PlaceBidsInterfaceProps) {
  const [offerAmount, setOfferAmount] = useState("")
  const [duration, setDuration] = useState(30)

  const handleTopOfferClick = () => {
    setOfferAmount(topOffer.toString())
  }

  const handleSubmit = () => {
    const amount = Number.parseFloat(offerAmount)
    if (amount > 0 && onOfferSubmit) {
      onOfferSubmit(amount, duration)
      setOfferAmount("")
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const calculateFloorDifference = () => {
    const amount = Number.parseFloat(offerAmount) || 0
    const difference = amount - topOffer
    return difference > 0 ? `+$${difference.toLocaleString()}` : `-$${Math.abs(difference).toLocaleString()}`
  }

  return (
    <div className="bg-black border border-[#D0B284]/20 rounded-lg">
      <div className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Section - Item Details */}
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-semibold text-white">Item Details</h2>

            {/* Item Details with Price on Same Line */}
            <div className="flex items-center justify-between p-3 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-[#D0B284]/20">
                  <Image
                    src={itemImage || "/placeholder.svg"}
                    alt={itemTitle}
                    width={64}
                    height={64}
                    className="object-cover"
                  />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-white">{itemTitle}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-[#DCDDCC]">{tokenAddress}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 hover:bg-[#D0B284]/10"
                      onClick={() => copyToClipboard(tokenAddress)}
                    >
                      <Copy className="h-3 w-3 text-[#D0B284]" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-white">${retailPrice.toLocaleString()}</div>
                <div className="text-xs text-[#DCDDCC]">Retail Price</div>
              </div>
            </div>

            {/* Price Details */}
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
                <span className="text-sm text-[#DCDDCC]">Top Offer</span>
                <div className="text-right">
                  <div className="text-sm font-medium text-white">${topOffer.toLocaleString()}</div>
                  <div className="text-xs text-[#DCDDCC]">Current Best</div>
                </div>
              </div>
            </div>
          </div>

          {/* Vertical Divider - Only visible on large screens */}
          <div className="hidden lg:block w-px bg-[#D0B284]/20 mx-3 self-stretch"></div>

          {/* Right Section - Offer Input */}
          <div className="flex-1 space-y-4">
            <h2 className="text-lg font-semibold text-white">MAKE OFFER</h2>

            {/* Offer Amount Input - Single Row */}
            <div className="p-4 rounded-lg border border-[#D0B284]/20 bg-[#231F20]/60">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-[#DCDDCC] whitespace-nowrap">Your Offer</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  className="flex-1 h-10 text-sm bg-[#231F20] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC]"
                />
                <span className="text-sm text-[#DCDDCC] whitespace-nowrap">USD</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleTopOfferClick}
                  className="border border-[#D0B284]/80 text-[#D0B284] hover:text-[#D0B284] hover:bg-[#D0B284]/30 text-xs whitespace-nowrap"
                >
                  Set to Top Offer
                </Button>
              </div>
            </div>

            {/* Summary Section */}
            <div className="space-y-3 border-t border-[#D0B284]/20 pt-4 pl-12">
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Total offer value:</span>
                <span className="text-white">
                  ${offerAmount ? Number.parseFloat(offerAmount).toLocaleString() : "0.00"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Floor difference:</span>
                <span className="text-white">{offerAmount ? calculateFloorDifference() : "-"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Platform fees:</span>
                <span className="text-white">$0.00</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#DCDDCC]">Total est. proceeds:</span>
                <span className="text-white">
                  ${offerAmount ? Number.parseFloat(offerAmount).toLocaleString() : "0.00"}
                </span>
              </div>
            </div>

            {/* Duration and Submit */}
            <div className="space-y-3 pt-4 pl-12">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#DCDDCC]">Offer duration:</span>
                <div className="relative">
                  <select
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="appearance-none rounded border border-[#D0B284]/20 bg-[#231F20] px-3 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#D0B284]"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-[#D0B284] pointer-events-none" />
                </div>
              </div>

              <div className="flex justify-end py-6">
                <Button
                  onClick={handleSubmit}
                  disabled={!offerAmount || Number.parseFloat(offerAmount) <= 0}
                  className="w-32 bg-[#D0B284] hover:bg-[#D0B284]/90 text-[#231F20] font-bold"
                >
                  Review Offer
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
