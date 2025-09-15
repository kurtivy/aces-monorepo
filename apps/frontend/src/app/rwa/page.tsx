// // app/rwa/page.tsx
// 'use client';

// import { useEffect } from 'react';
// import { useRouter } from 'next/navigation';
// import { supabase } from '@/lib/supabase/client';

// export default function RWARedirectPage() {
//   const router = useRouter();

//   useEffect(() => {
//     async function redirectToLiveItem() {
//       try {
//         // Find the live item
//         const { data, error } = await supabase
//           .from('items') // Replace with your actual table name
//           .select('symbol')
//           .eq('isLive', true)
//           .single();

//         if (error) {
//           console.error('Error fetching live item:', error);
//           // Could redirect to a "no items available" page
//           return;
//         }

//         if (data?.symbol) {
//           // Redirect to the dynamic route with the symbol
//           router.replace(`/rwa/${data.symbol}`);
//         }
//       } catch (err) {
//         console.error('Failed to redirect to live listing:', err);
//       }
//     }

//     redirectToLiveItem();
//   }, [router]); // Remove supabase from dependencies

//   return (
//     <div className="h-screen bg-black text-white flex items-center justify-center">
//       <div className="text-[#D0B284] text-lg">Loading...</div>
//     </div>
//   );
// }

export default function RWAPage() {
  return (
    <div className="h-screen bg-black text-white flex items-center justify-center">
      <div className="text-[#D0B284] text-lg">Loading...</div>
    </div>
  );
}
