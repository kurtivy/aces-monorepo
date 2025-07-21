'use client';

import { useState, useEffect } from 'react';

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({
    days: 12,
    hours: 10,
    minutes: 23,
    seconds: 45,
  });

  // Optional: Add real countdown functionality
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: prev.minutes - 1, seconds: 59 };
        } else if (prev.hours > 0) {
          return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        } else if (prev.days > 0) {
          return { ...prev, days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, []);

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
      <div className="relative z-10 grid grid-cols-4 gap-3 w-full max-w-md">
        {timeUnits.map((unit) => (
          <div key={unit.label} className="flex flex-col items-center">
            {/* Time Value Tile */}
            <div className="bg-gradient-to-br from-[#D0B284]/5 via-transparent to-[#184D37]/5 border border-[#D0B284]/30 rounded-lg p-3 w-full aspect-square flex items-center justify-center shadow-lg backdrop-blur-sm relative group hover:border-[#D0B284]/60 transition-all duration-300">
              {/* Inner glow effect */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#D0B284]/10 to-transparent rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

              <span
                className="text-3xl font-bold text-white relative z-10 tabular-nums"
                style={{ fontFamily: 'system, serif' }}
              >
                {unit.value.toString().padStart(2, '0')}
              </span>

              {/* Subtle corner accent */}
              <div className="absolute top-1 right-1 w-2 h-2 bg-[#D0B284]/20 rounded-full" />
            </div>

            {/* Label */}
            <span
              className="text-sm text-[#DCDDCC] mt-2 font-medium tracking-wide uppercase"
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
