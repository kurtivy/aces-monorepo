// // components/WalletView.tsx
// 'use client';

// import { useState } from 'react';
// import { usePrivyWallet } from '@/hooks/use-privy-wallet';
// import { Button } from '@/components/ui/button';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge';
// import {
//   Wallet,
//   Eye,
//   ExternalLink,
//   Copy,
//   RefreshCw,
//   TrendingUp,
//   Clock,
//   CheckCircle,
// } from 'lucide-react';

// interface WalletViewProps {
//   className?: string;
// }

// export function WalletView({ className = '' }: WalletViewProps) {
//   const { hasEmbeddedWallet, hasExternalWallet, primaryWallet,  } = usePrivyWallet();

// //   const { balance, isLoadingBalance, refreshBalance, walletAddress } = useWalletInfo();

//   const [copied, setCopied] = useState(false);

//   const copyAddress = async () => {
//     if (walletAddress) {
//       await navigator.clipboard.writeText(walletAddress);
//       setCopied(true);
//       setTimeout(() => setCopied(false), 2000);
//     }
//   };

//   const openInBlockExplorer = () => {
//     if (walletAddress) {
//       const baseUrl = 'https://basescan.org/address/';
//       window.open(`${baseUrl}${walletAddress}`, '_blank');
//     }
//   };

//   if (!primaryWallet) {
//     return (
//       <Card className={`${className} border-[#D0B284]/20`}>
//         <CardContent className="flex items-center justify-center py-8">
//           <p className="text-[#D0B284]/60">No wallet connected</p>
//         </CardContent>
//       </Card>
//     );
//   }

//   return (
//     <Card className={`${className} border-[#D0B284]/20 bg-black`}>
//       <CardHeader>
//         <CardTitle className="flex items-center gap-2 text-[#D0B284]">
//           <Wallet className="w-5 h-5" />
//           Your Wallet
//           <Badge
//             variant="outline"
//             className={`ml-auto ${hasEmbeddedWallet ? 'border-blue-400 text-blue-400' : 'border-green-400 text-green-400'}`}
//           >
//             {hasEmbeddedWallet ? 'Privy Wallet' : 'External Wallet'}
//           </Badge>
//         </CardTitle>
//       </CardHeader>

//       <CardContent className="space-y-4">
//         {/* Wallet Address */}
//         <div className="space-y-2">
//           <label className="text-sm text-[#D0B284]/60">Wallet Address</label>
//           <div className="flex items-center gap-2">
//             <code className="flex-1 px-3 py-2 bg-[#D0B284]/10 rounded text-[#D0B284] text-sm font-mono">
//               {walletAddress
//                 ? `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`
//                 : 'Loading...'}
//             </code>
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={copyAddress}
//               className="text-[#D0B284] hover:bg-[#D0B284]/20"
//             >
//               {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
//             </Button>
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={openInBlockExplorer}
//               className="text-[#D0B284] hover:bg-[#D0B284]/20"
//             >
//               <ExternalLink className="w-4 h-4" />
//             </Button>
//           </div>
//         </div>

//         {/* Balance */}
//         <div className="space-y-2">
//           <div className="flex items-center justify-between">
//             <label className="text-sm text-[#D0B284]/60">ETH Balance</label>
//             <Button
//               variant="ghost"
//               size="sm"
//               onClick={refreshBalance}
//               disabled={isLoadingBalance}
//               className="text-[#D0B284] hover:bg-[#D0B284]/20 h-auto p-1"
//             >
//               <RefreshCw className={`w-3 h-3 ${isLoadingBalance ? 'animate-spin' : ''}`} />
//             </Button>
//           </div>
//           <div className="px-3 py-2 bg-[#D0B284]/10 rounded">
//             <div className="text-[#D0B284] font-semibold">
//               {isLoadingBalance ? (
//                 <div className="flex items-center gap-2">
//                   <div className="w-4 h-4 border-2 border-[#D0B284] border-t-transparent rounded-full animate-spin" />
//                   Loading...
//                 </div>
//               ) : (
//                 `${balance ? parseFloat(balance).toFixed(6) : '0.000000'} ETH`
//               )}
//             </div>
//           </div>
//         </div>

//         {/* Wallet Actions */}
//         <div className="space-y-2">
//           {/* Privy's Built-in Wallet UI - This is the key feature! */}
//           {hasEmbeddedWallet && (
//             <Button
//               onClick={openWalletUI}
//               className="w-full bg-[#D0B284] text-black hover:bg-[#D0B284]/80"
//             >
//               <Eye className="w-4 h-4 mr-2" />
//               View Full Wallet
//             </Button>
//           )}

//           {/* External wallet note */}
//           {hasExternalWallet && (
//             <div className="text-sm text-[#D0B284]/60 text-center py-2 border border-[#D0B284]/20 rounded">
//               <div className="flex items-center justify-center gap-2 mb-1">
//                 <TrendingUp className="w-4 h-4" />
//                 External Wallet Connected
//               </div>
//               <p>Use your wallet extension to view full details</p>
//             </div>
//           )}
//         </div>

//         {/* Recent Activity Placeholder */}
//         <div className="space-y-2">
//           <label className="text-sm text-[#D0B284]/60">Recent Activity</label>
//           <div className="px-3 py-4 bg-[#D0B284]/10 rounded text-center">
//             <Clock className="w-6 h-6 text-[#D0B284]/40 mx-auto mb-2" />
//             <p className="text-sm text-[#D0B284]/60">
//               {hasEmbeddedWallet
//                 ? 'Click "View Full Wallet" to see transaction history'
//                 : 'Check your wallet extension for transaction history'}
//             </p>
//           </div>
//         </div>
//       </CardContent>
//     </Card>
//   );
// }
