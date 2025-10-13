// Test component: Standalone quote testing without authentication
'use client';

import { useState } from 'react';
import { BondingApi } from '@/lib/bonding-curve/bonding';

export default function QuoteTest() {
  const [loading, setLoading] = useState(false);
  const [acesQuote, setAcesQuote] = useState<any>(null);
  const [usdcQuote, setUsdcQuote] = useState<any>(null);
  const [wethQuote, setWethQuote] = useState<any>(null);
  const [tokenAddress, setTokenAddress] = useState('0x1234567890123456789012345678901234567890');
  const [acesAmount, setAcesAmount] = useState('100');
  const [usdcAmount, setUsdcAmount] = useState('100');
  const [wethAmount, setWethAmount] = useState('0.1');

  const testAcesQuote = async () => {
    setLoading(true);
    try {
      const result = await BondingApi.getMultiHopQuote(tokenAddress, {
        inputAsset: 'ACES',
        amount: acesAmount,
      });
      setAcesQuote(result);
    } catch (error) {
      setAcesQuote({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const testUsdcQuote = async () => {
    setLoading(true);
    try {
      const result = await BondingApi.getMultiHopQuote(tokenAddress, {
        inputAsset: 'USDC',
        amount: usdcAmount,
        slippageBps: 100,
      });
      setUsdcQuote(result);
    } catch (error) {
      setUsdcQuote({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  const testWethQuote = async () => {
    setLoading(true);
    try {
      const result = await BondingApi.getMultiHopQuote(tokenAddress, {
        inputAsset: 'WETH',
        amount: wethAmount,
        slippageBps: 100,
      });
      setWethQuote(result);
    } catch (error) {
      setWethQuote({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        border: '2px solid #333',
        padding: '20px',
        borderRadius: '8px',
        marginTop: '20px',
        backgroundColor: '#f9f9f9',
      }}
    >
      <h2 style={{ marginTop: 0 }}>🧪 Advanced Quote Testing</h2>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
          Token Address:
        </label>
        <input
          type="text"
          value={tokenAddress}
          onChange={(e) => setTokenAddress(e.target.value)}
          style={{
            width: '100%',
            padding: '8px',
            border: '1px solid #ddd',
            borderRadius: '4px',
            fontFamily: 'monospace',
          }}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gap: '15px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        }}
      >
        {/* ACES Test */}
        <div
          style={{
            border: '1px solid #ddd',
            padding: '15px',
            borderRadius: '8px',
            backgroundColor: 'white',
          }}
        >
          <h3 style={{ marginTop: 0 }}>ACES → RWA (Direct)</h3>
          <input
            type="text"
            value={acesAmount}
            onChange={(e) => setAcesAmount(e.target.value)}
            placeholder="Amount"
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={testAcesQuote}
            disabled={loading}
            style={{
              width: '100%',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Test ACES
          </button>
          {acesQuote && (
            <div
              style={{
                marginTop: '10px',
                padding: '10px',
                backgroundColor: acesQuote.success ? '#e8f5e8' : '#ffebee',
                borderRadius: '5px',
                maxHeight: '200px',
                overflow: 'auto',
              }}
            >
              <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(acesQuote, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* USDC Test */}
        <div
          style={{
            border: '1px solid #ddd',
            padding: '15px',
            borderRadius: '8px',
            backgroundColor: 'white',
          }}
        >
          <h3 style={{ marginTop: 0 }}>USDC → RWA (Multi-hop)</h3>
          <input
            type="text"
            value={usdcAmount}
            onChange={(e) => setUsdcAmount(e.target.value)}
            placeholder="Amount"
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={testUsdcQuote}
            disabled={loading}
            style={{
              width: '100%',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Test USDC
          </button>
          {usdcQuote && (
            <div
              style={{
                marginTop: '10px',
                padding: '10px',
                backgroundColor: usdcQuote.success ? '#e8f5e8' : '#ffebee',
                borderRadius: '5px',
                maxHeight: '200px',
                overflow: 'auto',
              }}
            >
              <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(usdcQuote, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* WETH Test */}
        <div
          style={{
            border: '1px solid #ddd',
            padding: '15px',
            borderRadius: '8px',
            backgroundColor: 'white',
          }}
        >
          <h3 style={{ marginTop: 0 }}>WETH → RWA (Multi-hop)</h3>
          <input
            type="text"
            value={wethAmount}
            onChange={(e) => setWethAmount(e.target.value)}
            placeholder="Amount"
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '10px',
              border: '1px solid #ddd',
              borderRadius: '4px',
            }}
          />
          <button
            onClick={testWethQuote}
            disabled={loading}
            style={{
              width: '100%',
              background: '#0070f3',
              color: 'white',
              border: 'none',
              padding: '10px',
              borderRadius: '5px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            Test WETH
          </button>
          {wethQuote && (
            <div
              style={{
                marginTop: '10px',
                padding: '10px',
                backgroundColor: wethQuote.success ? '#e8f5e8' : '#ffebee',
                borderRadius: '5px',
                maxHeight: '200px',
                overflow: 'auto',
              }}
            >
              <pre style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-wrap' }}>
                {JSON.stringify(wethQuote, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
