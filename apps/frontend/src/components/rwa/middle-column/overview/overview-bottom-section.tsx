'use client';

import ProgressionBar from './progression-bar';
import ScoreboardSplitFlap from './scorebaord-split-flap';

interface OverviewBottomSectionProps {
  launchDate?: string | null;
  showProgression?: boolean;
  progressionPercentage?: number;
  showProgressionDesktopOnly?: boolean;
}

export default function OverviewBottomSection({
  launchDate,
  showProgression = true,
  progressionPercentage = 26.9,
  showProgressionDesktopOnly = false,
}: OverviewBottomSectionProps) {
  return (
    <div className="w-full space-y-6">
      <div className="w-full">
        <ScoreboardSplitFlap launchDate={launchDate} />
      </div>

      {showProgression && (
        <div className="space-y-3">
          <div className={showProgressionDesktopOnly ? 'hidden lg:block' : ''}>
            <ProgressionBar percentage={progressionPercentage} />
            <div className="text-xs font-semibold uppercase tracking-[0.3em] text-center text-[#D7BF75]/80">
              Bonded {progressionPercentage}% / 100%
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
