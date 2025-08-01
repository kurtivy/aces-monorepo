// components/ChainGuard.tsx
'use client';

import { ReactNode } from 'react';
import { useChainSwitching } from '@/hooks/contracts/use-chain-switching';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ChainGuardProps {
  children: ReactNode;
  requiredChain?: 'BASE_MAINNET' | 'BASE_SEPOLIA';
  fallback?: ReactNode;
  autoSwitch?: boolean;
  className?: string;
}

export function ChainGuard({
  children,
  requiredChain = 'BASE_SEPOLIA',
  fallback,
  //   _autoSwitch = false,
  className = '',
}: ChainGuardProps) {
  const {
    currentChain,
    isOnSupportedChain,
    isSwitching,
    switchToChain,
    SUPPORTED_CHAINS,
    isOnChain,
  } = useChainSwitching();

  const targetChain = SUPPORTED_CHAINS[requiredChain];
  const isOnCorrectChain = isOnChain(targetChain.id);

  // If on correct chain, render children
  if (isOnCorrectChain) {
    return <>{children}</>;
  }

  // If custom fallback provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default chain switching UI
  const handleSwitchChain = async () => {
    try {
      await switchToChain(targetChain);
    } catch (error) {
      console.error('Failed to switch chain:', error);
    }
  };

  return (
    <div className={`flex flex-col items-center justify-center p-6 ${className}`}>
      <Alert className="max-w-md mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          You&apos;re currently on <strong>{currentChain?.name || 'Unknown Network'}</strong>. This
          feature requires <strong>{targetChain.name}</strong>.
        </AlertDescription>
      </Alert>

      <Button
        onClick={handleSwitchChain}
        disabled={isSwitching}
        className="flex items-center gap-2"
      >
        <Zap className="w-4 h-4" />
        {isSwitching ? 'Switching...' : `Switch to ${targetChain.name}`}
      </Button>

      {!isOnSupportedChain && (
        <p className="text-sm text-gray-500 mt-2 text-center">
          Please ensure you&apos;re using a supported wallet and network.
        </p>
      )}
    </div>
  );
}

// Specialized chain guards for common use cases
export function BaseMainnetGuard({ children, ...props }: Omit<ChainGuardProps, 'requiredChain'>) {
  return (
    <ChainGuard requiredChain="BASE_MAINNET" {...props}>
      {children}
    </ChainGuard>
  );
}

export function BaseSepoliaGuard({ children, ...props }: Omit<ChainGuardProps, 'requiredChain'>) {
  return (
    <ChainGuard requiredChain="BASE_SEPOLIA" {...props}>
      {children}
    </ChainGuard>
  );
}
