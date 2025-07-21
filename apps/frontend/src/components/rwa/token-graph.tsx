// 'use client';

// import type React from 'react';
// import Image from 'next/image';
// import { useEffect, useRef, memo } from 'react';
// import OfferDrawer from './drawers/offer-drawer';
// import CheckoutDrawer from './drawers/checkout-drawer';

// interface TradingViewWidgetProps {
//   interval?: string;
//   symbol?: string;
// }

// const TradingViewWidget = memo(
//   ({ interval = 'D', symbol = 'BINANCE:ETHUSDT' }: TradingViewWidgetProps) => {
//     const container = useRef<HTMLDivElement>(null);

//     useEffect(() => {
//       const currentContainer = container.current;
//       // Clear previous widget
//       if (currentContainer) {
//         currentContainer.innerHTML = '';
//       }

//       const script = document.createElement('script');
//       script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
//       script.type = 'text/javascript';
//       script.async = true;
//       script.innerHTML = `
//         {
//           "allow_symbol_change": true,
//           "calendar": false,
//           "details": false,
//           "hide_side_toolbar": false,
//           "hide_top_toolbar": false,
//           "hide_legend": false,
//           "hide_volume": false,
//           "hotlist": false,
//           "interval": "${interval}",
//           "locale": "en",
//           "save_image": true,
//           "style": "1",
//           "symbol": "${symbol}",
//           "theme": "dark",
//           "timezone": "Etc/UTC",
//           "backgroundColor": "#231F20",
//           "gridColor": "rgba(208, 178, 132, 0.1)",
//           "watchlist": [],
//           "withdateranges": true,
//           "compareSymbols": [],
//           "studies": [],
//           "autosize": true,
//           "show_popup_button": false,
//           "popup_width": "1000",
//           "popup_height": "650",
//           "enable_publishing": false,
//           "hide_top_toolbar": false,
//           "hide_side_toolbar": false,
//           "allow_symbol_change": true,
//           "container_id": "tradingview_widget",
//           "drawings": true,
//           "show_timeframes_toolbar": true
//         }`;

//       // Create widget container structure
//       const widgetContainer = document.createElement('div');
//       widgetContainer.className = 'tradingview-widget-container__widget';
//       widgetContainer.style.height = '100%';
//       widgetContainer.style.width = '100%';

//       if (currentContainer) {
//         currentContainer.appendChild(widgetContainer);
//         currentContainer.appendChild(script);
//       }

//       // Cleanup function
//       return () => {
//         if (currentContainer) {
//           currentContainer.innerHTML = '';
//         }
//       };
//     }, [interval, symbol]);

//     return (
//       <div
//         className="tradingview-widget-container relative h-full w-full"
//         ref={container}
//         style={{ height: '100%', width: '100%' }}
//       />
//     );
//   },
// );

// TradingViewWidget.displayName = 'TradingViewWidget';

// // Main Token Graph Component
// interface TokenGraphProps {
//   tokenSymbol?: string;
//   title?: string;
//   imageSrc?: string;
//   tokenAddress?: string;
//   fdv?: string;
//   createdAt?: string;
//   volume?: string;
//   // Added for consistency with page.tsx usage, though not directly used in this component's display logic
//   currentPrice?: number;
//   priceChange?: number;
// }

// const TokenGraph: React.FC<TokenGraphProps> = ({
//   tokenSymbol = 'ETH',
//   title = 'South African Gold Krugerrands',
//   imageSrc = '/canvas-images/10xSouth-African-Gold-Krugerrands.webp',
//   tokenAddress = '0x7300...0219FE',
//   fdv = '$18.12m',
//   createdAt = '2 mo ago',
// }) => {
//   const copyToClipboard = async (text: string) => {
//     try {
//       await navigator.clipboard.writeText(text);
//       // You could add a toast notification here
//     } catch (err) {
//       console.error('Failed to copy text: ', err);
//     }
//   };

//   const getSymbol = (tokenSymbol: string) => {
//     const symbolMap: Record<string, string> = {
//       ETH: 'BINANCE:ETHUSDT',
//       BTC: 'BINANCE:BTCUSDT',
//       KRUGER: 'BINANCE:ETHUSDT', // Default to ETH for custom tokens
//       RWA: 'BINANCE:ETHUSDT',
//     };
//     return symbolMap[tokenSymbol] || 'BINANCE:ETHUSDT';
//   };

//   return (
//     <div className="flex flex-col h-full w-full bg-[#231f20]/50 rounded-xl overflow-hidden">
//       {/* Header with price info */}
//       <div className="space-y-4 p-5">
//         <div className="flex items-center justify-between">
//           <div className="flex items-center gap-4">
//             <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-[#D0B284]/20">
//               <Image
//                 src={imageSrc || '/placeholder.svg'}
//                 alt={title}
//                 width={48}
//                 height={48}
//                 className="object-cover"
//               />
//             </div>
//             <div>
//               <h1 className="text-2xl font-bold text-[#FFFFFF] font-heading">
//                 {title} <span className="text-sm text-[#DCDDCC]">{`$${tokenSymbol}`}</span>
//               </h1>
//               <div className="mt-2">
//                 <div className="flex items-center gap-2 rounded-md bg-[#231F20]/60 px-2 py-1.5 border border-[#D0B284]/20 w-fit">
//                   <span className="text-xs text-[#DCDDCC] font-mono">{tokenAddress}</span>
//                   <button
//                     onClick={() => copyToClipboard(tokenAddress)}
//                     className="flex h-5 w-5 items-center justify-center rounded bg-[#D0B284]/10 hover:bg-[#D0B284]/20 transition-colors border border-[#D0B284]/20"
//                   >
//                     <svg
//                       width="12"
//                       height="12"
//                       viewBox="0 0 24 24"
//                       fill="none"
//                       stroke="#D0B284"
//                       strokeWidth="2"
//                       strokeLinecap="round"
//                       strokeLinejoin="round"
//                     >
//                       <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
//                       <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
//                     </svg>
//                   </button>
//                 </div>
//               </div>
//             </div>
//           </div>
//           <div className="flex flex-col items-end gap-4">
//             <div className="flex items-center gap-6 text-sm">
//               <div className="flex flex-col items-center">
//                 <span className="text-[#DCDDCC]">FDV</span>
//                 <span className="text-white">{fdv}</span>
//               </div>
//               <div className="flex flex-col items-center">
//                 <span className="text-[#DCDDCC]">Created At</span>
//                 <span className="text-white">{createdAt}</span>
//               </div>
//             </div>
//             <div className="flex gap-3 w-full">
//               <OfferDrawer
//                 itemTitle={title}
//                 itemImage={imageSrc}
//                 tokenAddress={tokenAddress}
//                 onOfferSubmit={(amount, duration) => {
//                   console.log('Offer submitted:', { amount, duration });
//                   // Add your offer submission logic here
//                 }}
//               >
//                 <button className="flex-1 rounded-xl border border-[#D0B284] px-8 py-1 text-sm font-bold bg-black text-[#D0B284] hover:bg-[#D0B284]/10 transition-colors whitespace-nowrap">
//                   MAKE OFFER
//                 </button>
//               </OfferDrawer>
//               <CheckoutDrawer
//                 itemTitle={title}
//                 itemImage={imageSrc}
//                 itemPrice="13.6849 ETH"
//                 itemPriceUSD="$47K"
//                 collectionName="ACES Collection"
//                 tokenId="2470"
//                 tokenAddress={tokenAddress}
//                 onPurchase={(paymentMethod) => {
//                   console.log('Purchase completed with:', paymentMethod);
//                   // Add your purchase logic here
//                 }}
//               >
//                 <button className="flex-1 rounded-xl bg-[#D0B284] px-8 py-1 text-sm font-bold text-[#231F20] hover:bg-[#D0B284]/90 transition-colors whitespace-nowrap">
//                   BUY NOW
//                 </button>
//               </CheckoutDrawer>
//             </div>
//           </div>
//         </div>
//       </div>

//       {/* TradingView Chart */}
//       <div className="flex-1 w-full bg-[#231F20] rounded-none border-t border-[#D0B284]/20 overflow-hidden">
//         <TradingViewWidget interval="D" symbol={getSymbol(tokenSymbol)} />
//       </div>
//     </div>
//   );
// };

// export default TokenGraph;
