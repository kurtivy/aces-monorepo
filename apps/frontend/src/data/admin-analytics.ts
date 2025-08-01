export type TimePeriod =
  | '1_hour'
  | '1_day'
  | '1_week'
  | '1_month'
  | '3_months'
  | '6_months'
  | '1_year'
  | 'ytd';

export interface PlatformAnalytics {
  totalVolume: {
    value: string;
    change: number;
    period: string;
  };
  totalFees: {
    value: string;
    change: number;
    period: string;
  };
  totalListings: {
    value: number;
    change: number;
    period: string;
  };
  totalValue: {
    value: string;
    change: number;
    period: string;
  };
  totalSellers: {
    value: number;
    change: number;
    period: string;
  };
  historicBids: {
    value: string;
    change: number;
    period: string;
  };
  rwaAssetsSold: {
    value: string;
    change: number;
    period: string;
  };
  volumeChart: Array<{
    date: string;
    volume: number;
    fees: number;
  }>;
  categoryDistribution: Array<{
    category: string;
    value: number;
    percentage: number;
  }>;
  topListings: Array<{
    id: string;
    name: string;
    volume: string;
    fees: string;
  }>;
  historicBidsChart: Array<{
    date: string;
    totalBids: number;
    activeBids: number;
  }>;
  rwaAssetsSoldChart: Array<{
    date: string;
    assetsSold: number;
    assetsCount: number;
  }>;
  bidSuccessChart: Array<{
    date: string;
    successRate: number;
  }>;
  averageSaleTimeChart: Array<{
    date: string;
    averageDays: number;
  }>;
}

export const mockAnalyticsData: PlatformAnalytics = {
  totalVolume: {
    value: '47,293.84 ETH',
    change: 23.7,
    period: 'vs last month',
  },
  totalFees: {
    value: '2,364.69 ETH',
    change: 18.4,
    period: 'vs last month',
  },
  totalListings: {
    value: 1247,
    change: 31.2,
    period: 'vs last month',
  },
  totalValue: {
    value: '154.8M USD',
    change: 28.9,
    period: 'vs last month',
  },
  totalSellers: {
    value: 342,
    change: 45.6,
    period: 'vs last month',
  },
  historicBids: {
    value: '89,456.23 ETH',
    change: 34.8,
    period: 'vs last month',
  },
  rwaAssetsSold: {
    value: '23,847.91 ETH',
    change: 42.3,
    period: 'vs last month',
  },
  volumeChart: [
    { date: '2024-01', volume: 12420, fees: 621 },
    { date: '2024-02', volume: 15680, fees: 784 },
    { date: '2024-03', volume: 18950, fees: 948 },
    { date: '2024-04', volume: 22100, fees: 1105 },
    { date: '2024-05', volume: 28750, fees: 1438 },
    { date: '2024-06', volume: 31200, fees: 1560 },
    { date: '2024-07', volume: 35890, fees: 1795 },
    { date: '2024-08', volume: 41250, fees: 2063 },
    { date: '2024-09', volume: 38900, fees: 1945 },
    { date: '2024-10', volume: 44680, fees: 2234 },
    { date: '2024-11', volume: 47293, fees: 2365 },
    { date: '2024-12', volume: 52100, fees: 2605 },
  ],
  categoryDistribution: [
    { category: 'Cars', value: 15847, percentage: 33.5 },
    { category: 'Art', value: 11358, percentage: 24.0 },
    { category: 'Watches', value: 9464, percentage: 20.0 },
    { category: 'Real Estate', value: 4729, percentage: 10.0 },
    { category: 'Sneakers', value: 2837, percentage: 6.0 },
    { category: 'Spirits', value: 1419, percentage: 3.0 },
    { category: 'Jewelry', value: 946, percentage: 2.0 },
    { category: 'Collectibles', value: 473, percentage: 1.0 },
    { category: 'Tech', value: 220, percentage: 0.5 },
  ],
  historicBidsChart: [
    { date: '2024-01', totalBids: 8420, activeBids: 2340 },
    { date: '2024-02', totalBids: 11680, activeBids: 3120 },
    { date: '2024-03', totalBids: 15950, activeBids: 4280 },
    { date: '2024-04', totalBids: 19100, activeBids: 5150 },
    { date: '2024-05', totalBids: 24750, activeBids: 6890 },
    { date: '2024-06', totalBids: 28200, activeBids: 7650 },
    { date: '2024-07', totalBids: 32890, activeBids: 8920 },
    { date: '2024-08', totalBids: 38250, activeBids: 10340 },
    { date: '2024-09', totalBids: 42900, activeBids: 11580 },
    { date: '2024-10', totalBids: 48680, activeBids: 13120 },
    { date: '2024-11', totalBids: 54293, activeBids: 14670 },
    { date: '2024-12', totalBids: 61100, activeBids: 16450 },
  ],
  rwaAssetsSoldChart: [
    { date: '2024-01', assetsSold: 1240, assetsCount: 12 },
    { date: '2024-02', assetsSold: 1680, assetsCount: 18 },
    { date: '2024-03', assetsSold: 2150, assetsCount: 24 },
    { date: '2024-04', assetsSold: 2890, assetsCount: 31 },
    { date: '2024-05', assetsSold: 3450, assetsCount: 38 },
    { date: '2024-06', assetsSold: 4120, assetsCount: 45 },
    { date: '2024-07', assetsSold: 4890, assetsCount: 52 },
    { date: '2024-08', assetsSold: 5670, assetsCount: 61 },
    { date: '2024-09', assetsSold: 6340, assetsCount: 68 },
    { date: '2024-10', assetsSold: 7120, assetsCount: 76 },
    { date: '2024-11', assetsSold: 7890, assetsCount: 84 },
    { date: '2024-12', assetsSold: 8650, assetsCount: 92 },
  ],
  bidSuccessChart: [
    { date: '2024-01', successRate: 24.5 },
    { date: '2024-02', successRate: 28.3 },
    { date: '2024-03', successRate: 31.7 },
    { date: '2024-04', successRate: 35.2 },
    { date: '2024-05', successRate: 38.9 },
    { date: '2024-06', successRate: 42.1 },
    { date: '2024-07', successRate: 45.8 },
    { date: '2024-08', successRate: 48.3 },
    { date: '2024-09', successRate: 51.7 },
    { date: '2024-10', successRate: 54.2 },
    { date: '2024-11', successRate: 57.8 },
    { date: '2024-12', successRate: 61.4 },
  ],
  averageSaleTimeChart: [
    { date: '2024-01', averageDays: 45.2 },
    { date: '2024-02', averageDays: 42.8 },
    { date: '2024-03', averageDays: 39.5 },
    { date: '2024-04', averageDays: 36.7 },
    { date: '2024-05', averageDays: 34.2 },
    { date: '2024-06', averageDays: 31.8 },
    { date: '2024-07', averageDays: 29.4 },
    { date: '2024-08', averageDays: 27.1 },
    { date: '2024-09', averageDays: 25.6 },
    { date: '2024-10', averageDays: 23.9 },
    { date: '2024-11', averageDays: 22.3 },
    { date: '2024-12', averageDays: 20.8 },
  ],
  topListings: [
    { id: '1', name: '1962 Ferrari 250 GTO', volume: '1,247.8 ETH', fees: '124.78 ETH' },
    { id: '2', name: 'Basquiat Untitled (Skull)', volume: '892.4 ETH', fees: '89.24 ETH' },
    { id: '3', name: 'Patek Philippe Grandmaster Chime', volume: '756.9 ETH', fees: '75.69 ETH' },
    { id: '4', name: 'Andy Warhol Marilyn Monroe', volume: '634.7 ETH', fees: '63.47 ETH' },
    { id: '5', name: '1955 Mercedes 300SL Gullwing', volume: '587.3 ETH', fees: '58.73 ETH' },
    { id: '6', name: "Picasso Les Femmes d'Alger", volume: '523.8 ETH', fees: '52.38 ETH' },
    { id: '7', name: 'Richard Mille RM 56-02 Sapphire', volume: '467.2 ETH', fees: '46.72 ETH' },
    { id: '8', name: '1970 Porsche 917K', volume: '445.6 ETH', fees: '44.56 ETH' },
    { id: '9', name: 'Rolex Daytona Paul Newman', volume: '398.4 ETH', fees: '39.84 ETH' },
    { id: '10', name: 'Monet Water Lilies', volume: '367.9 ETH', fees: '36.79 ETH' },
    { id: '11', name: '1967 Shelby Cobra 427', volume: '334.5 ETH', fees: '33.45 ETH' },
    { id: '12', name: 'Van Gogh Starry Night Study', volume: '312.7 ETH', fees: '31.27 ETH' },
    {
      id: '13',
      name: 'Audemars Piguet Royal Oak Offshore',
      volume: '289.3 ETH',
      fees: '28.93 ETH',
    },
    { id: '14', name: '1963 Aston Martin DB5', volume: '267.8 ETH', fees: '26.78 ETH' },
    { id: '15', name: 'Hermès Himalaya Birkin 30', volume: '245.6 ETH', fees: '24.56 ETH' },
    { id: '16', name: 'Kaws Companion (Flayed)', volume: '223.4 ETH', fees: '22.34 ETH' },
    { id: '17', name: '1973 Porsche Carrera RS', volume: '201.9 ETH', fees: '20.19 ETH' },
    { id: '18', name: 'Macallan Fine and Rare 1926', volume: '189.7 ETH', fees: '18.97 ETH' },
    { id: '19', name: 'Banksy Girl with Balloon', volume: '178.2 ETH', fees: '17.82 ETH' },
    { id: '20', name: '1969 Dodge Charger R/T', volume: '167.5 ETH', fees: '16.75 ETH' },
    { id: '21', name: 'Cartier Crash Watch', volume: '156.8 ETH', fees: '15.68 ETH' },
    { id: '22', name: 'Nike Air Jordan 1 Chicago (1985)', volume: '145.3 ETH', fees: '14.53 ETH' },
    {
      id: '23',
      name: 'Rothko No. 6 (Violet, Green and Red)',
      volume: '134.7 ETH',
      fees: '13.47 ETH',
    },
    { id: '24', name: '1965 Ford GT40', volume: '123.9 ETH', fees: '12.39 ETH' },
    { id: '25', name: 'Tiffany & Co. Diamond Necklace', volume: '112.4 ETH', fees: '11.24 ETH' },
    { id: '26', name: '1957 Chevrolet Bel Air', volume: '101.8 ETH', fees: '10.18 ETH' },
    { id: '27', name: 'Hublot Big Bang Unico Sapphire', volume: '95.6 ETH', fees: '9.56 ETH' },
    { id: '28', name: 'Supreme Box Logo Hoodie (2017)', volume: '89.3 ETH', fees: '8.93 ETH' },
    { id: '29', name: 'Pollock No. 5, 1948', volume: '83.7 ETH', fees: '8.37 ETH' },
    { id: '30', name: '1966 Lamborghini Miura', volume: '78.2 ETH', fees: '7.82 ETH' },
    { id: '31', name: "Vacheron Constantin Tour de l'Île", volume: '72.9 ETH', fees: '7.29 ETH' },
    { id: '32', name: 'Louis XIII Cognac Black Pearl', volume: '67.4 ETH', fees: '6.74 ETH' },
    { id: '33', name: 'Takashi Murakami Flower Ball', volume: '62.8 ETH', fees: '6.28 ETH' },
    { id: '34', name: "1971 Plymouth Hemi 'Cuda", volume: '58.5 ETH', fees: '5.85 ETH' },
    { id: '35', name: 'Chanel No. 5 Limited Edition', volume: '54.3 ETH', fees: '5.43 ETH' },
    { id: '36', name: '1968 Mustang Shelby GT500KR', volume: '50.7 ETH', fees: '5.07 ETH' },
    { id: '37', name: 'Omega Speedmaster Moon Watch', volume: '47.2 ETH', fees: '4.72 ETH' },
    { id: '38', name: 'Off-White x Nike Air Jordan 1', volume: '43.9 ETH', fees: '4.39 ETH' },
    {
      id: '39',
      name: 'Damien Hirst The Physical Impossibility',
      volume: '40.6 ETH',
      fees: '4.06 ETH',
    },
    { id: '40', name: '1970 Chevelle SS LS6', volume: '37.8 ETH', fees: '3.78 ETH' },
    { id: '41', name: 'Breguet Marie-Antoinette', volume: '35.2 ETH', fees: '3.52 ETH' },
    { id: '42', name: 'Dom Pérignon Vintage 1996', volume: '32.7 ETH', fees: '3.27 ETH' },
    { id: '43', name: 'Jeff Koons Balloon Dog', volume: '30.4 ETH', fees: '3.04 ETH' },
    { id: '44', name: '1967 Camaro Z/28', volume: '28.3 ETH', fees: '2.83 ETH' },
    { id: '45', name: 'Bulgari Serpenti Incantati', volume: '26.5 ETH', fees: '2.65 ETH' },
    { id: '46', name: '1969 Boss 429 Mustang', volume: '24.8 ETH', fees: '2.48 ETH' },
    { id: '47', name: 'Jaeger-LeCoultre Reverso', volume: '23.1 ETH', fees: '2.31 ETH' },
    { id: '48', name: 'Travis Scott x Nike SB Dunk', volume: '21.6 ETH', fees: '2.16 ETH' },
    { id: '49', name: 'Gerhard Richter Abstract Painting', volume: '20.2 ETH', fees: '2.02 ETH' },
    { id: '50', name: '1965 Shelby Daytona Coupe', volume: '18.9 ETH', fees: '1.89 ETH' },
  ],
};
