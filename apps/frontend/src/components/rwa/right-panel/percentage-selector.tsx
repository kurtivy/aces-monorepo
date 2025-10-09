'use client';

import { useState, useEffect, useRef } from 'react';

interface PercentageSelectorProps {
  balance: string;
  onAmountCalculated: (amount: string, percentage: number | null) => void;
  currentAmount?: string;
  className?: string;
}

export function PercentageSelector({
  balance,
  onAmountCalculated,
  currentAmount = '',
  className = '',
}: PercentageSelectorProps) {
  const [selectedPercentage, setSelectedPercentage] = useState<number | null>(null);
  const lastCalculatedAmount = useRef<string>('');

  // Reset selection when amount changes externally (manual input)
  useEffect(() => {
    if (currentAmount !== lastCalculatedAmount.current && selectedPercentage !== null) {
      setSelectedPercentage(null);
    }
  }, [currentAmount, selectedPercentage]);

  const handlePercentageClick = (percentage: number) => {
    // Toggle off if clicking the same button
    if (selectedPercentage === percentage) {
      setSelectedPercentage(null);
      onAmountCalculated('', null);
      lastCalculatedAmount.current = '';
      return;
    }

    // Just update the UI state for now - balance calculation commented out for testing
    setSelectedPercentage(percentage);
    onAmountCalculated('', percentage);
    lastCalculatedAmount.current = '';

    /* BALANCE CALCULATION - COMMENTED OUT FOR UI TESTING
    const balanceNum = Number.parseFloat(balance);

    if (balanceNum > 0) {
      const calculatedAmount = (balanceNum * percentage) / 100;
      const amountStr = calculatedAmount.toString();
      lastCalculatedAmount.current = amountStr;
      setSelectedPercentage(percentage);
      onAmountCalculated(amountStr, percentage);
    }
    */
  };

  return (
    <>
      <style jsx>{`
        @keyframes glitch {
          0%,
          100% {
            transform: translate(0);
          }
          20% {
            transform: translate(-2px, 2px);
          }
          40% {
            transform: translate(-2px, -2px);
          }
          60% {
            transform: translate(2px, 2px);
          }
          80% {
            transform: translate(2px, -2px);
          }
        }

        @keyframes glitchBlock {
          0%,
          100% {
            clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
          }
          50% {
            clip-path: polygon(0 60%, 100% 60%, 100% 100%, 0 100%);
          }
        }

        .glitch-btn-active {
          animation: glitch 0.3s infinite;
          text-shadow:
            2px 0 0 rgba(255, 0, 100, 0.7),
            -2px 0 0 rgba(0, 255, 255, 0.7);
        }

        .glitch-btn-active::before {
          content: attr(data-text);
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          clip-path: polygon(0 0, 100% 0, 100% 45%, 0 45%);
          animation: glitchBlock 0.4s infinite;
          z-index: -1;
        }
      `}</style>

      <div className={`flex gap-0 border-b-2 border-[#222] ${className}`}>
        {[25, 50, 75].map((percentage) => (
          <button
            key={percentage}
            type="button"
            onClick={() => handlePercentageClick(percentage)}
            className={`
              flex-1 relative px-5 py-4
              bg-transparent border-none
              text-[15px] font-semibold
              cursor-pointer transition-all duration-300
              ${
                selectedPercentage === percentage
                  ? 'text-[#d4af37]'
                  : 'text-[#666] hover:text-[#d4af37]'
              }
              after:content-[''] after:absolute after:bottom-[-2px] after:h-[3px]
              after:bg-gradient-to-r after:from-[#d4af37] after:via-[#f4e5a6] after:to-[#d4af37]
              after:transition-all after:duration-300
              ${
                selectedPercentage === percentage
                  ? 'after:left-0 after:right-0 after:shadow-[0_0_15px_rgba(212,175,55,0.7)]'
                  : 'after:left-1/2 after:right-1/2'
              }
            `}
          >
            {percentage}%
          </button>
        ))}
        <button
          type="button"
          onClick={() => handlePercentageClick(100)}
          data-text="APE"
          className={`
            flex-1 relative px-5 py-4
            bg-transparent border-none
            text-[15px] font-bold
            cursor-pointer transition-all duration-300
            ${
              selectedPercentage === 100
                ? 'text-[#d4af37] glitch-btn-active'
                : 'text-[#666] hover:text-[#d4af37]'
            }
            after:content-[''] after:absolute after:bottom-[-2px] after:h-[3px]
            after:bg-gradient-to-r after:from-[#d4af37] after:via-[#f4e5a6] after:to-[#d4af37]
            after:transition-all after:duration-300
            ${
              selectedPercentage === 100
                ? 'after:left-0 after:right-0 after:shadow-[0_0_15px_rgba(212,175,55,0.7)]'
                : 'after:left-1/2 after:right-1/2'
            }
          `}
        >
          APE
        </button>
      </div>
    </>
  );
}
