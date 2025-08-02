'use client';

import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useState } from 'react';

export function PrivyDebug() {
  const { user, authenticated, ready } = usePrivy();
  const [mountTime, setMountTime] = useState<Date | null>(null);

  useEffect(() => {
    setMountTime(new Date());
  }, []);

  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  return (
    <div className="fixed bottom-4 right-4 bg-black/90 text-white p-4 rounded-lg border border-[#D0B264]/30 max-w-sm text-xs font-mono z-50">
      <h3 className="text-[#D0B264] font-bold mb-2">Privy Debug</h3>

      <div className="space-y-1">
        <div>
          <span className="text-gray-400">App ID:</span>{' '}
          <span className={appId ? 'text-green-400' : 'text-red-400'}>
            {appId ? `${appId.slice(0, 8)}...` : 'MISSING'}
          </span>
        </div>

        <div>
          <span className="text-gray-400">Ready:</span>{' '}
          <span className={ready ? 'text-green-400' : 'text-red-400'}>{ready ? 'Yes' : 'No'}</span>
        </div>

        <div>
          <span className="text-gray-400">Authenticated:</span>{' '}
          <span className={authenticated ? 'text-green-400' : 'text-yellow-400'}>
            {authenticated ? 'Yes' : 'No'}
          </span>
        </div>

        <div>
          <span className="text-gray-400">User:</span>{' '}
          <span className={user ? 'text-green-400' : 'text-yellow-400'}>
            {user ? 'Loaded' : 'None'}
          </span>
        </div>

        <div>
          <span className="text-gray-400">Domain:</span>{' '}
          <span className="text-blue-400">
            {typeof window !== 'undefined' ? window.location.hostname : 'SSR'}
          </span>
        </div>

        {mountTime && (
          <div>
            <span className="text-gray-400">Mount:</span>{' '}
            <span className="text-green-400">{mountTime.toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {!appId && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-500/30 rounded text-red-400">
          ⚠️ No Privy App ID found!
        </div>
      )}
    </div>
  );
}
