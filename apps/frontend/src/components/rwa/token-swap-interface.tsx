'use client';

import { useState, useEffect, useRef } from 'react';
import { ethers } from 'ethers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth/auth-context';
import { FACTORY_ABI } from '@/app/testing/abi';

// Contract addresses
const CONTRACTS = {
  FACTORY_PROXY: '0xd484049526dF1325dEAc0D0DB67536b7431D8718',
};

// Minimal ABIs for other contracts
const ACES_TOKEN_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
];

const LAUNCHPAD_TOKEN_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function totalSupply() view returns (uint256)',
];

interface TokenSwapInterfaceProps {
  tokenSymbol?: string;
  tokenPrice?: number;
  userBalance?: number;
  // Additional dynamic props for better integration
  tokenAddress?: string;
  tokenName?: string;
}

export default function TokenSwapInterface({
  tokenSymbol = 'RWA',
  tokenPrice = 0.000268,
  userBalance = 0.5,
  tokenAddress,
  tokenName,
}: TokenSwapInterfaceProps) {
  // Wallet state from global auth
  const { walletAddress, isAuthenticated } = useAuth();

  // Contract state
  const [provider, setProvider] = useState<ethers.providers.Web3Provider | null>(null);
  const [signer, setSigner] = useState<ethers.Signer | null>(null);
  const [factoryContract, setFactoryContract] = useState<ethers.Contract | null>(null);
  const [acesContract, setAcesContract] = useState<ethers.Contract | null>(null);
  const [acesTokenAddress, setAcesTokenAddress] = useState<string>('');

  // Balance state
  const [acesBalance, setAcesBalance] = useState<string>('0');
  const [tokenBalance, setTokenBalance] = useState<string>('0');

  // Price quote state
  const [priceQuote, setPriceQuote] = useState<string>('0');
  const [sellPriceQuote, setSellPriceQuote] = useState<string>('0');

  // UI state
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [slippage] = useState('0.5');
  const [loading, setLoading] = useState<string>('');

  // Debounce ref for price calculation
  const priceCalculationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-initialize provider when user is already authenticated through Privy
  useEffect(() => {
    const initializeFromAuth = async () => {
      console.log('Auto-init check:', {
        isAuthenticated,
        walletAddress,
        hasProvider: !!provider,
        hasEthereum: !!(typeof window !== 'undefined' && (window as any).ethereum),
      });

      if (
        isAuthenticated &&
        walletAddress &&
        !provider &&
        typeof window !== 'undefined' &&
        (window as any).ethereum
      ) {
        try {
          console.log('Auto-initializing provider from auth...');
          const provider = new ethers.providers.Web3Provider((window as any).ethereum);
          const signer = provider.getSigner();

          setProvider(provider);
          setSigner(signer);

          // Initialize contracts
          const factory = new ethers.Contract(CONTRACTS.FACTORY_PROXY, FACTORY_ABI.abi, signer);
          setFactoryContract(factory);

          // Get ACES token address
          const acesAddress = await factory.acesTokenAddress();
          setAcesTokenAddress(acesAddress);
          console.log('ACES token address:', acesAddress);

          const aces = new ethers.Contract(acesAddress, ACES_TOKEN_ABI, signer);
          setAcesContract(aces);

          // Get balances
          await refreshBalances();
          console.log('Auto-initialization complete');
        } catch (error) {
          console.error('Failed to initialize from auth:', error);
        }
      }
    };

    initializeFromAuth();
  }, [isAuthenticated, walletAddress, provider]);

  // Connect wallet using direct MetaMask interaction (like testing page)
  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      try {
        setLoading('Connecting wallet...');
        const provider = new ethers.providers.Web3Provider((window as any).ethereum);
        await provider.send('eth_requestAccounts', []);
        const signer = provider.getSigner();
        const address = await signer.getAddress();

        setProvider(provider);
        setSigner(signer);

        // Initialize contracts
        const factory = new ethers.Contract(CONTRACTS.FACTORY_PROXY, FACTORY_ABI.abi, signer);
        setFactoryContract(factory);

        // Get ACES token address
        const acesAddress = await factory.acesTokenAddress();
        setAcesTokenAddress(acesAddress);

        const aces = new ethers.Contract(acesAddress, ACES_TOKEN_ABI, signer);
        setAcesContract(aces);

        // Get balances
        await refreshBalances();

        setLoading('');
      } catch (error) {
        console.error('Failed to connect wallet:', error);
        setLoading('');
      }
    } else {
      alert('Please install MetaMask!');
    }
  };

  // Refresh balances
  const refreshBalances = async () => {
    if (!acesContract || !tokenAddress || !signer) {
      console.log('Refresh balances skipped - missing requirements:', {
        acesContract: !!acesContract,
        tokenAddress,
        signer: !!signer,
      });
      return;
    }

    try {
      const address = await signer.getAddress();
      console.log('Refreshing balances for address:', address);
      console.log('Token address:', tokenAddress);

      // Refresh ACES balance
      const acesBalance = await acesContract.balanceOf(address);
      const formattedAcesBalance = ethers.utils.formatEther(acesBalance);
      setAcesBalance(formattedAcesBalance);
      console.log('ACES balance:', formattedAcesBalance);

      // Refresh token balance
      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
      const tokenBalance = await tokenContract.balanceOf(address);
      const formattedTokenBalance = ethers.utils.formatEther(tokenBalance);
      setTokenBalance(formattedTokenBalance);
      console.log('Token balance:', formattedTokenBalance);
    } catch (error) {
      console.error('Failed to refresh balances:', error);
    }
  };

  // Get buy price quote
  const getBuyPriceQuote = async () => {
    if (!factoryContract || !tokenAddress || !amount) {
      setPriceQuote('0');
      return;
    }

    try {
      const amountWei = ethers.utils.parseEther(amount);
      const buyPrice = await factoryContract.getBuyPriceAfterFee(tokenAddress, amountWei);
      setPriceQuote(ethers.utils.formatEther(buyPrice));
    } catch (error) {
      console.error('Failed to get buy price quote:', error);
      setPriceQuote('0');
    }
  };

  // Get sell price quote
  const getSellPriceQuote = async () => {
    if (!factoryContract || !tokenAddress || !amount) {
      setSellPriceQuote('0');
      return;
    }

    try {
      const amountWei = ethers.utils.parseEther(amount);
      const sellPrice = await factoryContract.getSellPriceAfterFee(tokenAddress, amountWei);
      setSellPriceQuote(ethers.utils.formatEther(sellPrice));
    } catch (error) {
      console.error('Failed to get sell price quote:', error);
      setSellPriceQuote('0');
    }
  };

  // Debounced price calculation
  const calculatePriceQuote = () => {
    // Clear existing timeout
    if (priceCalculationTimeoutRef.current) {
      clearTimeout(priceCalculationTimeoutRef.current);
    }

    // Set new timeout for 1 second
    priceCalculationTimeoutRef.current = setTimeout(() => {
      if (activeTab === 'buy') {
        getBuyPriceQuote();
      } else {
        getSellPriceQuote();
      }
    }, 1000);
  };

  // Update price quotes when amount or active tab changes
  useEffect(() => {
    calculatePriceQuote();
  }, [amount, activeTab, tokenAddress]);

  const quickAmounts = [
    { label: 'Reset', value: '' },
    { label: `0.01 ${tokenSymbol}`, value: '0.01' },
    { label: `0.1 ${tokenSymbol}`, value: '0.1' },
    { label: `0.5 ${tokenSymbol}`, value: '0.5' },
    { label: 'Max', value: tokenBalance },
  ];

  const handleQuickAmount = (value: string) => {
    setAmount(value);
  };

  // Buy tokens
  const buyTokens = async () => {
    if (!factoryContract || !acesContract || !tokenAddress || !amount || !signer) return;

    try {
      const amountWei = ethers.utils.parseEther(amount);
      const priceWei = ethers.utils.parseEther(priceQuote);

      console.log('=== BUY TOKENS DEBUG ===');
      console.log('Token to buy:', tokenAddress);
      console.log('Amount (tokens):', amount);
      console.log('Price (ACES):', priceQuote);
      console.log('Amount Wei:', amountWei.toString());
      console.log('Price Wei:', priceWei.toString());

      // Check current allowance and balances
      const address = await signer.getAddress();
      const currentAllowance = await acesContract.allowance(address, CONTRACTS.FACTORY_PROXY);
      const currentAcesBalance = await acesContract.balanceOf(address);

      console.log('=== BALANCE CHECK ===');
      console.log('Current allowance:', ethers.utils.formatEther(currentAllowance));
      console.log('Required amount:', ethers.utils.formatEther(priceWei));
      console.log('Current ACES balance:', ethers.utils.formatEther(currentAcesBalance));
      console.log('Allowance sufficient:', currentAllowance.gte(priceWei));
      console.log('ACES balance sufficient:', currentAcesBalance.gte(priceWei));

      // Step 1: Approve ACES tokens
      setLoading('Approving ACES tokens...');
      console.log('Step 1: Approving ACES tokens for factory...');
      const approveTx = await acesContract.approve(CONTRACTS.FACTORY_PROXY, priceWei);
      console.log('Approval transaction sent:', approveTx.hash);
      await approveTx.wait();
      console.log('✅ Approval confirmed');

      // Step 2: Buy tokens
      setLoading('Buying tokens...');
      console.log('Step 2: Calling buyTokens...');

      const buyTx = await factoryContract.buyTokens(tokenAddress, amountWei, priceWei);
      console.log('Buy transaction sent:', buyTx.hash);
      await buyTx.wait();
      console.log('✅ Purchase confirmed');

      // Step 3: Refresh balances
      setLoading('Refreshing balances...');
      await refreshBalances();

      setLoading('');
      console.log('🎉 Buy tokens completed successfully!');
    } catch (error) {
      console.error('Failed to buy tokens:', error);
      setLoading('');
      alert(`Buy failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Sell tokens
  const sellTokens = async () => {
    if (!factoryContract || !tokenAddress || !amount || !signer) return;

    try {
      const amountWei = ethers.utils.parseEther(amount);

      console.log('=== SELL TOKENS DEBUG ===');
      console.log('Token to sell:', tokenAddress);
      console.log('Amount (tokens):', amount);
      console.log('Amount Wei:', amountWei.toString());

      // Check current token balance
      const address = await signer.getAddress();
      const tokenContract = new ethers.Contract(tokenAddress, LAUNCHPAD_TOKEN_ABI, signer);
      const currentTokenBalance = await tokenContract.balanceOf(address);

      console.log('=== SELL BALANCE CHECK ===');
      console.log('Current token balance:', ethers.utils.formatEther(currentTokenBalance));
      console.log('Amount to sell:', amount);
      console.log('Estimated ACES received:', sellPriceQuote);
      console.log('Token balance sufficient:', currentTokenBalance.gte(amountWei));

      if (currentTokenBalance.lt(amountWei)) {
        throw new Error(
          `Insufficient token balance! You have ${ethers.utils.formatEther(currentTokenBalance)} but trying to sell ${amount}`,
        );
      }

      setLoading('Selling tokens...');
      console.log('Executing sell transaction...');
      const tx = await factoryContract.sellTokens(tokenAddress, amountWei);
      console.log('Sell transaction sent:', tx.hash);
      await tx.wait();
      console.log('✅ Sell confirmed');

      // Refresh balances
      setLoading('Refreshing balances...');
      await refreshBalances();

      setLoading('');
      console.log('🎉 Sell tokens completed successfully!');
    } catch (error) {
      console.error('Failed to sell tokens:', error);
      setLoading('');
      alert(`Sell failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="h-full">
      <div className="bg-black rounded-lg border border-[#D0B284]/20 p-6 h-full flex flex-col">
        <h3 className="text-[#D0B284] text-xl font-bold mb-6 text-center">
          Trade {tokenName || tokenSymbol}
        </h3>

        {/* Token Address Display (for debugging/verification) */}
        {tokenAddress && (
          <div className="mb-4 p-2 bg-[#231F20]/50 rounded border border-[#D0B284]/20">
            <div className="text-xs text-[#DCDDCC] text-center">
              Contract: {tokenAddress.slice(0, 6)}...{tokenAddress.slice(-4)}
            </div>
          </div>
        )}

        {/* Buy/Sell Toggle */}
        <div className="flex mb-6 bg-[#231F20] rounded-lg p-1 border border-[#D0B284]/20">
          <button
            onClick={() => setActiveTab('buy')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
              activeTab === 'buy'
                ? 'bg-[#184D37] text-white shadow-lg'
                : 'text-[#DCDDCC] hover:text-white hover:bg-[#D0B284]/10'
            }`}
          >
            Buy
          </button>
          <button
            onClick={() => setActiveTab('sell')}
            className={`flex-1 py-3 px-4 rounded-md font-semibold transition-all duration-200 ${
              activeTab === 'sell'
                ? 'bg-[#8B4513] text-white shadow-lg'
                : 'text-[#DCDDCC] hover:text-white hover:bg-[#D0B284]/10'
            }`}
          >
            Sell
          </button>
        </div>

        {/* Settings Row */}
        <div className="flex justify-between mb-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-[#DCDDCC] hover:text-[#D0B284] border border-[#D0B284]/20 hover:border-[#D0B284]/40"
          >
            Switch to Base
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[#DCDDCC] hover:text-[#D0B284] border border-[#D0B284]/20 hover:border-[#D0B284]/40"
          >
            Slippage: {slippage}%
          </Button>
        </div>

        {/* Amount Input */}
        <div className="mb-4">
          <div className="relative">
            <Input
              type="number"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-16 text-2xl font-bold bg-[#231F20] border-[#D0B284]/20 text-white placeholder:text-[#DCDDCC] pr-20"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <div className="w-8 h-8 bg-[#D0B284] rounded-full flex items-center justify-center">
                <span className="text-black text-xs font-bold">{tokenSymbol}</span>
              </div>
              <span className="text-[#D0B284] font-semibold">{tokenSymbol}</span>
            </div>
          </div>

          {/* Price Quote Display */}
          {amount && parseFloat(amount) > 0 && (
            <div className="mt-2 p-3 bg-[#231F20]/50 rounded-lg border border-[#D0B284]/20">
              <div className="text-center">
                <div className="text-sm text-[#DCDDCC] mb-1">
                  {activeTab === 'buy' ? 'Cost to buy' : 'ACES received'}
                </div>
                <div className="text-lg font-bold text-[#D0B284]">
                  ≈ {activeTab === 'buy' ? priceQuote : sellPriceQuote} ACES
                </div>
                <div className="text-xs text-[#DCDDCC] mt-1">
                  {activeTab === 'buy'
                    ? `To buy ${amount} ${tokenSymbol} tokens`
                    : `For selling ${amount} ${tokenSymbol} tokens`}
                </div>
                <div className="text-xs text-[#D0B284] mt-1">
                  {activeTab === 'buy' ? 'Cost in ACES' : 'Receive in ACES'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Amount Buttons */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {quickAmounts.map((quick) => (
            <Button
              key={quick.label}
              variant="ghost"
              size="sm"
              onClick={() => handleQuickAmount(quick.value)}
              className="text-[#DCDDCC] hover:text-[#D0B284] border border-[#D0B284]/20 hover:border-[#D0B284]/40 hover:bg-[#D0B284]/10"
            >
              {quick.label}
            </Button>
          ))}
        </div>

        {/* Balance Display */}
        <div className="mb-6 p-3 bg-[#231F20] rounded-lg border border-[#D0B284]/20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm text-[#DCDDCC]">Balances</span>
            <Button
              onClick={refreshBalances}
              disabled={!provider}
              variant="ghost"
              size="sm"
              className="text-[#D0B284] hover:text-white text-xs px-2 py-1"
            >
              Refresh
            </Button>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-[#DCDDCC]">ACES Balance:</span>
            <span className="text-white font-mono">{parseFloat(acesBalance).toFixed(4)} ACES</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span className="text-[#DCDDCC]">{tokenSymbol} Holdings:</span>
            <span className="text-white font-mono">
              {parseFloat(tokenBalance).toFixed(4)} {tokenSymbol}
            </span>
          </div>
        </div>

        {/* Trade Button */}
        <div className="mt-auto">
          {!isAuthenticated || !provider ? (
            <Button
              onClick={connectWallet}
              disabled={!!loading}
              className="w-full h-14 bg-[#184D37] hover:bg-[#184D37]/90 text-white font-bold text-lg rounded-lg disabled:opacity-50"
            >
              {loading || 'Connect Wallet'}
            </Button>
          ) : (
            <Button
              onClick={activeTab === 'buy' ? buyTokens : sellTokens}
              disabled={!amount || Number.parseFloat(amount) <= 0 || !!loading}
              className={`w-full h-14 font-bold text-lg rounded-lg transition-all duration-200 ${
                activeTab === 'buy'
                  ? 'bg-[#184D37] hover:bg-[#184D37]/90 text-white'
                  : 'bg-[#8B4513] hover:bg-[#8B4513]/90 text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {loading || (activeTab === 'buy' ? `Buy ${tokenSymbol}` : `Sell ${tokenSymbol}`)}
            </Button>
          )}
        </div>

        {/* Transaction Info */}
        {amount && Number.parseFloat(amount) > 0 && (
          <div className="mt-4 p-3 bg-[#231F20]/50 rounded-lg border border-[#D0B284]/10">
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-[#DCDDCC]">Price Impact:</span>
                <span className="text-[#184D37]">{'<0.01%'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#DCDDCC]">Network Fee:</span>
                <span className="text-white">~$2.50</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#DCDDCC]">Slippage Tolerance:</span>
                <span className="text-white">{slippage}%</span>
              </div>
            </div>
          </div>
        )}

        {/* Network Badge */}
        <div className="mt-4 flex justify-center">
          <div className="flex items-center gap-2 px-3 py-1 bg-[#D0B284]/20 border border-[#D0B284]/40 rounded-full">
            <div className="w-4 h-4 bg-[#D0B284] rounded-full"></div>
            <span className="text-[#D0B284] text-xs font-medium">Base Mainnet</span>
          </div>
        </div>
      </div>
    </div>
  );
}
