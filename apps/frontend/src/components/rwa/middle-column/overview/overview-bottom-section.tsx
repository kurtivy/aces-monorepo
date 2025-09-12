'use client';

import CountdownTimer from './countdown-timer';
import ProgressionBar from './progression-bar';

interface OverviewBottomSectionProps {
  launchDate?: string | null;
}

export default function OverviewBottomSection({ launchDate }: OverviewBottomSectionProps) {
  return (
    <div className="flex-shrink-0 mt-2 space-y-2">
      {/* Countdown Timer */}
      <div className="h-32">
        <CountdownTimer launchDate={launchDate} />
      </div>

      {/* Progress Bar */}
      <div className="h-20">
        <ProgressionBar />
      </div>
    </div>
  );
}
