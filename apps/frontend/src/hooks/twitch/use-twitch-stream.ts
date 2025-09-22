import { useState, useEffect, useCallback } from 'react';
import { trackStreamStatusCheck } from '@/lib/utils/analytics';

interface StreamStatus {
  isLive: boolean;
  streamData: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
}

interface UseTwitchStreamReturn extends StreamStatus {
  refetch: () => Promise<void>;
}

export function useTwitchStream(channelName: string): UseTwitchStreamReturn {
  const [streamStatus, setStreamStatus] = useState<StreamStatus>({
    isLive: false,
    streamData: null,
    loading: true,
    error: null,
  });

  const checkStreamStatus = useCallback(async () => {
    try {
      setStreamStatus((prev) => ({ ...prev, loading: true, error: null }));

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
      const response = await fetch(`${apiUrl}/api/v1/twitch/stream-status/${channelName}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to check stream status');
      }

      setStreamStatus({
        isLive: data.data.isLive,
        streamData: data.data.streamData,
        loading: false,
        error: null,
      });

      // Track analytics
      trackStreamStatusCheck(data.data.isLive, channelName);
    } catch (error) {
      console.error('Twitch stream status error:', error);
      setStreamStatus((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to check stream status',
      }));
    }
  }, [channelName]);

  useEffect(() => {
    if (channelName) {
      checkStreamStatus();
    }
  }, [checkStreamStatus, channelName]);

  return { ...streamStatus, refetch: checkStreamStatus };
}
