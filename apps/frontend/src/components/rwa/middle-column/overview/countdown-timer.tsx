'use client';

import { useState, useEffect } from 'react';

export default function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({
    days: 12,
    hours: 10,
    minutes: 23,
    seconds: 45,
  });

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
