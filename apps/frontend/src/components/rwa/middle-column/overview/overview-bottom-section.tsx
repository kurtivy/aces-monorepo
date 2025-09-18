'use client';

// import CountdownTimer from './countdown-timer';
// import ScoreboardCountdown from './scoreboard-countdown';
import ScoreboardSplitFlap from './scorebaord-split-flap';
// import ProgressionBar from './progression-bar';

interface OverviewBottomSectionProps {
  launchDate?: string | null;
}

export default function OverviewBottomSection({ launchDate }: OverviewBottomSectionProps) {
  return (
    <div className="flex-shrink-0 bg-transparent mt-2">
      {/* Countdown Timer */}
      <div className="h-32">
        {/* <CountdownTimer launchDate={launchDate} /> */}
        {/* <ScoreboardCountdown launchDate={launchDate} /> */}
        <ScoreboardSplitFlap launchDate={launchDate} />
      </div>

      {/* Progress Bar */}
      {/* <div className="h-20">
        <ProgressionBar />
      </div> */}
    </div>
  );
}
