'use client';

import { useState, useEffect } from 'react';

export default function CountdownTimer() {
  // Calculate next Tuesday dynamically
  const getNextTuesday = () => {
    const now = new Date();
    const nextTuesday = new Date(now);

    // Get days until next Tuesday (2 = Tuesday, 0 = Sunday)
    const daysUntilTuesday = (2 + 7 - now.getDay()) % 7;
    // If today is Tuesday, target next Tuesday (7 days)
    const daysToAdd = daysUntilTuesday === 0 ? 7 : daysUntilTuesday;

    nextTuesday.setDate(now.getDate() + daysToAdd);
    nextTuesday.setHours(0, 0, 0, 0); // Set to start of day

    return nextTuesday;
  };

  const [targetDate] = useState(getNextTuesday);
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      const difference = targetDate.getTime() - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
      } else {
        // Timer has reached zero
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      }
    };

    // Calculate initial time
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [targetDate]);

  const timeUnits = [
    { value: timeLeft.days, label: 'Days', shortLabel: 'D' },
    { value: timeLeft.hours, label: 'Hours', shortLabel: 'H' },
    { value: timeLeft.minutes, label: 'Minutes', shortLabel: 'M' },
    { value: timeLeft.seconds, label: 'Seconds', shortLabel: 'S' },
  ];

  return (
    <div className="w-full flex flex-col items-center justify-center py-2 rounded-xl px-4  flex-1 shadow-2xl relative overflow-hidden">
      {/* Subtle background texture/glow */}
      <div className="absolute inset-0   rounded-xl" />
      {/* Time Display Grid */}
      <div className="relative z-10 grid grid-cols-4 gap-2 sm:gap-3 w-full max-w-md">
        {timeUnits.map((unit) => (
          <div key={unit.label} className="flex flex-col items-center">
            {/* Time Value Tile */}
            <div className="bg-gradient-to-br from-[#D0B284]/5 via-transparent to-[#184D37]/5 border border-[#D0B284]/30 rounded-lg p-2 sm:p-3 w-full aspect-square flex items-center justify-center shadow-lg backdrop-blur-sm relative group hover:border-[#D0B284]/60 transition-all duration-300">
              {/* Inner glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#D0B284]/10 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <span
                className="text-2xl sm:text-3xl font-bold text-white relative z-10 tabular-nums"
                style={{ fontFamily: 'system, serif' }}
              >
                {unit.value.toString().padStart(2, '0')}
              </span>

              {/* Subtle corner accent */}
              <div className="absolute top-1 right-1 w-2 h-2 bg-[#D0B284]/20 rounded-full" />
            </div>

            {/* Label */}
            <span
              className="text-xs sm:text-sm text-[#DCDDCC] mt-1 sm:mt-2 font-medium tracking-wide uppercase"
              style={{ fontFamily: 'system, serif' }}
            >
              {unit.label}
            </span>
          </div>
        ))}
      </div>

      {/* Decorative elements */}
      <div className="absolute top-4 left-4 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
      <div className="absolute top-4 right-4 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
      <div className="absolute bottom-4 left-4 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
      <div className="absolute bottom-4 right-4 w-1 h-1 bg-[#D0B284]/40 rounded-full" />
    </div>
  );
}
