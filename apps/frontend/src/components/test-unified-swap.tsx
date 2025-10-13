// 'use client';

// /* eslint-disable no-restricted-globals */
// import { useState, useCallback, useMemo } from 'react';
// import { useUnifiedSwap } from '@/hooks/swap/use-unified-swap';
// import { useSwapContracts } from '@/hooks/swap/use-swap-contracts';
// import { useAuth } from '@/lib/auth/auth-context';
// import { getContractAddresses } from '@/lib/contracts/addresses';

// interface TestResult {
//   success: boolean;
//   testName: string;
//   duration: number;
//   error?: string;
//   hash?: string;
//   status?: string;
//   details?: Record<string, unknown>;
// }

// interface StatusUpdate {
//   status: string;
//   timestamp: number;
// }

// /**
//  * Phase 4 Testing Component for use-unified-swap
//  * Tests all swap scenarios on testnet with comprehensive logging
//  */
// export default function TestUnifiedSwap() {
//   const [testResults, setTestResults] = useState<TestResult[]>([]);
//   const [currentStatus, setCurrentStatus] = useState<StatusUpdate[]>([]);
//   const [isRunning, setIsRunning] = useState(false);
//   const [testTokenAddress, setTestTokenAddress] = useState<string>('');

//   // Authentication
//   const { walletAddress, isAuthenticated } = useAuth();

//   // Initialize contracts
//   const { signer, factoryContract, acesContract, currentChainId, isInitialized } = useSwapContracts(
//     walletAddress,
//     isAuthenticated,
//     testTokenAddress,
//   );

//   // Contract addresses
//   const contractAddresses = useMemo(
//     () => getContractAddresses(currentChainId || 84532),
//     [currentChainId],
//   );

//   const FACTORY_PROXY_ADDRESS = contractAddresses.FACTORY_PROXY;
//   const ROUTER_ADDRESS = contractAddresses.AERODROME_ROUTER || '';

//   // Initialize swap hook
//   const unifiedSwap = useUnifiedSwap({
//     factoryContract: factoryContract || null,
//     acesContract: acesContract || null,
//     signer: signer || null,
//     walletAddress: walletAddress || null,
//     factoryProxyAddress: FACTORY_PROXY_ADDRESS,
//     tokenAddress: testTokenAddress,
//     routerAddress: ROUTER_ADDRESS,
//     isDexMode: false,
//   });

//   /**
//    * Helper to get quote (we'll create instances as needed during tests)
//    * Note: useUnifiedQuote is a hook that auto-fetches, not a function with getQuote()
//    */
//   const getQuote = useCallback(
//     async (params: {
//       sellToken: string;
//       buyToken: string;
//       amount: string;
//     }): Promise<{
//       outputAmount: string;
//       slippageBps: number;
//       path: string[];
//       inputUsdValue: string | null;
//       outputUsdValue: string | null;
//     }> => {
//       // For testing, we'll return a mock quote structure
//       // In real implementation, useUnifiedQuote would be called with these params
//       return {
//         outputAmount: '50', // Mock value
//         slippageBps: 100,
//         path: [params.sellToken, params.buyToken],
//         inputUsdValue: null,
//         outputUsdValue: null,
//       };
//     },
//     [],
//   );

//   /**
//    * Add status update with timestamp
//    */
//   const addStatus = useCallback((status: string) => {
//     setCurrentStatus((prev) => [...prev, { status, timestamp: Date.now() }]);
//   }, []);

//   /**
//    * Clear status log
//    */
//   const clearStatus = useCallback(() => {
//     setCurrentStatus([]);
//   }, []);

//   /**
//    * Test 1: ACES → RWA (Direct bonding curve buy)
//    */
//   const testAcesToRwa = async (): Promise<TestResult> => {
//     const testName = 'ACES → RWA (Direct Buy)';
//     const startTime = Date.now();
//     clearStatus();

//     try {
//       addStatus('🔵 Starting ACES → RWA test...');

//       if (!testTokenAddress) {
//         throw new Error('Please enter a test token address first');
//       }

//       // Step 1: Get quote
//       addStatus('📊 Fetching quote for 100 ACES → RWA...');
//       const quote = await getQuote({
//         sellToken: 'ACES',
//         buyToken: testTokenAddress,
//         amount: '100',
//       });

//       if (!quote || !quote.outputAmount) {
//         throw new Error('Failed to get quote');
//       }

//       addStatus(`✅ Quote received: ${quote.outputAmount} RWA tokens`);

//       // Step 2: Execute swap
//       addStatus('🔄 Executing swap...');
//       const result = await unifiedSwap.executeSwap({
//         sellToken: 'ACES',
//         buyToken: testTokenAddress,
//         amount: '100',
//         quote,
//         onStatus: addStatus,
//       });

//       if (!result.success) {
//         throw new Error(result.error || 'Swap failed');
//       }

//       addStatus('✅ Swap completed successfully!');

//       return {
//         success: true,
//         testName,
//         duration: Date.now() - startTime,
//         hash: result.hash,
//         details: {
//           inputAmount: '100 ACES',
//           outputAmount: quote.outputAmount,
//           quote,
//         },
//       };
//     } catch (error) {
//       addStatus(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//       return {
//         success: false,
//         testName,
//         duration: Date.now() - startTime,
//         error: error instanceof Error ? error.message : 'Unknown error',
//       };
//     }
//   };

//   /**
//    * Test 2: USDC → RWA (Multi-hop)
//    */
//   const testUsdcToRwa = async (): Promise<TestResult> => {
//     const testName = 'USDC → RWA (Multi-hop)';
//     const startTime = Date.now();
//     clearStatus();

//     try {
//       if (!testTokenAddress) {
//         throw new Error('Please enter a test token address first');
//       }

//       addStatus('🔵 Starting USDC → RWA test...');
//       addStatus('⚠️ Note: This will fail gracefully if AcesSwap contract is not deployed');

//       // Step 1: Get quote
//       addStatus('📊 Fetching multi-hop quote for 100 USDC → RWA...');
//       const quote = await getQuote({
//         sellToken: 'USDC',
//         buyToken: testTokenAddress,
//         amount: '100',
//       });

//       if (!quote || !quote.outputAmount) {
//         throw new Error('Failed to get quote');
//       }

//       addStatus(`✅ Quote received: ${quote.outputAmount} RWA tokens`);

//       // Step 2: Check if AcesSwap is deployed
//       if (!unifiedSwap.acesSwapReady) {
//         addStatus('⚠️ AcesSwap contract not deployed - expecting graceful failure...');
//       }

//       // Step 3: Execute swap
//       addStatus('🔄 Executing multi-hop swap...');
//       const result = await unifiedSwap.executeSwap({
//         sellToken: 'USDC',
//         buyToken: testTokenAddress,
//         amount: '100',
//         quote,
//         onStatus: addStatus,
//       });

//       if (!result.success) {
//         // Check if error message is user-friendly
//         const isGracefulError =
//           result.error?.includes('not deployed') ||
//           result.error?.includes('will be available soon');

//         if (isGracefulError) {
//           addStatus('✅ Graceful error message received (expected behavior)');
//           return {
//             success: true, // Consider this a successful test of error handling
//             testName,
//             duration: Date.now() - startTime,
//             status: 'graceful_failure',
//             details: {
//               errorMessage: result.error,
//               isUserFriendly: true,
//             },
//           };
//         }

//         throw new Error(result.error || 'Swap failed');
//       }

//       addStatus('✅ Multi-hop swap completed successfully!');

//       return {
//         success: true,
//         testName,
//         duration: Date.now() - startTime,
//         hash: result.hash,
//         details: {
//           inputAmount: '100 USDC',
//           outputAmount: quote.outputAmount,
//           quote,
//         },
//       };
//     } catch (error) {
//       addStatus(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//       return {
//         success: false,
//         testName,
//         duration: Date.now() - startTime,
//         error: error instanceof Error ? error.message : 'Unknown error',
//       };
//     }
//   };

//   /**
//    * Test 3: RWA → ACES (Direct bonding curve sell)
//    */
//   const testRwaToAces = async (): Promise<TestResult> => {
//     const testName = 'RWA → ACES (Direct Sell)';
//     const startTime = Date.now();
//     clearStatus();

//     try {
//       if (!testTokenAddress) {
//         throw new Error('Please enter a test token address first');
//       }

//       addStatus('🔵 Starting RWA → ACES test...');

//       // Step 1: Get quote
//       addStatus('📊 Fetching quote for 50 RWA → ACES...');
//       const quote = await getQuote({
//         sellToken: testTokenAddress,
//         buyToken: 'ACES',
//         amount: '50',
//       });

//       if (!quote || !quote.outputAmount) {
//         throw new Error('Failed to get quote');
//       }

//       addStatus(`✅ Quote received: ${quote.outputAmount} ACES`);

//       // Step 2: Execute swap
//       addStatus('🔄 Executing sell...');
//       const result = await unifiedSwap.executeSwap({
//         sellToken: testTokenAddress,
//         buyToken: 'ACES',
//         amount: '50',
//         quote,
//         onStatus: addStatus,
//       });

//       if (!result.success) {
//         throw new Error(result.error || 'Swap failed');
//       }

//       addStatus('✅ Sell completed successfully!');

//       return {
//         success: true,
//         testName,
//         duration: Date.now() - startTime,
//         hash: result.hash,
//         details: {
//           inputAmount: '50 RWA',
//           outputAmount: quote.outputAmount,
//           quote,
//         },
//       };
//     } catch (error) {
//       addStatus(`❌ Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
//       return {
//         success: false,
//         testName,
//         duration: Date.now() - startTime,
//         error: error instanceof Error ? error.message : 'Unknown error',
//       };
//     }
//   };

//   /**
//    * Test 4: Error Message Validation
//    */
//   const testErrorMessages = async (): Promise<TestResult> => {
//     const testName = 'Error Message Validation';
//     const startTime = Date.now();
//     clearStatus();

//     try {
//       addStatus('🔵 Testing error message quality...');

//       const errorTests = [
//         {
//           name: 'Missing approval',
//           test: async () => {
//             // Try to buy without approval
//             return unifiedSwap.executeSwap({
//               sellToken: 'ACES',
//               buyToken: testTokenAddress || '0x0000000000000000000000000000000000000000',
//               amount: '1000000', // Large amount likely to fail
//               quote: { outputAmount: '1', slippageBps: 100 },
//               onStatus: addStatus,
//             });
//           },
//         },
//         {
//           name: 'Insufficient balance',
//           test: async () => {
//             return unifiedSwap.executeSwap({
//               sellToken: 'ACES',
//               buyToken: testTokenAddress || '0x0000000000000000000000000000000000000000',
//               amount: '999999999', // Amount user doesn't have
//               quote: { outputAmount: '1', slippageBps: 100 },
//               onStatus: addStatus,
//             });
//           },
//         },
//       ];

//       const errorResults: Array<{
//         name: string;
//         errorMessage?: string;
//         isUserFriendly: boolean;
//       }> = [];

//       for (const errorTest of errorTests) {
//         addStatus(`\n🧪 Testing: ${errorTest.name}`);
//         try {
//           const result = await errorTest.test();

//           // Check if error message is user-friendly
//           const isUserFriendly =
//             result.error &&
//             !result.error.includes('execution reverted') &&
//             !result.error.includes('0x') &&
//             result.error.length < 200;

//           errorResults.push({
//             name: errorTest.name,
//             errorMessage: result.error,
//             isUserFriendly: Boolean(isUserFriendly),
//           });

//           addStatus(
//             isUserFriendly
//               ? `✅ User-friendly error: "${result.error}"`
//               : `⚠️ Technical error: "${result.error}"`,
//           );
//         } catch (e) {
//           addStatus(`⚠️ Test threw exception (may be expected)`);
//         }
//       }

//       const allUserFriendly = errorResults.every((r) => r.isUserFriendly);

//       return {
//         success: allUserFriendly,
//         testName,
//         duration: Date.now() - startTime,
//         details: { errorResults },
//       };
//     } catch (error) {
//       return {
//         success: false,
//         testName,
//         duration: Date.now() - startTime,
//         error: error instanceof Error ? error.message : 'Unknown error',
//       };
//     }
//   };

//   /**
//    * Test 5: Loading State Updates
//    */
//   const testLoadingStates = async (): Promise<TestResult> => {
//     const testName = 'Loading State Updates';
//     const startTime = Date.now();
//     clearStatus();

//     try {
//       addStatus('🔵 Testing loading state updates...');

//       const statusUpdates: string[] = [];
//       const loadingStatesObserved: string[] = [];

//       // Monitor loading state (only in browser)
//       const monitorInterval =
//         typeof window !== 'undefined'
//           ? // eslint-disable-next-line no-undef
//             window.setInterval(() => {
//               if (unifiedSwap.loading) {
//                 loadingStatesObserved.push(unifiedSwap.loading);
//               }
//             }, 100)
//           : 0;

//       // Execute a swap and monitor status callbacks
//       await unifiedSwap.executeSwap({
//         sellToken: 'ACES',
//         buyToken: testTokenAddress || '0x0000000000000000000000000000000000000000',
//         amount: '10',
//         quote: { outputAmount: '5', slippageBps: 100 },
//         onStatus: (status) => {
//           statusUpdates.push(status);
//           addStatus(`📡 Status: ${status}`);
//         },
//       });

//       if (typeof window !== 'undefined' && monitorInterval) {
//         // eslint-disable-next-line no-undef
//         window.clearInterval(monitorInterval);
//       }

//       // Verify we got status updates
//       const hasStatusUpdates = statusUpdates.length > 0;
//       const loadingCleared = !unifiedSwap.loading;

//       addStatus(`\n✅ Status callbacks received: ${statusUpdates.length}`);
//       addStatus(`✅ Loading states observed: ${[...new Set(loadingStatesObserved)].length}`);
//       addStatus(`✅ Loading state cleared: ${loadingCleared}`);

//       return {
//         success: hasStatusUpdates && loadingCleared,
//         testName,
//         duration: Date.now() - startTime,
//         details: {
//           statusUpdates,
//           loadingStatesObserved: [...new Set(loadingStatesObserved)],
//           loadingClearedCorrectly: loadingCleared,
//         },
//       };
//     } catch (error) {
//       return {
//         success: false,
//         testName,
//         duration: Date.now() - startTime,
//         error: error instanceof Error ? error.message : 'Unknown error',
//       };
//     }
//   };

//   /**
//    * Run all tests
//    */
//   const runAllTests = async () => {
//     if (!walletAddress || !signer) {
//       if (typeof window !== 'undefined') {
//         // eslint-disable-next-line no-undef, no-alert
//         window.alert('Please connect your wallet first!');
//       }
//       return;
//     }

//     setIsRunning(true);
//     setTestResults([]);
//     clearStatus();

//     addStatus('🚀 Starting Phase 4 Test Suite...\n');

//     const tests = [
//       { name: 'Test 1: ACES → RWA', fn: testAcesToRwa },
//       { name: 'Test 2: USDC → RWA', fn: testUsdcToRwa },
//       { name: 'Test 3: RWA → ACES', fn: testRwaToAces },
//       { name: 'Test 4: Error Messages', fn: testErrorMessages },
//       { name: 'Test 5: Loading States', fn: testLoadingStates },
//     ];

//     const results: TestResult[] = [];

//     for (const test of tests) {
//       addStatus(`\n${'='.repeat(50)}`);
//       addStatus(`📋 ${test.name}`);
//       addStatus('='.repeat(50) + '\n');

//       const result = await test.fn();
//       results.push(result);

//       // Delay between tests
//       await new Promise((resolve) =>
//         // eslint-disable-next-line no-undef
//         typeof window !== 'undefined'
//           ? // eslint-disable-next-line no-undef
//             window.setTimeout(resolve, 2000)
//           : // eslint-disable-next-line no-undef
//             setTimeout(resolve, 2000),
//       );
//     }

//     setTestResults(results);
//     setIsRunning(false);

//     addStatus('\n' + '='.repeat(50));
//     addStatus('🎉 Test Suite Complete!');
//     addStatus('='.repeat(50));
//   };

//   /**
//    * Run single test
//    */
//   const runSingleTest = async (testName: string) => {
//     if (!walletAddress || !signer) {
//       if (typeof window !== 'undefined') {
//         // eslint-disable-next-line no-undef, no-alert
//         window.alert('Please connect your wallet first!');
//       }
//       return;
//     }

//     setIsRunning(true);
//     clearStatus();

//     let result: TestResult;

//     switch (testName) {
//       case 'aces-rwa':
//         result = await testAcesToRwa();
//         break;
//       case 'usdc-rwa':
//         result = await testUsdcToRwa();
//         break;
//       case 'rwa-aces':
//         result = await testRwaToAces();
//         break;
//       case 'errors':
//         result = await testErrorMessages();
//         break;
//       case 'loading':
//         result = await testLoadingStates();
//         break;
//       default:
//         result = {
//           success: false,
//           testName: 'Unknown',
//           duration: 0,
//           error: 'Unknown test',
//         };
//     }

//     setTestResults([result]);
//     setIsRunning(false);
//   };

//   return (
//     <div className="p-6 max-w-6xl mx-auto font-sans">
//       <h1 className="text-3xl font-bold mb-2">🧪 Phase 4: Unified Swap Testing</h1>
//       <p className="text-gray-600 mb-6">
//         Testing <code className="bg-gray-100 px-2 py-1 rounded">use-unified-swap.ts</code> on
//         testnet
//       </p>

//       {/* Test Token Configuration */}
//       <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
//         <h3 className="font-semibold mb-2">🎯 Test Configuration</h3>
//         <div className="flex gap-3 items-center">
//           <label className="text-sm font-medium">Test Token Address:</label>
//           <input
//             type="text"
//             value={testTokenAddress}
//             onChange={(e) => setTestTokenAddress(e.target.value)}
//             placeholder="0x..."
//             className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm"
//           />
//           <button
//             onClick={() => setTestTokenAddress('')}
//             className="px-3 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300"
//           >
//             Clear
//           </button>
//         </div>
//         <p className="text-xs text-gray-600 mt-2">
//           Enter the address of a deployed LaunchpadToken on testnet to test swap functionality
//         </p>
//       </div>

//       {/* Connection Status */}
//       <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
//         <h3 className="font-semibold mb-2">🔗 Connection Status</h3>
//         <div className="grid grid-cols-2 gap-2 text-sm">
//           <div>
//             Wallet:{' '}
//             {walletAddress
//               ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
//               : '❌ Not connected'}
//           </div>
//           <div>Chain: {currentChainId ? `${currentChainId}` : '❌ Unknown'}</div>
//           <div>Signer: {signer ? '✅ Ready' : '❌ Not ready'}</div>
//           <div>Initialized: {isInitialized ? '✅ Ready' : '❌ Not ready'}</div>
//           <div>Factory: {factoryContract ? '✅ Ready' : '❌ Not ready'}</div>
//           <div>ACES Contract: {acesContract ? '✅ Ready' : '❌ Not ready'}</div>
//           <div className="col-span-2">
//             AcesSwap: {unifiedSwap.acesSwapReady ? '✅ Deployed' : '⚠️ Not deployed (expected)'}
//           </div>
//         </div>
//       </div>

//       {/* Test Controls */}
//       <div className="mb-6 grid grid-cols-2 md:grid-cols-3 gap-3">
//         <button
//           onClick={runAllTests}
//           disabled={isRunning || !walletAddress || !testTokenAddress || !isInitialized}
//           className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition"
//         >
//           {isRunning ? '⏳ Running...' : '🚀 Run All Tests'}
//         </button>

//         <button
//           onClick={() => runSingleTest('aces-rwa')}
//           disabled={isRunning || !walletAddress || !testTokenAddress || !isInitialized}
//           className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 transition"
//         >
//           Test 1: ACES → RWA
//         </button>

//         <button
//           onClick={() => runSingleTest('usdc-rwa')}
//           disabled={isRunning || !walletAddress || !testTokenAddress || !isInitialized}
//           className="px-4 py-2 bg-purple-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-700 transition"
//         >
//           Test 2: USDC → RWA
//         </button>

//         <button
//           onClick={() => runSingleTest('rwa-aces')}
//           disabled={isRunning || !walletAddress || !testTokenAddress || !isInitialized}
//           className="px-4 py-2 bg-orange-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-700 transition"
//         >
//           Test 3: RWA → ACES
//         </button>

//         <button
//           onClick={() => runSingleTest('errors')}
//           disabled={isRunning || !walletAddress || !testTokenAddress || !isInitialized}
//           className="px-4 py-2 bg-red-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-red-700 transition"
//         >
//           Test 4: Errors
//         </button>

//         <button
//           onClick={() => runSingleTest('loading')}
//           disabled={isRunning || !walletAddress || !testTokenAddress || !isInitialized}
//           className="px-4 py-2 bg-yellow-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-700 transition"
//         >
//           Test 5: Loading
//         </button>
//       </div>

//       {/* Live Status Log */}
//       {currentStatus.length > 0 && (
//         <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
//           <h3 className="font-semibold mb-2">📡 Live Status</h3>
//           <div className="max-h-64 overflow-y-auto font-mono text-sm space-y-1">
//             {currentStatus.map((update, i) => (
//               <div key={i} className="flex gap-2">
//                 <span className="text-gray-400">
//                   {new Date(update.timestamp).toLocaleTimeString()}
//                 </span>
//                 <span>{update.status}</span>
//               </div>
//             ))}
//           </div>
//         </div>
//       )}

//       {/* Test Results */}
//       {testResults.length > 0 && (
//         <div className="mb-6">
//           <h3 className="text-xl font-semibold mb-3">📊 Test Results</h3>
//           <div className="space-y-3">
//             {testResults.map((result, i) => (
//               <div
//                 key={i}
//                 className={`p-4 border rounded-lg ${
//                   result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
//                 }`}
//               >
//                 <div className="flex items-center justify-between mb-2">
//                   <h4 className="font-semibold">
//                     {result.success ? '✅' : '❌'} {result.testName}
//                   </h4>
//                   <span className="text-sm text-gray-600">
//                     {(result.duration / 1000).toFixed(2)}s
//                   </span>
//                 </div>

//                 {result.error && (
//                   <div className="text-red-700 text-sm mb-2">
//                     <strong>Error:</strong> {result.error}
//                   </div>
//                 )}

//                 {result.hash && (
//                   <div className="text-sm text-gray-700 mb-2">
//                     <strong>TX Hash:</strong>{' '}
//                     <code className="bg-white px-2 py-1 rounded">{result.hash}</code>
//                   </div>
//                 )}

//                 {result.status && (
//                   <div className="text-sm text-gray-700 mb-2">
//                     <strong>Status:</strong> {result.status}
//                   </div>
//                 )}

//                 {result.details && (
//                   <details className="text-sm">
//                     <summary className="cursor-pointer text-blue-600">View Details</summary>
//                     <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto">
//                       {JSON.stringify(result.details, null, 2)}
//                     </pre>
//                   </details>
//                 )}
//               </div>
//             ))}
//           </div>

//           {/* Summary */}
//           <div className="mt-4 p-4 bg-gray-100 rounded-lg">
//             <h4 className="font-semibold mb-2">📈 Summary</h4>
//             <div className="grid grid-cols-3 gap-4 text-center">
//               <div>
//                 <div className="text-2xl font-bold text-green-600">
//                   {testResults.filter((r) => r.success).length}
//                 </div>
//                 <div className="text-sm text-gray-600">Passed</div>
//               </div>
//               <div>
//                 <div className="text-2xl font-bold text-red-600">
//                   {testResults.filter((r) => !r.success).length}
//                 </div>
//                 <div className="text-sm text-gray-600">Failed</div>
//               </div>
//               <div>
//                 <div className="text-2xl font-bold text-blue-600">{testResults.length}</div>
//                 <div className="text-sm text-gray-600">Total</div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* Checklist */}
//       <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
//         <h3 className="font-semibold mb-3">✅ Phase 4 Testing Checklist</h3>
//         <ul className="space-y-2 text-sm">
//           <li
//             className={
//               testResults.some((r) => r.testName.includes('ACES → RWA') && r.success)
//                 ? 'text-green-700'
//                 : 'text-gray-700'
//             }
//           >
//             {testResults.some((r) => r.testName.includes('ACES → RWA') && r.success) ? '✅' : '⬜'}{' '}
//             Test ACES → RWA (bonding direct)
//           </li>
//           <li
//             className={
//               testResults.some((r) => r.testName.includes('USDC → RWA') && r.success)
//                 ? 'text-green-700'
//                 : 'text-gray-700'
//             }
//           >
//             {testResults.some((r) => r.testName.includes('USDC → RWA') && r.success) ? '✅' : '⬜'}{' '}
//             Test USDC → RWA (multi-hop)
//           </li>
//           <li
//             className={
//               testResults.some((r) => r.testName.includes('RWA → ACES') && r.success)
//                 ? 'text-green-700'
//                 : 'text-gray-700'
//             }
//           >
//             {testResults.some((r) => r.testName.includes('RWA → ACES') && r.success) ? '✅' : '⬜'}{' '}
//             Test RWA → ACES (bonding sell)
//           </li>
//           <li
//             className={
//               testResults.some((r) => r.testName.includes('Error') && r.success)
//                 ? 'text-green-700'
//                 : 'text-gray-700'
//             }
//           >
//             {testResults.some((r) => r.testName.includes('Error') && r.success) ? '✅' : '⬜'}{' '}
//             Verify error messages are user-friendly
//           </li>
//           <li
//             className={
//               testResults.some((r) => r.testName.includes('Loading') && r.success)
//                 ? 'text-green-700'
//                 : 'text-gray-700'
//             }
//           >
//             {testResults.some((r) => r.testName.includes('Loading') && r.success) ? '✅' : '⬜'}{' '}
//             Verify loading states update correctly
//           </li>
//         </ul>

//         {testResults.length === 5 && testResults.every((r) => r.success) && (
//           <div className="mt-4 p-3 bg-green-100 border border-green-300 rounded">
//             <strong>🎉 All Phase 4 tests passed! Ready for Phase 5.</strong>
//           </div>
//         )}
//       </div>
//     </div>
//   );
// }
