// 'use client';
// import { useState } from 'react';
// import { ChevronDown, ChevronUp } from 'lucide-react';
// import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

// interface ProductInfoAccordionProps {
//   aboutAsset: React.ReactNode;
//   assetDetails: React.ReactNode;
//   askQuestion: React.ReactNode;
//   forSaleBy: React.ReactNode;
//   defaultOpen?: boolean;
// }

// // Component to handle the expandable content
// function ExpandableContent({ children }: { children: React.ReactNode }) {
//   const [isExpanded, setIsExpanded] = useState(false);

//   // Simple approach: use a ref to measure content height instead of parsing text
//   const contentRef = useState<HTMLDivElement | null>(null);
//   const [shouldTruncate, setShouldTruncate] = useState(true); // Default to showing truncated view

//   return (
//     <div>
//       <div
//         ref={(el) => {
//           if (el && contentRef[0] !== el) {
//             contentRef[1](el);
//             // Check if content is actually long enough to need truncation
//             const fullHeight = el.scrollHeight;
//             const visibleHeight = el.clientHeight;
//             if (fullHeight <= visibleHeight * 1.5) {
//               setShouldTruncate(false);
//             }
//           }
//         }}
//         className={`${!isExpanded && shouldTruncate ? 'line-clamp-6' : ''} overflow-hidden`}
//       >
//         {children}
//       </div>
//       {shouldTruncate && (
//         <button
//           onClick={() => setIsExpanded(!isExpanded)}
//           className="text-[#D0B284] hover:text-[#D7BF75] font-medium mt-4 transition-colors"
//         >
//           {isExpanded ? 'view less' : 'view more'}
//         </button>
//       )}
//     </div>
//   );
// }

// export function ProductInfoAccordion({
//   aboutAsset,
//   assetDetails,
//   askQuestion,
//   forSaleBy,
//   defaultOpen = true,
// }: ProductInfoAccordionProps) {
//   const [isOpen, setIsOpen] = useState(defaultOpen);

//   return (
//     <div className="space-y-4">
//       <Collapsible open={isOpen} onOpenChange={setIsOpen}>
//         <CollapsibleTrigger asChild>
//           <button className="w-full bg-[#231f20]/50 rounded-xl p-4 flex items-center justify-between hover:bg-[#231f20]/70 transition-colors border border-[#D0B284]/20 group">
//             <h2 className="text-xl font-bold text-white font-heading group-hover:text-[#D0B284] transition-colors">
//               Product Information
//             </h2>
//             <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#D0B284]/10 group-hover:bg-[#D0B284]/20 transition-colors">
//               {isOpen ? (
//                 <ChevronUp className="w-5 h-5 text-[#D0B284]" />
//               ) : (
//                 <ChevronDown className="w-5 h-5 text-[#D0B284]" />
//               )}
//             </div>
//           </button>
//         </CollapsibleTrigger>
//         <CollapsibleContent className="space-y-6 mt-4 animate-in slide-in-from-top-2 duration-200">
//           {/* About This Asset */}
//           <div className="bg-[#231f20]/50 rounded-xl p-6">
//             <h3 className="text-2xl font-bold text-white font-heading mb-4">About This Asset</h3>
//             <ExpandableContent>{aboutAsset}</ExpandableContent>
//           </div>

//           {/* Asset Details */}
//           <div className="bg-[#231f20]/50 rounded-xl p-6">
//             <h3 className="text-2xl font-bold text-white font-heading mb-6">Asset Details</h3>
//             {assetDetails}
//           </div>

//           {/* Ask a Question */}
//           <div className="bg-[#231f20]/50 rounded-xl p-6">
//             <h3 className="text-2xl font-bold text-white font-heading mb-6">
//               Request More Information
//             </h3>
//             {askQuestion}
//           </div>

//           {/* For Sale by */}
//           <div className="bg-[#231f20]/50 rounded-xl p-6">
//             <h3 className="text-2xl font-bold text-white font-heading mb-4">Seller Information</h3>
//             {forSaleBy}
//           </div>
//         </CollapsibleContent>
//       </Collapsible>
//     </div>
//   );
// }
