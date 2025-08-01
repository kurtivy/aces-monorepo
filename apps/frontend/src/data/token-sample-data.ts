// Sample Activity Data
export const sampleActivity = [
  {
    event: 'Sale',
    price: 2.45,
    from: '0x742d35...',
    to: '0x8ba1f1...',
    time: '2m ago',
  },
  {
    event: 'Mint',
    price: 0.08,
    from: '0x0000000...',
    to: '0x742d35...',
    time: '5m ago',
  },
  {
    event: 'Bid',
    price: 2.2,
    from: '0x9f4e2a...',
    to: '0x742d35...',
    time: '12m ago',
  },
  {
    event: 'Sale',
    price: 1.95,
    from: '0x1a2b3c...',
    to: '0x9f4e2a...',
    time: '1h ago',
  },
  {
    event: 'Transfer',
    price: 0.0,
    from: '0x5d6e7f...',
    to: '0x1a2b3c...',
    time: '3h ago',
  },
  {
    event: 'Sale',
    price: 1.75,
    from: '0x8g9h0i...',
    to: '0x5d6e7f...',
    time: '6h ago',
  },
];

// Sample Holders Data
export const sampleHolders = [
  {
    rank: 1,
    address: '0x742d35Cc6390C8D0789bF4bf2c0F3Df2d3d3C6e8',
    percentage: 15.42,
    amount: 154,
    value: 48250,
    txns: 23,
    exp: 'etherscan',
  },
  {
    rank: 2,
    address: '0x8ba1f109551bD432803012645Hk1f109551bD432',
    percentage: 12.18,
    amount: 122,
    value: 38190,
    txns: 18,
    exp: 'etherscan',
  },
  {
    rank: 3,
    address: '0x9f4e2a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R',
    percentage: 8.95,
    amount: 89,
    value: 27875,
    txns: 12,
    exp: 'etherscan',
  },
  {
    rank: 4,
    address: '0x1a2b3c4d5e6f7g8h9i0j1k2l3m4n5o6p7q8r9s0t',
    percentage: 7.33,
    amount: 73,
    value: 22865,
    txns: 9,
    exp: 'etherscan',
  },
  {
    rank: 5,
    address: '0x5d6e7f8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w',
    percentage: 6.21,
    amount: 62,
    value: 19420,
    txns: 15,
    exp: 'etherscan',
  },
  {
    rank: 6,
    address: '0x8g9h0i1j2k3l4m5n6o7p8q9r0s1t2u3v4w5x6y7z',
    percentage: 5.47,
    amount: 55,
    value: 17235,
    txns: 7,
    exp: 'etherscan',
  },
  {
    rank: 7,
    address: '0x3v4w5x6y7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o',
    percentage: 4.82,
    amount: 48,
    value: 15040,
    txns: 11,
    exp: 'etherscan',
  },
  {
    rank: 8,
    address: '0x7z8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o3p4q5r6s',
    percentage: 3.91,
    amount: 39,
    value: 12215,
    txns: 6,
    exp: 'etherscan',
  },
];

// Usage example for page.tsx:
export const tokenData = {
  activity: sampleActivity,
  holders: sampleHolders,
};
