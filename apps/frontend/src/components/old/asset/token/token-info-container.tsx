'use client';
import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import TokenMetrics from './token-metrics';
import TokenActivity from './token-activity';

interface ActivityEvent {
  event: string;
  price: number;
  from: string;
  to: string;
  time: string;
}

interface Holder {
  rank: number;
  address: string;
  percentage: number;
  amount: number;
  value: number;
  txns: number;
  exp: string;
}

interface TokenInformationContainerProps {
  tokenGraph: React.ReactNode;
  tokenInformation: React.ReactNode;
  activity: ActivityEvent[];
  holders: Holder[];
  defaultOpen?: boolean;
  className?: string;
}

export default function TokenInformationContainer({
  tokenGraph,
  tokenInformation,
  activity = [],
  holders = [],
  defaultOpen = true,
  className = '',
}: TokenInformationContainerProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center space-x-2 p-4 ">
        <label
          htmlFor="show-analytics"
          className="text-2xl font-bold text-[#D0B284] hover:text-[#D0B284]/90 transition-colors duration-200 cursor-pointer font-libre-caslon"
        >
          Here to trade? Check box to view token analytics
        </label>
        <Checkbox
          id="show-analytics"
          checked={isOpen}
          onCheckedChange={(checked) => setIsOpen(checked as boolean)}
          className="w-6 h-6 border-2 border-[#D0B284] data-[state=checked]:bg-[#D0B284] data-[state=checked]:text-[#231F20]"
        />
      </div>

      {isOpen && (
        <div className="mt-6 animate-in slide-in-from-top-2 duration-300">
          {/* Token Graph */}
          <TokenMetrics>{tokenGraph}</TokenMetrics>

          {/* Token Information/Metrics */}
          <TokenMetrics>{tokenInformation}</TokenMetrics>

          {/* Token Activity (Activity + Holders Tabs) */}
          <TokenActivity activity={activity} holders={holders} />
        </div>
      )}
      <div className="border-b bg-transparent border-[#D0B284]/30  mt-6"></div>
    </div>
  );
}
