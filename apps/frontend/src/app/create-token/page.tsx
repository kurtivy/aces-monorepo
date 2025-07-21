'use client';

import React from 'react';
import NavMenu from '../../components/ui/custom/nav-menu';
import BackButton from '../../components/ui/custom/back-button';

export default function CreateTokenPage() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
      <NavMenu />
      <BackButton />

      <div className="max-w-3xl w-full bg-[#231F20] rounded-lg shadow-lg p-8 space-y-6 border border-[#D0B264]/40">
        <h1 className="text-4xl font-heading font-bold text-[#D0B264] text-center mb-4">
          RWA Submission Form
        </h1>
        <p className="text-lg font-system text-center text-gray-300 mb-8">
          Hey, while we haven&apos;t officially launched yet, if you have a high-value Real-World
          Asset (RWA) that you would like to tokenize, submit a form here and maybe you can be part
          of our launch!
        </p>
        <div className="w-full bg-[#231F20] rounded-md overflow-hidden">
          <iframe
            src="https://docs.google.com/forms/d/e/1FAIpQLSekLEgB9YTAEpr6rDmN6RD3VxziBP-u-EQbeXZbQh0xVzl3Og/viewform?embedded=true"
            style={{ width: '100%', height: '1360px' }}
            frameBorder={0}
            marginHeight={0}
            marginWidth={0}
          >
            Loading…
          </iframe>
        </div>{' '}
        {/* Closing div added here */}
        <p className="text-sm font-system text-center text-gray-300 mt-8">
          We will review your submission and get back to you if your RWA is a good fit for Aces.fun.
        </p>
      </div>
    </div>
  );
}
