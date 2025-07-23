'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';

interface TokenData {
  id: string;
  title: string;
  ticker: string;
  image: string;
  contractAddress: string;
  category: string;
  amount: number;
  totalInEth: number;
  totalInAces: number;
  totalInUSD: number;
}

interface TokenListTabProps {
  tokens?: TokenData[];
}

// Generate dummy contract addresses
const generateContractAddress = (id: string): string => {
  const addresses = [
    '0x8ac9...07b506',
    '0xbf85...298c36',
    '0x60b0...3be80f',
    '0x4f9f...d1a826',
    '0x6ea5...78c3af',
  ];
  return addresses[Number.parseInt(id) % addresses.length] || '0x1234...5678';
};

// Categorize items
const getCategoryFromTitle = (title: string): string => {
  if (title.includes('Porsche') || title.includes('McLaren') || title.includes('Lamborghini'))
    return 'Cars';
  if (title.includes('Audemars') || title.includes('Richard Mille')) return 'Watches';
  if (title.includes('Warhol') || title.includes('Haring')) return 'Art';
  if (title.includes('Brady') || title.includes('Ohtani') || title.includes('Barzal'))
    return 'Sports';
  if (title.includes('Nike') || title.includes('Sneakers')) return 'Sneakers';
  if (title.includes('Hermès') || title.includes('Louis Vuitton') || title.includes('Tiffany'))
    return 'Luxury Goods';
  if (
    title.includes('Macallan') ||
    title.includes('Louis XIII') ||
    title.includes('Krug') ||
    title.includes('Veuve')
  )
    return 'Spirits';
  if (title.includes('Krugerrand') || title.includes('Gold')) return 'Precious Metals';
  if (title.includes('iPhone')) return 'Tech';
  if (title.includes('Kanye') || title.includes('Vinyl')) return 'Music';
  if (title.includes('Azimut')) return 'Marine';
  return 'Collectibles';
};

// Sample data from the metadata
const SAMPLE_TOKENS: TokenData[] = [
  {
    id: '2',
    title: '1991 Porsche 964 Turbo',
    ticker: '$P964',
    image: '/placeholder.svg?height=40&width=40',
    contractAddress: generateContractAddress('2'),
    category: getCategoryFromTitle('1991 Porsche 964 Turbo'),
    amount: 14931,
    totalInEth: 5.6327,
    totalInAces: 43.837416,
    totalInUSD: 18420.5,
  },
  {
    id: '7',
    title: 'Audemars Piguet Royal Oak KAWS',
    ticker: '$APKAWS',
    image: '/placeholder.svg?height=40&width=40',
    contractAddress: generateContractAddress('7'),
    category: getCategoryFromTitle('Audemars Piguet Royal Oak KAWS'),
    amount: 11675,
    totalInEth: 6.6129,
    totalInAces: 30.950425,
    totalInUSD: 21650.75,
  },
  {
    id: '4',
    title: '2010 Lamborghini Murcielago SV',
    ticker: '$LAMBOSV',
    image: '/placeholder.svg?height=40&width=40',
    contractAddress: generateContractAddress('4'),
    category: getCategoryFromTitle('2010 Lamborghini Murcielago SV'),
    amount: 859,
    totalInEth: 13.4423,
    totalInAces: 0.005103,
    totalInUSD: 44000.0,
  },
  {
    id: '6',
    title: 'Andy Warhol Signed "Marilyn Monroe"',
    ticker: '$WARHOL',
    image: '/placeholder.svg?height=40&width=40',
    contractAddress: generateContractAddress('6'),
    category: getCategoryFromTitle('Andy Warhol Signed "Marilyn Monroe"'),
    amount: 2500,
    totalInEth: 44.205,
    totalInAces: 125.5,
    totalInUSD: 144820.0,
  },
  {
    id: '9',
    title: 'Hermès Himalaya Kelly Retourne 32',
    ticker: '$HIMALY',
    image: '/placeholder.svg?height=40&width=40',
    contractAddress: generateContractAddress('9'),
    category: getCategoryFromTitle('Hermès Himalaya Kelly Retourne 32'),
    amount: 1200,
    totalInEth: 4.4725,
    totalInAces: 89.25,
    totalInUSD: 14650.0,
  },
];

export function TokenListTab({ tokens = SAMPLE_TOKENS }: TokenListTabProps) {
  // Calculate total portfolio values
  const totalEth = tokens.reduce((sum, token) => sum + token.totalInEth, 0);
  const totalUsd = tokens.reduce((sum, token) => sum + token.totalInUSD, 0);

  return (
    <div className="w-full rounded-xl bg-[#231F20] border border-[#D0B284]/20 shadow-lg overflow-hidden">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="text-2xl font-bold text-white font-libre-caslon mb-1">
              {totalEth.toFixed(6)} ETH
            </div>
            <div className="text-[#DCDDCC] text-sm">${totalUsd.toLocaleString()}</div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-[#D0B284]/20">
                <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  RWA
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Ticker
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Contract
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Action
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Amount
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Total ETH
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Total ACES
                </th>
                <th className="text-right text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-2">
                  Total USD
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody>
              {tokens.map((token) => (
                <tr
                  key={token.id}
                  className="border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5 transition-colors duration-200"
                >
                  {/* RWA Info */}
                  <td className="py-4 px-2">
                    <div className="flex items-center space-x-3">
                      <div className="relative">
                        <Image
                          src={token.image || '/placeholder.svg'}
                          alt={token.title}
                          className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                          width={40}
                          height={40}
                        />
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full border-2 border-[#231F20] flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate text-sm">
                          {token.title.split(' ').slice(0, 2).join(' ')}
                        </h3>
                        <Badge
                          variant="secondary"
                          className="bg-[#D0B284]/10 text-[#D0B284] text-xs px-2 py-0.5 mt-1"
                        >
                          {token.category}
                        </Badge>
                      </div>
                    </div>
                  </td>

                  {/* Ticker */}
                  <td className="py-4 px-2 text-center">
                    <span className="text-[#DCDDCC] font-jetbrains text-sm">{token.ticker}</span>
                  </td>

                  {/* Contract Address */}
                  <td className="py-4 px-2 text-center">
                    <span className="text-[#DCDDCC] font-jetbrains text-xs">
                      {token.contractAddress}
                    </span>
                  </td>

                  {/* Action Button */}
                  <td className="py-4 px-2 text-center">
                    <Button
                      size="sm"
                      className="bg-[#184D37] hover:bg-[#184D37]/80 text-white px-3 py-1 text-xs"
                    >
                      View Asset
                    </Button>
                  </td>

                  {/* Amount */}
                  <td className="py-4 px-2 text-center">
                    <span className="text-white font-medium text-sm">
                      {token.amount.toLocaleString()}
                    </span>
                  </td>

                  {/* Total in ETH */}
                  <td className="py-4 px-2 text-center">
                    <span className="text-white font-medium text-sm">
                      {token.totalInEth.toFixed(4)}
                    </span>
                  </td>

                  {/* Total in ACES */}
                  <td className="py-4 px-2 text-center">
                    <span className="text-white font-medium text-sm">
                      {token.totalInAces.toFixed(6)}
                    </span>
                  </td>

                  {/* Total in USD */}
                  <td className="py-4 px-2 text-right">
                    <span className="text-[#D0B284] font-medium text-sm">
                      ${token.totalInUSD.toLocaleString()}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
