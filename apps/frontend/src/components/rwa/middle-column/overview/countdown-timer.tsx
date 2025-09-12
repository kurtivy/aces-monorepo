'use client';

import { useState, useEffect } from 'react';

interface CountdownTimerProps {
  launchDate?: string | null;
}

export default function CountdownTimer({ launchDate }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  const [isLaunched, setIsLaunched] = useState(false);

  useEffect(() => {
    if (!launchDate) {
      setIsLaunched(true);
      return;
    }

    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const launchTime = new Date(launchDate).getTime();
      const difference = launchTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
        setIsLaunched(false);
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsLaunched(true);
      }
    };

    // Calculate immediately
    calculateTimeLeft();

    // Then update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [launchDate]);

  const timeUnits = [
    { value: timeLeft.days, label: 'Days', shortLabel: 'D' },
    { value: timeLeft.hours, label: 'Hours', shortLabel: 'H' },
    { value: timeLeft.minutes, label: 'Minutes', shortLabel: 'M' },
    { value: timeLeft.seconds, label: 'Seconds', shortLabel: 'S' },
  ];

  // If launched or no launch date, show "Available Now"
  if (isLaunched) {
    return (
      <div className="w-full flex flex-col items-center justify-center py-1.5 rounded-xl px-3 flex-1 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 rounded-xl" />
        <div className="relative z-10 text-center">
          <div className="text-2xl font-bold text-[#D0B284] mb-2">Available Now</div>
          <div className="text-sm text-[#DCDDCC]">This item is ready for trading</div>
        </div>
        <div className="absolute top-3 left-3 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
        <div className="absolute top-3 right-3 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
        <div className="absolute bottom-3 left-3 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
        <div className="absolute bottom-3 right-3 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
      </div>
    );
  }

  // Show countdown timer
  return (
    <div className="w-full flex flex-col items-center justify-center py-1.5 rounded-xl px-3 flex-1 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-0 rounded-xl" />
      <div className="relative z-10 grid grid-cols-4 gap-2.5 w-full max-w-sm">
        {timeUnits.map((unit) => (
          <div key={unit.label} className="flex flex-col items-center">
            <div className="bg-gradient-to-br from-[#D0B284]/5 via-transparent to-[#184D37]/5 border border-[#D0B284]/30 rounded-lg p-2.5 w-full aspect-square flex items-center justify-center shadow-lg backdrop-blur-sm relative group hover:border-[#D0B284]/60 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-[#D0B284]/10 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <span
                className="text-2xl font-bold text-white relative z-10 tabular-nums"
                style={{ fontFamily: 'system, serif' }}
              >
                {unit.value.toString().padStart(2, '0')}
              </span>

              <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#D0B284]/20 rounded-full" />
            </div>

            <span
              className="text-xs text-[#DCDDCC] mt-1.5 font-medium tracking-wide uppercase font-spray-letters"
              style={{ fontFamily: "'Spray Letters', cursive" }}
            >
              {unit.label}
            </span>
          </div>
        ))}
      </div>

      <div className="absolute top-3 left-3 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
      <div className="absolute top-3 right-3 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
      <div className="absolute bottom-3 left-3 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
      <div className="absolute bottom-3 right-3 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
    </div>
  );
}
