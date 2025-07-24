import { useEffect, useState } from 'react';

interface CountdownTimerProps {
  targetDate: Date;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const calculateTimeLeft = (targetDate: Date): TimeLeft => {
  const difference = +targetDate - +new Date();
  let timeLeft: TimeLeft = {
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  };

  if (difference > 0) {
    timeLeft = {
      days: Math.floor(difference / (1000 * 60 * 60 * 24)),
      hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((difference / 1000 / 60) % 60),
      seconds: Math.floor((difference / 1000) % 60),
    };
  }

  return timeLeft;
};

export default function CountdownTimer({ targetDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft(targetDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft(targetDate));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const timeUnits = [
    { value: timeLeft.days, label: 'DAYS' },
    { value: timeLeft.hours, label: 'HOURS' },
    { value: timeLeft.minutes, label: 'MINUTES' },
    { value: timeLeft.seconds, label: 'SECONDS' },
  ];

  return (
    <div className="flex justify-center gap-2 sm:gap-3 my-4 sm:my-6">
      {timeUnits.map(({ value, label }) => (
        <div
          key={label}
          className="flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm border border-[#D0B264]/20 rounded-lg p-2 sm:p-3 min-w-[60px] sm:min-w-[70px]"
        >
          <span className="text-xl sm:text-2xl font-bold text-[#D0B264] font-syne">
            {value.toString().padStart(2, '0')}
          </span>
          <span className="text-[8px] sm:text-[10px] text-[#FFFFFF]/60 font-jetbrains-mono tracking-wider mt-1">
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
