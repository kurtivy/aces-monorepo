'use client';
import { ShoppingBag, Zap, TrendingUp, ExternalLink } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface ActivityEvent {
  event: string;
  price: number;
  from: string;
  to: string;
  time: string;
}

interface ActivityTabProps {
  activity: ActivityEvent[];
}

export function ActivityTab({ activity = [] }: ActivityTabProps) {
  return (
    <div className="flex flex-col h-full max-h-96">
      {' '}
      {/* Add max-height constraint */}
      {/* Scrollable container with fixed height */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {' '}
        {/* min-h-0 is important for flex children */}
        <Table>
          <TableHeader className="sticky top-0 bg-[#231F20] z-10">
            <TableRow className="border-gray-700/50">
              <TableHead className="text-[#D0B284] font-mono text-xs">EVENT</TableHead>
              <TableHead className="text-[#D0B284] font-mono text-xs">PRICE</TableHead>
              <TableHead className="text-[#D0B284] font-mono text-xs">FROM</TableHead>
              <TableHead className="text-[#D0B284] font-mono text-xs">TO</TableHead>
              <TableHead className="text-[#D0B284] font-mono text-xs text-right">TIME</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {activity.map((item, index) => (
              <TableRow key={index} className="border-gray-700/30">
                <TableCell className="text-white font-mono text-sm">
                  <div className="flex items-center gap-2">
                    {item.event === 'Mint' ? (
                      <Zap className="h-4 w-4 text-[#D0B284]" />
                    ) : item.event === 'Bid' ? (
                      <TrendingUp className="h-4 w-4 text-[#D0B284]" />
                    ) : (
                      <ShoppingBag className="h-4 w-4 text-[#D0B284]" />
                    )}
                    <span>{item.event}</span>
                  </div>
                </TableCell>
                <TableCell className="text-white font-mono text-sm">{item.price} ETH</TableCell>
                <TableCell className="text-white font-mono text-sm">{item.from}</TableCell>
                <TableCell className="text-white font-mono text-sm">{item.to}</TableCell>
                <TableCell className="text-right">
                  <a
                    href="#"
                    className="flex items-center gap-1 text-[#DCDDCC] hover:text-[#D0B284] font-mono text-xs justify-end"
                  >
                    {item.time} <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {activity.length === 0 && (
        <div className="text-center text-[#DCDDCC] py-8">No activity to display.</div>
      )}
    </div>
  );
}
