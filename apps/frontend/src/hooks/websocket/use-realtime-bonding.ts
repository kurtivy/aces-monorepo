/**
 * useRealtimeBonding Hook
 * 
 * Real-time WebSocket connection for bonding status updates.
 * Provides instant bonding progress, graduation events, and pool creation.
 */

import { useEffect, useState, useRef, useCallback } from 'react';

export interface RealtimeBondingStatus {
  tokenAddress: string;
  isBonded: boolean;
  supply: string;
  bondingProgress: number; // 0-1
  poolAddress: string | null;
  graduatedAt: number | null;
  timestamp: number;
}

interface UseRealtimeBondingOptions {
  /** Auto-reconnect on disconnect (default: true) */
  autoReconnect?: boolean;
  /** Reconnect delay in ms (default: 5000) */
  reconnectDelay?: number;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

interface UseRealtimeBondingResult {
  status: RealtimeBondingStatus | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
}

const WS_BASE_URL = (() => {
  if (typeof window === 'undefined') return 'ws://localhost:3002';
  
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      const url = new URL(apiUrl);
      const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
      return `${protocol}//${url.host}`;
    } catch {
      // Fallback
    }
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.hostname}:3002`;
})();

export const useRealtimeBonding = (
  tokenAddress: string | undefined,
  options: UseRealtimeBondingOptions = {}
): UseRealtimeBondingResult => {
  const {
    autoReconnect = true,
    reconnectDelay = 5000,
    debug = false,
  } = options;

  const [status, setStatus] = useState<RealtimeBondingStatus | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const log = useCallback(
    (message: string, data?: any) => {
      if (debug) {
        console.log(`[useRealtimeBonding] ${message}`, data || '');
      }
    },
    [debug]
  );

  const disconnect = useCallback(() => {
    log('Disconnecting...');
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setIsConnecting(false);
  }, [log]);

  const connect = useCallback(() => {
    if (!tokenAddress) {
      log('No token address provided, skipping connection');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      log('Already connected');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.CONNECTING) {
      log('Connection already in progress');
      return;
    }

    disconnect();
    setIsConnecting(true);
    setError(null);

    const wsUrl = `${WS_BASE_URL}/api/v1/ws/bonding/${tokenAddress}`;
    log('Connecting to:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        log('Connected!');
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
      };

      ws.onmessage = (event) => {
        if (!mountedRef.current) return;

        try {
          const message = JSON.parse(event.data);
          log('Received message:', message.type);

          if (message.type === 'subscribed') {
            log('Subscription confirmed:', message.data);
          } else if (message.type === 'bonding_status') {
            const bondingStatus = message.data as RealtimeBondingStatus;
            log('Bonding status update:', {
              isBonded: bondingStatus.isBonded,
              progress: bondingStatus.bondingProgress,
              poolAddress: bondingStatus.poolAddress,
            });

            setStatus(bondingStatus);

            // Log graduation event
            if (bondingStatus.isBonded && bondingStatus.graduatedAt) {
              console.log('🎉 Token graduated!', {
                tokenAddress,
                poolAddress: bondingStatus.poolAddress,
                graduatedAt: new Date(bondingStatus.graduatedAt),
              });
            }
          } else if (message.type === 'error') {
            console.error('[useRealtimeBonding] Server error:', message.message);
            setError(message.message);
          }
        } catch (err) {
          console.error('[useRealtimeBonding] Error parsing message:', err);
        }
      };

      ws.onerror = (event) => {
        if (!mountedRef.current) return;
        console.error('[useRealtimeBonding] WebSocket error:', event);
        setError('WebSocket connection error');
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;
        
        log('Disconnected', { code: event.code, reason: event.reason });
        setIsConnected(false);
        setIsConnecting(false);
        wsRef.current = null;

        // Auto-reconnect if enabled and not a normal closure
        if (autoReconnect && event.code !== 1000) {
          log(`Reconnecting in ${reconnectDelay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            if (mountedRef.current && tokenAddress) {
              connect();
            }
          }, reconnectDelay);
        }
      };
    } catch (err) {
      console.error('[useRealtimeBonding] Failed to create WebSocket:', err);
      setError('Failed to create WebSocket connection');
      setIsConnecting(false);
    }
  }, [tokenAddress, autoReconnect, reconnectDelay, log, disconnect]);

  // Auto-connect when tokenAddress changes
  useEffect(() => {
    if (tokenAddress) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [tokenAddress, connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    isConnected,
    isConnecting,
    error,
    connect,
    disconnect,
  };
};













