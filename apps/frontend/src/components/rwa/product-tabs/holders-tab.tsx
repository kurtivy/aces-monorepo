// HoldersTab with proper scrolling
'use client';
import { Filter, ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Holder {
  rank: number;
  address: string;
  percentage: number;
  amount: number;
  value: number;
  txns: number;
  exp: string;
}

interface HoldersTabProps {
  holders: Holder[];
}

// Utility function to truncate addresses
const truncateAddress = (
  address: string,
  startLength: number = 6,
  endLength: number = 4,
): string => {
  if (address.length <= startLength + endLength + 3) {
    return address;
  }
  return `${address.slice(0, startLength)}...${address.slice(-endLength)}`;
};

export function HoldersTab({ holders = [] }: HoldersTabProps) {
  return (
    <div className="flex flex-col h-full max-h-64">
      {' '}
      {/* Add max-height constraint */}
      {/* Scrollable container with fixed height */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {' '}
        {/* min-h-0 is important for flex children */}
        <Table>
          <TableHeader className="sticky top-0 bg-[#231F20] z-10">
            <TableRow className="border-b border-[#D0B284]/10">
              <TableHead className="text-[#DCDDCC] font-mono text-xs">RANK</TableHead>
              <TableHead className="text-[#DCDDCC] font-mono text-xs">ADDRESS</TableHead>
              <TableHead className="text-[#DCDDCC] font-mono text-xs">%</TableHead>
              <TableHead className="text-[#DCDDCC] font-mono text-xs">AMOUNT</TableHead>
              <TableHead className="text-[#DCDDCC] font-mono text-xs">VALUE</TableHead>
              <TableHead className="text-[#DCDDCC] font-mono text-xs">TXNS</TableHead>
              <TableHead className="text-[#DCDDCC] font-mono text-xs text-right">EXP</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holders && holders.length > 0 ? (
              holders.map((holder) => (
                <TableRow
                  key={holder.rank}
                  className="border-b border-[#D0B284]/5 hover:bg-black/10"
                >
                  <TableCell className="text-[#DCDDCC] font-mono text-sm py-3">
                    #{holder.rank}
                  </TableCell>
                  <TableCell className="text-white font-mono text-sm">
                    {truncateAddress(holder.address)}
                  </TableCell>
                  <TableCell className="text-white font-mono text-sm">
                    {holder.percentage.toFixed(2)}%
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-mono text-sm">
                        {holder.amount.toLocaleString()}M
                      </span>
                      <div className="w-24 bg-black/40 rounded-full h-2">
                        <div
                          className="bg-[#D0B284] h-full rounded-full"
                          style={{ width: `${(holder.amount / 1000) * 100}%` }}
                        />
                      </div>
                      <span className="text-[#DCDDCC] font-mono text-sm">999.9M</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-white font-bold font-mono text-sm">
                    ${holder.value.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-[#DCDDCC] font-mono text-sm">{holder.txns}</TableCell>
                  <TableCell className="text-right">
                    <a
                      href="#"
                      className="inline-flex items-center gap-1 text-[#DCDDCC] hover:text-[#D0B284] font-mono text-xs"
                    >
                      <Filter className="h-3 w-3" /> <ExternalLink className="h-3 w-3" />
                    </a>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-[#DCDDCC] py-8">
                  No holders to display.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
