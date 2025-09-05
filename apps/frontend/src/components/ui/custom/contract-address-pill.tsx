'use client';

import React, { memo, useState } from 'react';

const ContractAddressPillComponent: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const contractAddress = '0x55337650856299363c496065C836B9C6E9dE0367';
  const truncatedAddress = `${contractAddress.slice(0, 6)}...${contractAddress.slice(-4)}`;

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(contractAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = contractAddress;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      <div
        className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-full bg-black/80 border border-[#D0B264]/40 flex items-center gap-2 cursor-pointer hover:bg-black/90 hover:border-[#D0B264]/60 transition-all duration-300"
        onClick={handleCopyAddress}
        title={`Click to copy: ${contractAddress}`}
      >
        <span className="text-xs font-medium text-[#D0B264] whitespace-nowrap">CA:</span>
        <span className="text-xs font-medium text-white whitespace-nowrap font-mono">
          {truncatedAddress}
        </span>
      </div>

      {/* Copy feedback */}
      {copied && (
        <div className="fixed bottom-16 right-4 z-50 px-2 py-1 rounded bg-[#D0B264] text-white text-xs font-medium whitespace-nowrap">
          Copied!
        </div>
      )}
    </>
  );
};

const ContractAddressPill = memo(ContractAddressPillComponent);

export default ContractAddressPill;
