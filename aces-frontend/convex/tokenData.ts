/**
 * Single source of truth for ALL ACES platform RWA tokens.
 * Covers on-chain config, UI display, metrics, and story data.
 * Live tokens have full on-chain fields; upcoming tokens have them optional.
 */

export interface RwaTokenData {
  // ── Identity ───────────────────────────────────
  symbol: string;
  name: string;
  title: string;
  description: string;
  category: "JEWELRY" | "ART" | "VEHICLE" | "FASHION" | "COLLECTIBLE" | "ALCOHOL";

  // ── On-chain config (optional for non-live tokens) ──
  /** ERC-20 contract address on Base Mainnet */
  contractAddress?: string;
  decimals?: number;
  chainId?: number;
  phase?: "BONDING_CURVE" | "DEX_TRADING";
  priceSource?: "BONDING_CURVE" | "DEX";
  /** Whether the token is active for trading */
  isActive: boolean;

  /** Aerodrome DEX pool paired with ACES — avoids on-chain pool discovery */
  dexPool?: {
    address: string;
    type: "v2" | "cl";
    /** V2: whether this is a stable pair. CL: tick spacing. */
    stable?: boolean;
    tickSpacing?: number;
  };

  // ── Chart config ─────────────────────────────────
  /** GeckoTerminal pool address for OHLCV chart data. If set, skips pool lookup. */
  geckoPoolAddress?: string;

  // ── UI display ────────────────────────────────────
  /** Card thumbnail image path (used on homepage, drops grid) */
  image: string;
  /** Detail page gallery images */
  images: string[];
  /** Countdown target for upcoming tokens */
  countdownDate?: string;

  // ── Token metrics (DATA section) ────────────────
  /** Market cap shown above data section */
  marketCap?: string;
  /** ACES ratio multiplier (e.g. "0.00 x") */
  acesRatio?: string;
  /** Trade reward percentage */
  tradeReward?: string;
  /** Reward earned by holder */
  rewardEarned?: string;
  /** Liquidity in USD */
  liquidity?: string;
  /** 24-hour trading volume */
  volume24h?: string;

  // ── Token story (STORY section) ─────────────────
  /** Underlying asset value in USD */
  value?: string;
  /** Community reward pool in USD */
  communityReward?: string;
  /** Brand / maker of the asset */
  brand?: string;
  /** Hype blurb — narrative about the asset's appeal */
  hype?: string;
}

/** Whether a token is live for trading. */
export function isTokenLive(token: RwaTokenData): boolean {
  return token.phase === "DEX_TRADING" && token.isActive;
}

export const CHAIN_ID_BASE = 8453;

/* ═══════════════════════════════════════════════════════
   Token registry — live tokens first, then upcoming
   ═══════════════════════════════════════════════════════ */

export const RWA_TOKENS: RwaTokenData[] = [
  // ── Live tokens ────────────────────────────────────
  {
    symbol: "PIKACHU",
    name: "Pikachu",
    title: "Luigi Pikachu #296/XY-P",
    description: "PSA GEM MT 10 Luigi Pikachu promo card, signed by illustrator Kouki Saitou — one of the most sought-after Pokémon collectibles",
    category: "COLLECTIBLE",
    contractAddress: "0x02ad22d8789f95c06187ffaddfc5ffbd4d6eaace",
    decimals: 18,
    chainId: CHAIN_ID_BASE,
    phase: "DEX_TRADING",
    priceSource: "DEX",
    isActive: true,
    dexPool: { address: "0x960447f5c886434f416b15aa4b6b6123d9b535c4", type: "cl", tickSpacing: 500 },
    geckoPoolAddress: "0x960447f5c886434f416b15aa4b6b6123d9b535c4",
    image: "/tokens/PIKACHU/1.webp",
    images: ["/tokens/PIKACHU/1.webp"],
    marketCap: "$—",
    acesRatio: "0.00 x",
    tradeReward: "—%",
    rewardEarned: "—",
    liquidity: "$—",
    volume24h: "$0.00",
    value: "$110,000",
    communityReward: "$10,000",
    brand: "Pokémon TCG",
    hype: "Placeholder — update with real hype blurb",
  },
  {
    symbol: "ILLICIT",
    name: "Illicit",
    title: "Banksy – The Illicit Collaboration",
    description: `A one-of-one historic street art artifact born out of Banksy's early-2000s East London pop-up era. Originally created as part of the "London. New York. Bristol. Monkey" canvas series, Edition 02/10, this piece began as a khaki-green Banksy monkey surfing a bomb — a raw, anti-establishment icon from the Rivington Street guerrilla gallery days.

Rather than entering a gallery, the canvas was given as payment to the crew who built those underground shows. In 2001, it passed to skater-artist Dave The Chimp with one instruction: "Be inspired." Instead of preserving it, he did the unthinkable — painting a second monkey mid-flight, two fingers raised not just to the world, but to the original Banksy itself.

The result: a true 1/1 illicit collaboration. A Banksy monkey met a Chimp monkey in a moment of punk rebellion, transforming a numbered edition into a singular, historically-charged artwork. It is part homage, part violation, entirely irreproducible.

Spray, acrylic, and pencil on canvas
Size: 61 × 61 cm

A rare double-monkey mic drop from two eras of graffiti culture — the monkey that said "f**k off" twice.`,
    category: "ART",
    contractAddress: "0xb7298a97895b7463ba081127096543f8bd255ace",
    decimals: 18,
    chainId: CHAIN_ID_BASE,
    phase: "DEX_TRADING",
    priceSource: "DEX",
    isActive: true,
    dexPool: { address: "0x05851baf22d01323dd52c9bff129838e6e361514", type: "v2", stable: false },
    geckoPoolAddress: "0x05851baf22d01323dd52c9bff129838e6e361514",
    image: "/tokens/ILLICIT/1.webp",
    images: ["/tokens/ILLICIT/1.webp"],
    marketCap: "$—",
    acesRatio: "0.00 x",
    tradeReward: "—%",
    rewardEarned: "—",
    liquidity: "$—",
    volume24h: "$0.00",
    value: "$150,000",
    communityReward: "$50,000",
    brand: "Banksy",
    hype: "Placeholder — update with real hype blurb",
  },
  {
    symbol: "RMILLE",
    name: "Richard Mille",
    title: "Richard Mille RM 67-01 Gold",
    description: `An ultra-sleek expression of modern haute horlogerie, the Richard Mille RM 67-01 in solid gold blends exceptional mechanical engineering with one of the thinnest automatic movements ever produced by the brand. Its distinctive tonneau-shaped case, sculpted from precious gold, frames a skeletonized dial that showcases Richard Mille's signature technical artistry.

Designed for everyday wear yet crafted with the precision of a racing machine, the RM 67-01 represents the intersection of luxury, innovation, and lightweight ergonomics. Its rarity, precious metal execution, and rising demand among global collectors make it a standout investment-grade timepiece.`,
    category: "JEWELRY",
    contractAddress: "0xbb761c78fed5f606972abee45c89bc9edba73ace",
    decimals: 18,
    chainId: CHAIN_ID_BASE,
    phase: "DEX_TRADING",
    priceSource: "DEX",
    isActive: true,
    dexPool: { address: "0x4e1325547e5b289ab0c6415f6b1415f26b3fc4df", type: "v2", stable: false },
    geckoPoolAddress: "0x4e1325547e5b289ab0c6415f6b1415f26b3fc4df",
    image: "/tokens/RMILLE/1.webp",
    images: ["/tokens/RMILLE/1.webp"],
    marketCap: "$—",
    acesRatio: "0.00 x",
    tradeReward: "—%",
    rewardEarned: "—",
    liquidity: "$—",
    volume24h: "$0.00",
    value: "$288,000",
    communityReward: "$20,000",
    brand: "Richard Mille",
    hype: "Placeholder — update with real hype blurb",
  },
  {
    symbol: "APKAWS",
    name: "Audemars Piguet Royal Oak KAWS",
    title: "Audemars Piguet Royal Oak KAWS",
    description: `A groundbreaking collaboration between haute horology and contemporary art, this Audemars Piguet Royal Oak Concept is a limited edition masterpiece designed with the artist KAWS. The watch features KAWS's signature 'XX' motif on the tourbillon cage, housed within a futuristic titanium case.

This timepiece is not just a watch; it's a wearable sculpture that pushes the boundaries of watchmaking design. With an extremely limited production run, it's a grail piece for collectors of both high-end watches and modern art.`,
    category: "JEWELRY",
    contractAddress: "0xcd3248dbcd4b41b28d74090a3cdef8e8d2d72ace",
    decimals: 18,
    chainId: CHAIN_ID_BASE,
    phase: "DEX_TRADING",
    priceSource: "DEX",
    isActive: true,
    dexPool: { address: "0x64d13dd9d94114215c9051b287678c90fff97d43", type: "v2", stable: false },
    geckoPoolAddress: "0x64d13dd9d94114215c9051b287678c90fff97d43",
    image: "/canvas-images/Audemars-Piguet-Royal-Oak-Concept-KAWS-Tourbillon-Companion-Dial-Limited-Edition.webp",
    images: ["/tokens/APKAWS/1.webp"],
    marketCap: "$612.89",
    acesRatio: "0.00 x",
    tradeReward: "14501%",
    rewardEarned: "—",
    liquidity: "$674.08",
    volume24h: "$0.00",
    value: "$520,000",
    communityReward: "$40,000",
    brand: "Audemars Piguet x KAWS",
    hype: "Hyped for uniting KAWS's *Companion* art with Audemars Piguet's avant-garde tourbillon design, this watch embodies the fusion of art and horology — now trading over 150% above its 2024 launch price.",
  },
];

/* ═══════════════════════════════════════════════════════
   Derived collections — used by homepage, drops, etc.
   ═══════════════════════════════════════════════════════ */

/** First 6 tokens for the featured section on the homepage. */
export const FEATURED_TOKENS = RWA_TOKENS.slice(0, 6);

/** Platform-wide stats shown on the homepage stats bar. */
export const PLATFORM_STATS = {
  assetsTokenized: RWA_TOKENS.length,
  totalVolume: "$2.4M",
  activeTraders: 847,
  chainId: "Base (8453)",
} as const;

/** Lookup token data by symbol (case-insensitive). */
export function getTokenBySymbol(symbol: string): RwaTokenData | undefined {
  return RWA_TOKENS.find(
    (t) => t.symbol.toLowerCase() === symbol.toLowerCase(),
  );
}
