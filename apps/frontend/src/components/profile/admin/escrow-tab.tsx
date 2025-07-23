'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Search,
  Eye,
  Package,
  CreditCard,
  Truck,
  CheckCircle,
  AlertTriangle,
  MessageCircle,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Image from 'next/image';

interface EscrowTransaction {
  id: string;
  listingName: string;
  listingTicker: string;
  listingImage: string;
  buyer: string;
  buyerAddress: string;
  seller: string;
  sellerAddress: string;
  amount: string;
  amountUSD: string;
  status:
    | 'payment_pending'
    | 'payment_received'
    | 'shipping_pending'
    | 'shipped'
    | 'delivered'
    | 'completed'
    | 'disputed';
  acceptedAt: string;
  paymentDeadline: string;
  shippingDeadline?: string;
  deliveryDeadline?: string;
  trackingNumber?: string;
  notes?: string;
}

const SAMPLE_ESCROW_TRANSACTIONS: EscrowTransaction[] = [
  {
    id: '1',
    listingName: 'Andy Warhol Marilyn Monroe',
    listingTicker: '$WARHOL',
    listingImage: '/placeholder.svg?height=40&width=40',
    buyer: 'ArtCollector',
    buyerAddress: '0x3c2e...7f8d',
    seller: 'Art Gallery NYC',
    sellerAddress: '0x60b0...3be80f',
    amount: '125.0 ETH',
    amountUSD: '$409,250',
    status: 'payment_received',
    acceptedAt: '2024-07-22 16:45',
    paymentDeadline: '2024-07-24 16:45',
    shippingDeadline: '2024-07-26 16:45',
    notes: 'Payment received. Awaiting seller to initiate shipping.',
  },
  {
    id: '2',
    listingName: 'Richard Mille RM-88 Smiley',
    listingTicker: '$RM88',
    listingImage: '/placeholder.svg?height=40&width=40',
    buyer: 'WatchCollector',
    buyerAddress: '0x8f1a...92b4',
    seller: 'Watch Dealer Pro',
    sellerAddress: '0x4f9f...d1a826',
    amount: '67.5 ETH',
    amountUSD: '$220,725',
    status: 'shipped',
    acceptedAt: '2024-07-20 14:30',
    paymentDeadline: '2024-07-22 14:30',
    shippingDeadline: '2024-07-24 14:30',
    deliveryDeadline: '2024-07-27 14:30',
    trackingNumber: '1Z999AA1234567890',
    notes: 'Item shipped via UPS. Tracking number provided to buyer.',
  },
  {
    id: '3',
    listingName: '1991 Porsche 964 Turbo',
    listingTicker: '$P964',
    listingImage: '/placeholder.svg?height=40&width=40',
    buyer: 'PorscheCollector',
    buyerAddress: '0x742d...35c3',
    seller: 'John Ferrari',
    sellerAddress: '0x8ac9...07b506',
    amount: '45.5 ETH',
    amountUSD: '$148,950',
    status: 'payment_pending',
    acceptedAt: '2024-07-23 14:30',
    paymentDeadline: '2024-07-25 14:30',
    notes: 'Bid accepted. Awaiting payment from buyer.',
  },
  {
    id: '4',
    listingName: 'Hermès Birkin Bag',
    listingTicker: '$BIRKIN',
    listingImage: '/placeholder.svg?height=40&width=40',
    buyer: 'LuxuryCollector',
    buyerAddress: '0x9d4b...1a2c',
    seller: 'Fashion House',
    sellerAddress: '0x6ea5...78c3af',
    amount: '12.8 ETH',
    amountUSD: '$41,856',
    status: 'disputed',
    acceptedAt: '2024-07-18 11:20',
    paymentDeadline: '2024-07-20 11:20',
    shippingDeadline: '2024-07-22 11:20',
    deliveryDeadline: '2024-07-25 11:20',
    trackingNumber: '1Z999AA9876543210',
    notes: 'Buyer claims item not as described. Dispute opened.',
  },
];

export function EscrowTab() {
  const [transactions, setTransactions] = useState(SAMPLE_ESCROW_TRANSACTIONS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedTransaction, setSelectedTransaction] = useState<EscrowTransaction | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const filteredTransactions = transactions
    .filter((transaction) => {
      const matchesSearch =
        transaction.listingName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.buyer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        transaction.seller.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === 'ALL' || transaction.status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => new Date(b.acceptedAt).getTime() - new Date(a.acceptedAt).getTime());

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'payment_pending':
        return 'text-[#D7BF75] bg-[#D7BF75]/10';
      case 'payment_received':
        return 'text-blue-400 bg-blue-400/10';
      case 'shipping_pending':
        return 'text-orange-400 bg-orange-400/10';
      case 'shipped':
        return 'text-purple-400 bg-purple-400/10';
      case 'delivered':
        return 'text-[#184D37] bg-[#184D37]/10';
      case 'completed':
        return 'text-[#D0B284] bg-[#D0B284]/10';
      case 'disputed':
        return 'text-red-400 bg-red-400/10';
      default:
        return 'text-[#DCDDCC] bg-[#DCDDCC]/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'payment_pending':
        return <CreditCard className="w-4 h-4" />;
      case 'payment_received':
        return <CheckCircle className="w-4 h-4" />;
      case 'shipping_pending':
        return <Package className="w-4 h-4" />;
      case 'shipped':
        return <Truck className="w-4 h-4" />;
      case 'delivered':
        return <CheckCircle className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'disputed':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'payment_pending':
        return 'Payment Pending';
      case 'payment_received':
        return 'Payment Received';
      case 'shipping_pending':
        return 'Shipping Pending';
      case 'shipped':
        return 'Shipped';
      case 'delivered':
        return 'Delivered';
      case 'completed':
        return 'Completed';
      case 'disputed':
        return 'Disputed';
      default:
        return status;
    }
  };

  const handleStatusUpdate = (id: string, newStatus: EscrowTransaction['status']) => {
    setTransactions((prev) =>
      prev.map((transaction) =>
        transaction.id === id ? { ...transaction, status: newStatus } : transaction,
      ),
    );
  };

  const isOverdue = (deadline: string) => {
    return new Date(deadline) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-purple-400 font-libre-caslon">Escrow Management</h2>
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#DCDDCC]" />
            <Input
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#231F20] border-[#D0B284]/20 text-white w-64"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[#231F20] border border-[#D0B284]/20 text-white rounded-md px-3 py-2"
          >
            <option value="ALL">All Status</option>
            <option value="payment_pending">Payment Pending</option>
            <option value="payment_received">Payment Received</option>
            <option value="shipping_pending">Shipping Pending</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="disputed">Disputed</option>
          </select>
        </div>
      </div>

      {/* Process Overview */}
      <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl p-6">
        <h3 className="text-lg font-bold text-[#D0B284] mb-4">Escrow Process Overview</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-8 h-8 bg-[#D7BF75] rounded-full flex items-center justify-center text-black font-bold">
              1
            </div>
            <span className="text-[#DCDDCC]">Bid Accepted</span>
          </div>
          <div className="flex-1 h-0.5 bg-[#D0B284]/20 mx-4" />
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-8 h-8 bg-blue-400 rounded-full flex items-center justify-center text-black font-bold">
              2
            </div>
            <span className="text-[#DCDDCC]">Payment</span>
          </div>
          <div className="flex-1 h-0.5 bg-[#D0B284]/20 mx-4" />
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-8 h-8 bg-purple-400 rounded-full flex items-center justify-center text-black font-bold">
              3
            </div>
            <span className="text-[#DCDDCC]">Shipping</span>
          </div>
          <div className="flex-1 h-0.5 bg-[#D0B284]/20 mx-4" />
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-8 h-8 bg-[#184D37] rounded-full flex items-center justify-center text-white font-bold">
              4
            </div>
            <span className="text-[#DCDDCC]">Delivery</span>
          </div>
          <div className="flex-1 h-0.5 bg-[#D0B284]/20 mx-4" />
          <div className="flex items-center space-x-2 text-sm">
            <div className="w-8 h-8 bg-[#D0B284] rounded-full flex items-center justify-center text-black font-bold">
              5
            </div>
            <span className="text-[#DCDDCC]">Release Funds</span>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-[#231F20] border border-[#D0B284]/20 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#D0B284]/20">
                <th className="text-left text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Asset
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Buyer
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Seller
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Amount
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Status
                </th>
                <th className="text-center text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Deadline
                </th>
                <th className="text-right text-[#DCDDCC] text-sm font-jetbrains uppercase py-4 px-4">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((transaction) => {
                const currentDeadline =
                  transaction.status === 'payment_pending'
                    ? transaction.paymentDeadline
                    : transaction.status === 'shipping_pending'
                      ? transaction.shippingDeadline
                      : transaction.deliveryDeadline;

                return (
                  <tr
                    key={transaction.id}
                    className={`border-b border-[#D0B284]/10 hover:bg-[#D0B284]/5 ${
                      currentDeadline && isOverdue(currentDeadline) ? 'bg-red-400/5' : ''
                    }`}
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <Image
                          src={transaction.listingImage || '/placeholder.svg'}
                          alt={transaction.listingName}
                          className="w-10 h-10 rounded-full object-cover border border-[#D0B284]/20"
                          width={40}
                          height={40}
                        />
                        <div>
                          <h3 className="text-white font-medium text-sm">
                            {transaction.listingName.split(' ').slice(0, 2).join(' ')}
                          </h3>
                          <span className="text-[#DCDDCC] font-jetbrains text-xs">
                            {transaction.listingTicker}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div>
                        <div className="text-white font-medium text-sm">{transaction.buyer}</div>
                        <div className="text-[#DCDDCC] font-jetbrains text-xs">
                          {transaction.buyerAddress}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div>
                        <div className="text-white font-medium text-sm">{transaction.seller}</div>
                        <div className="text-[#DCDDCC] font-jetbrains text-xs">
                          {transaction.sellerAddress}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div>
                        <div className="text-[#D0B284] font-medium text-sm">
                          {transaction.amount}
                        </div>
                        <div className="text-[#DCDDCC] text-xs">{transaction.amountUSD}</div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <Badge
                          className={`${getStatusColor(transaction.status)} border-none text-xs flex items-center space-x-1`}
                        >
                          {getStatusIcon(transaction.status)}
                          <span>{getStatusLabel(transaction.status)}</span>
                        </Badge>
                        {currentDeadline && isOverdue(currentDeadline) && (
                          <AlertTriangle className="w-3 h-3 text-red-400" aria-label="Overdue" />
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-center">
                      {currentDeadline && (
                        <span
                          className={`text-sm ${isOverdue(currentDeadline) ? 'text-red-400' : 'text-[#DCDDCC]'}`}
                        >
                          {currentDeadline.split(' ')[0]}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#D0B284] hover:bg-[#D0B284]/10"
                          onClick={() => setSelectedTransaction(transaction)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Manage
                        </Button>
                        {transaction.status === 'disputed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:bg-red-400/10"
                          >
                            <MessageCircle className="w-4 h-4 mr-1" />
                            Resolve
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Management Modal */}
      <Dialog open={!!selectedTransaction} onOpenChange={() => setSelectedTransaction(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-[#231F20] border border-[#D0B284]/20">
          {selectedTransaction && (
            <>
              <DialogHeader>
                <DialogTitle className="text-[#D0B284] text-xl">
                  Escrow Management - {selectedTransaction.listingName}
                </DialogTitle>
              </DialogHeader>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                {/* Transaction Details */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                      Current Status
                    </label>
                    <div className="flex items-center space-x-2 mt-1">
                      <Badge
                        className={`${getStatusColor(selectedTransaction.status)} border-none flex items-center space-x-1`}
                      >
                        {getStatusIcon(selectedTransaction.status)}
                        <span>{getStatusLabel(selectedTransaction.status)}</span>
                      </Badge>
                    </div>
                  </div>

                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                      Transaction Amount
                    </label>
                    <div className="mt-1">
                      <div className="text-[#D0B284] font-medium">{selectedTransaction.amount}</div>
                      <div className="text-[#DCDDCC] text-sm">{selectedTransaction.amountUSD}</div>
                    </div>
                  </div>

                  {selectedTransaction.trackingNumber && (
                    <div>
                      <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                        Tracking Number
                      </label>
                      <p className="text-white mt-1 font-mono">
                        {selectedTransaction.trackingNumber}
                      </p>
                    </div>
                  )}

                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">Notes</label>
                    <p className="text-white mt-1">
                      {selectedTransaction.notes || 'No notes available'}
                    </p>
                  </div>
                </div>

                {/* Status Actions */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                      Update Status
                    </label>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {selectedTransaction.status === 'payment_pending' && (
                        <Button
                          size="sm"
                          className="bg-blue-400 hover:bg-blue-400/80 text-white"
                          onClick={() =>
                            handleStatusUpdate(selectedTransaction.id, 'payment_received')
                          }
                        >
                          Mark Payment Received
                        </Button>
                      )}
                      {selectedTransaction.status === 'payment_received' && (
                        <Button
                          size="sm"
                          className="bg-purple-400 hover:bg-purple-400/80 text-white"
                          onClick={() => handleStatusUpdate(selectedTransaction.id, 'shipped')}
                        >
                          Mark as Shipped
                        </Button>
                      )}
                      {selectedTransaction.status === 'shipped' && (
                        <Button
                          size="sm"
                          className="bg-[#184D37] hover:bg-[#184D37]/80 text-white"
                          onClick={() => handleStatusUpdate(selectedTransaction.id, 'delivered')}
                        >
                          Mark as Delivered
                        </Button>
                      )}
                      {selectedTransaction.status === 'delivered' && (
                        <Button
                          size="sm"
                          className="bg-[#D0B284] hover:bg-[#D7BF75] text-black"
                          onClick={() => handleStatusUpdate(selectedTransaction.id, 'completed')}
                        >
                          Release Funds
                        </Button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[#DCDDCC] text-sm font-jetbrains uppercase">
                      Admin Notes
                    </label>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Add admin notes..."
                      className="mt-2 bg-black/50 border-[#D0B284]/20 text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-4 mt-6">
                <Button variant="ghost" className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10">
                  Contact Buyer
                </Button>
                <Button variant="ghost" className="text-[#DCDDCC] hover:bg-[#DCDDCC]/10">
                  Contact Seller
                </Button>
                {selectedTransaction.status === 'disputed' && (
                  <Button className="bg-red-400 hover:bg-red-400/80 text-white">
                    Open Dispute Resolution
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
