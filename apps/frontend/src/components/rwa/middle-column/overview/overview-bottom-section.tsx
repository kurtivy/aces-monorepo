'use client';

import CountdownTimer from './countdown-timer';
import ProgressionBar from './progression-bar';

export default function OverviewBottomSection() {
  return (
    <div className="flex-shrink-0 mt-2 space-y-2">
      {/* Countdown Timer */}
      <div className="h-32">
        <CountdownTimer />
      </div>

      {/* Progress Bar */}
      <div className="h-20">
        <ProgressionBar />
      </div>

      {/* Buy Presale Button */}
      <button className="w-full bg-gradient-to-r from-[#D0B284] to-[#D7BF75] hover:from-[#D7BF75] hover:to-[#D0B284] text-black font-bold py-4 px-8 rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">
        <span className="text-xl tracking-wider font-spray-letters">BUY PRESALE</span>
      </button>
    </div>
  );
}
