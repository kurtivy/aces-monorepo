"use client"

interface ProgressionBarProps {
  currentAmount?: number
  targetAmount?: number
  percentage?: number
}

export default function ProgressionBar({
  currentAmount = 268820,
  targetAmount = 1000000,
  percentage = 26.9,
}: ProgressionBarProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  return (
    <div className="w-full flex flex-col items-center justify-center rounded-xl px-6 py-2 flex-1 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 rounded-xl" />
      <div className="absolute inset-0 rounded-xl" />

      <div className="relative z-10 w-full flex flex-col items-center justify-center space-y-4">
        <div className="bg-gradient-to-br from-[#231F20] to-[#1a1718] border-2 border-[#D0B284]/40 rounded-xl px-4 py-2 shadow-xl backdrop-blur-sm relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[#D0B284]/10 to-transparent rounded-xl" />

          <span
            className="text-[#D7BF75] text-lg font-bold min-w-[52px] text-center block tabular-nums relative z-10"
            style={{ fontFamily: "JetBrains Mono, monospace" }}
          >
            {percentage.toFixed(1)}%
          </span>

          <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#D0B284]/40 rounded-full" />
        </div>

        <div className="flex items-center w-[510px] justify-center">
          <div className="relative w-full h-6 group">
            <div className="relative h-full bg-gradient-to-r from-[#231F20] to-[#1a1718] rounded-full border border-[#D0B284]/20 shadow-2xl overflow-hidden">
              <div className="absolute inset-0.5 bg-gradient-to-r from-[#0f0d0e] to-[#231F20] rounded-full shadow-inner">
                <div className="absolute inset-0 flex items-center">
                  {[25, 50, 75].map((milestone) => (
                    <div
                      key={milestone}
                      className="absolute w-0.5 h-3 bg-[#D0B264]/30 rounded-full"
                      style={{ left: `${milestone}%`, transform: "translateX(-50%)" }}
                    />
                  ))}
                </div>

                <div
                  className="absolute left-0.5 top-0.5 bottom-0.5 rounded-full shadow-lg transition-all duration-1000 ease-out overflow-hidden"
                  style={{
                    width: `calc(${Math.min(percentage, 100)}% - 2px)`,
                    background: `linear-gradient(90deg, 
                      #184D37 0%, 
                      #928357 25%, 
                      #D0B284 50%, 
                      #D7BF75 75%, 
                      #D0B284 100%
                    )`,
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-pulse opacity-60" />
                  <div className="absolute right-0 top-0 w-4 h-full bg-gradient-to-l from-[#D7BF75]/80 to-transparent" />
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-white/20 to-white/10 rounded-full" />
                </div>

                <div
                  className="absolute top-1/2 w-5 h-5 bg-gradient-to-br from-[#D7BF75] to-[#D0B284] rounded-full shadow-lg border-2 border-white/20 transition-all duration-1000 ease-out transform -translate-y-1/2"
                  style={{ left: `calc(${Math.min(percentage, 100)}% - 6px)` }}
                >
                  <div className="absolute inset-0.5 bg-gradient-to-br from-[#D7BF75] to-[#D0B284] rounded-full animate-pulse" />
                </div>
              </div>

              <div className="absolute inset-0 rounded-full shadow-[0_0_20px_rgba(208,178,132,0.3)] opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </div>

            <div
              className="absolute -bottom-6 w-full flex justify-between text-xs text-[#DCDDCC]/60"
              style={{ fontFamily: "JetBrains Mono, monospace" }}
            >
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
