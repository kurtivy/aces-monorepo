'use client';

import ScoreboardSplitFlap from './scorebaord-split-flap';

interface OverviewBottomSectionProps {
  launchDate?: string | null;
}

export default function OverviewBottomSection({ launchDate }: OverviewBottomSectionProps) {
  return (
    <div className="w-full">
      {/* Countdown Timer - Fixed height and proper positioning */}
      <div className="w-full">
        <ScoreboardSplitFlap launchDate={launchDate} />
      </div>
    </div>
  );
}
