'use client';

import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Wallet, DollarSign, PieChart, Activity } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  fetchPortfolioSummary,
  type PortfolioSummary,
  formatCurrency,
  formatPercentage,
  getPnLColorClass,
} from '@/lib/api/portfolio';

interface PortfolioOverviewProps {
  walletAddress: string;
  className?: string;
}

const PortfolioOverview: React.FC<PortfolioOverviewProps> = ({ walletAddress, className = '' }) => {
  const [portfolioData, setPortfolioData] = useState<PortfolioSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) return;

    const loadPortfolio = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchPortfolioSummary(walletAddress);

        if (result.success && result.data) {
          setPortfolioData(result.data);
        } else {
          // Handle both string and AppError types
          const errorMessage =
            typeof result.error === 'string'
              ? result.error
              : result.error?.message || 'Failed to load portfolio';
          setError(errorMessage);
        }
      } catch (err) {
        setError('Failed to load portfolio data');
        console.error('Portfolio loading error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadPortfolio();
  }, [walletAddress]);

  if (isLoading) {
    return (
      <div className={`bg-[#151c16]/80 border border-[#D0B284]/20 rounded-xl p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-[#D0B284]/10 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-20 bg-[#D0B284]/10 rounded"></div>
            ))}
          </div>
          <div className="h-32 bg-[#D0B284]/10 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !portfolioData) {
    return (
      <div className={`bg-[#151c16]/80 border border-[#D0B284]/20 rounded-xl p-6 ${className}`}>
        <div className="text-center py-8">
          <Wallet className="w-12 h-12 text-[#D0B284]/40 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#DCDDCC] mb-2">Portfolio Overview</h3>
          <p className="text-gray-400 mb-4">{error || 'No portfolio data available'}</p>
          <p className="text-sm text-gray-500">
            Start trading tokens to see your portfolio analytics here.
          </p>
        </div>
      </div>
    );
  }

  const { metrics, topHoldings } = portfolioData;
  const totalPnL = parseFloat(metrics.totalPnL);
  const pnlPercentage = parseFloat(metrics.pnlPercentage);

  return (
    <div className={`bg-[#151c16]/80 border border-[#D0B284]/20 rounded-xl p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-[#DCDDCC] flex items-center gap-2">
          <PieChart className="w-5 h-5 text-[#D0B284]" />
          Portfolio Overview
        </h2>
        <div className="text-xs text-gray-400">
          Updated: {new Date(portfolioData.lastUpdate).toLocaleTimeString()}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* Total Value */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-[#0f1511] border border-[#D0B284]/10 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-[#D0B284]" />
            <span className="text-sm text-gray-400">Total Value</span>
          </div>
          <div className="text-lg font-bold text-white">
            {formatCurrency(metrics.totalValue)} ACES
          </div>
        </motion.div>

        {/* Total P&L */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-[#0f1511] border border-[#D0B284]/10 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            {totalPnL >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-400" />
            )}
            <span className="text-sm text-gray-400">Total P&L</span>
          </div>
          <div className={`text-lg font-bold ${getPnLColorClass(totalPnL)}`}>
            {formatCurrency(metrics.totalPnL)} ACES
          </div>
          <div className={`text-sm ${getPnLColorClass(pnlPercentage)}`}>
            {formatPercentage(metrics.pnlPercentage)}
          </div>
        </motion.div>

        {/* Total Invested */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-[#0f1511] border border-[#D0B284]/10 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Wallet className="w-4 h-4 text-[#D0B284]" />
            <span className="text-sm text-gray-400">Invested</span>
          </div>
          <div className="text-lg font-bold text-white">
            {formatCurrency(metrics.totalInvested)} ACES
          </div>
        </motion.div>

        {/* Token Count */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#0f1511] border border-[#D0B284]/10 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-[#D0B284]" />
            <span className="text-sm text-gray-400">Tokens</span>
          </div>
          <div className="text-lg font-bold text-white">{metrics.tokenCount}</div>
          <div className="text-sm text-gray-400">Holdings</div>
        </motion.div>
      </div>

      {/* Top Holdings */}
      {topHoldings.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-lg font-semibold text-[#DCDDCC] mb-4">Top Holdings</h3>
          <div className="space-y-3">
            {topHoldings.map((holding, index) => (
              <div
                key={holding.tokenAddress}
                className="flex items-center justify-between p-3 bg-[#0f1511] border border-[#D0B284]/10 rounded-lg hover:border-[#D0B284]/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#D0B284]/20 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-[#D0B284]">
                      {holding.tokenSymbol.charAt(0)}
                    </span>
                  </div>
                  <div>
                    <div className="font-semibold text-white text-sm">{holding.tokenSymbol}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[150px]">
                      {holding.tokenName}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-semibold text-white text-sm">
                    {formatCurrency(holding.currentValue)} ACES
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className={getPnLColorClass(holding.pnlPercentage)}>
                      {formatPercentage(holding.pnlPercentage)}
                    </span>
                    <span className="text-gray-400">{holding.allocation.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Performance Indicators */}
      {metrics.topPerformer && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span className="text-sm text-green-400 font-semibold">Best Performer</span>
            </div>
            <div className="text-white font-semibold">{metrics.topPerformer.tokenSymbol}</div>
            <div className="text-green-400 text-sm">
              {formatPercentage(metrics.topPerformer.pnlPercentage)}
            </div>
          </div>

          {metrics.worstPerformer && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400 font-semibold">Needs Attention</span>
              </div>
              <div className="text-white font-semibold">{metrics.worstPerformer.tokenSymbol}</div>
              <div className="text-red-400 text-sm">
                {formatPercentage(metrics.worstPerformer.pnlPercentage)}
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export default PortfolioOverview;
