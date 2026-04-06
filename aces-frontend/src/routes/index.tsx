import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "~/lib/utils";
import {
  RWA_TOKENS,
  PLATFORM_STATS,
  type RwaTokenData,
  isTokenLive,
} from "../../convex/tokenData";
import { motion } from "framer-motion";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/* Shared easing curve — fast start, gentle deceleration */
const ease = [0.22, 1, 0.36, 1] as const;

/* Two equal sets of 8 tokens for the dual-row marquee.
   Row 1 gets the live tokens + first batch of upcoming;
   Row 2 gets the remaining upcoming tokens. */
const MARQUEE_ROW_1 = RWA_TOKENS.slice(0, 8);
const MARQUEE_ROW_2 = RWA_TOKENS.slice(8);

function HomePage() {
  return (
    <div className="bg-deep-charcoal">
      <HeroSection />
      <MarqueeSection />
      {/* StatsBar removed — hardcoded numbers weren't accurate */}
      <HowItWorksSection />
      <CtaSection />
    </div>
  );
}

/* ─── Hero ─────────────────────────────────────────────────
   Full-viewport centered hero with staggered blur-in text reveal.
   Each headline line fades from blurred to sharp with a delay,
   inspired by the character-level reveals on v0 IRL landing.
   Background uses a slowly drifting gradient + grid texture. */

function HeroSection() {
  /* Headline split into three lines with distinct visual weights.
     Line 1: italic opener (muted) → Line 2: core statement (golden, largest)
     → Line 3: urgency closer (muted-lighter). Creates a diamond-shaped
     visual hierarchy where the middle line dominates. */
  const lines = [
    {
      text: "Speculate on the",
      style:
        "font-heading italic text-platinum-grey/50 text-4xl sm:text-5xl lg:text-6xl xl:text-7xl",
    },
    {
      text: "world's rarest assets",
      style:
        "font-heading text-golden-beige text-5xl sm:text-6xl lg:text-7xl xl:text-8xl tracking-tight",
    },
    {
      text: "before they sell.",
      style:
        "font-heading italic text-platinum-grey/70 text-3xl sm:text-4xl lg:text-5xl xl:text-6xl",
    },
  ];

  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Animated gradient background — slow drift for atmospheric motion */}
      <div className="absolute inset-0 hero-gradient-bg" />
      {/* Radial glow accents for depth — gold at top, emerald at bottom */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(208,178,132,0.06),transparent)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(24,77,55,0.08),transparent)]" />
      {/* Grid texture overlay — adds subtle depth without competing with text */}
      <div className="absolute inset-0 grid-pattern" />

      <div className="relative px-6 py-32 text-center">
        {/* Network status badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease }}
          className="mb-14 inline-flex items-center gap-2.5 rounded-full border border-golden-beige/10 bg-golden-beige/[0.03] px-5 py-2 backdrop-blur-sm"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-deep-emerald animate-pulse" />
          <span className="font-mono text-[11px] tracking-widest uppercase text-golden-beige/50">
            Live on Base
          </span>
        </motion.div>

        {/* Main headline — each line blurs in with staggered timing */}
        <div className="space-y-1 sm:space-y-2 lg:space-y-3">
          {lines.map((line, i) => (
            <motion.h1
              key={i}
              initial={{ opacity: 0, filter: "blur(10px)", y: 12 }}
              animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 + i * 0.15, ease }}
              className={cn("leading-[1.1]", line.style)}
            >
              {line.text}
            </motion.h1>
          ))}
        </div>

        {/* Supporting copy */}
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.7, ease }}
          className="mt-8 text-base text-platinum-grey/40 sm:text-lg tracking-wide"
        >
          Trade tokens tied to luxury watches, rare art & exotic cars — on-chain
          via Aerodrome DEX.
        </motion.p>

        {/* CTA pair — gold primary (luxury feel), ghost secondary */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.85, ease }}
          className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/drops"
            className={cn(
              "group inline-flex items-center gap-2 rounded px-8 py-3.5 text-sm font-medium",
              "bg-golden-beige text-deep-charcoal",
              "transition-all hover:bg-highlight-gold hover:shadow-gold-glow",
            )}
          >
            Explore Drops
            <svg
              className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13 7l5 5m0 0l-5 5m5-5H6"
              />
            </svg>
          </Link>
          <a
            href="#how-it-works"
            className={cn(
              "inline-flex items-center gap-2 rounded border border-golden-beige/12 px-8 py-3.5 text-sm font-medium",
              "text-golden-beige/50 backdrop-blur-sm",
              "transition-all hover:border-golden-beige/25 hover:text-golden-beige/80",
            )}
          >
            How it works
          </a>
          {/* Apply to List CTA — ghost button matching the "How it works" style,
              directs asset owners to the submission form */}
          <Link
            to="/apply"
            className={cn(
              "inline-flex items-center gap-2 rounded border border-golden-beige/12 px-8 py-3.5 text-sm font-medium",
              "text-golden-beige/50 backdrop-blur-sm",
              "transition-all hover:border-golden-beige/25 hover:text-golden-beige/80",
            )}
          >
            Apply to List
          </Link>
        </motion.div>
      </div>
    </section>
  );
}

/* ─── Scrolling Asset Showcase ────────────────────────────
   Two rows of asset cards scrolling in opposite directions.
   Creates visual energy and shows off the full catalogue at a glance.
   Edge fade masks blend cards seamlessly into the dark background.
   Hover pauses the row so users can inspect individual cards. */

function MarqueeSection() {
  return (
    <section className="py-16 sm:py-24 space-y-5 border-t border-golden-beige/6">
      {/* Section label */}
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease }}
        className="px-6 font-mono text-xs uppercase tracking-widest text-golden-beige/25 mb-6 lg:px-10"
      >
        Featured Assets
      </motion.p>

      {/* Row 1 — drifts left, contains live tokens */}
      <div className="marquee-row">
        <div className="marquee-track marquee-track--left">
          {/* Content duplicated for seamless infinite loop */}
          {[...MARQUEE_ROW_1, ...MARQUEE_ROW_1].map((token, i) => (
            <MarqueeCard key={`r1-${i}`} token={token} />
          ))}
        </div>
      </div>

      {/* Row 2 — drifts right at a slightly different speed for visual variety */}
      <div className="marquee-row">
        <div className="marquee-track marquee-track--right">
          {[...MARQUEE_ROW_2, ...MARQUEE_ROW_2].map((token, i) => (
            <MarqueeCard key={`r2-${i}`} token={token} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* Individual card in the scrolling showcase.
   Portrait aspect ratio works well for watches, art, and collectibles.
   Live tokens get a green "Live" badge to distinguish from upcoming. */
function MarqueeCard({ token }: { token: RwaTokenData }) {
  return (
    <Link
      to="/rwa/$symbol"
      params={{ symbol: token.symbol }}
      className="group relative flex-shrink-0 w-[240px] sm:w-[280px] aspect-[4/5] rounded-lg overflow-hidden"
    >
      {/* Asset image — scales up on hover for a tactile feel */}
      <img
        src={token.image}
        alt={token.title}
        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
      />

      {/* Bottom gradient for text readability over the image */}
      <div className="absolute inset-0 bg-gradient-to-t from-deep-charcoal/90 via-deep-charcoal/20 to-transparent" />

      {/* Live trading badge — only shown for active DEX tokens */}
      {isTokenLive(token) && (
        <div className="absolute top-3 right-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-deep-emerald/80 px-3 py-1 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-golden-beige animate-pulse" />
          <span className="text-[10px] font-medium text-golden-beige">
            Live
          </span>
        </div>
      )}

      {/* Overlay info — category, title, value */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <span className="text-[10px] font-mono uppercase tracking-widest text-antique-bronze/80">
          {token.category}
        </span>
        <h3 className="mt-1 font-heading text-lg text-platinum-grey/90 line-clamp-1">
          {token.title}
        </h3>
        {token.value && (
          <span className="mt-1 block font-mono text-sm text-golden-beige/50">
            {token.value}
          </span>
        )}
      </div>

      {/* Hover border reveal — subtle golden edge appears on interaction */}
      <div className="absolute inset-0 rounded-lg border border-golden-beige/0 transition-colors duration-300 group-hover:border-golden-beige/15" />
    </Link>
  );
}

/* ─── Stats Strip ─────────────────────────────────────────
   Compact credibility bar with platform metrics.
   Serif numbers + monospace labels echo the luxury × tech duality. */

function StatsBar() {
  const stats = [
    { label: "Assets Listed", value: String(PLATFORM_STATS.assetsTokenized) },
    { label: "Trading Volume", value: PLATFORM_STATS.totalVolume },
    { label: "Active Traders", value: String(PLATFORM_STATS.activeTraders) },
    { label: "Network", value: "Base" },
  ];

  return (
    <section className="border-y border-golden-beige/6">
      <div className="grid grid-cols-2 divide-x divide-golden-beige/6 sm:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.06, ease }}
            className="flex flex-col items-center gap-1.5 py-7 sm:py-9"
          >
            <span className="font-heading text-2xl text-golden-beige sm:text-3xl">
              {stat.value}
            </span>
            <span className="font-mono text-[10px] text-platinum-grey/40 uppercase tracking-widest">
              {stat.label}
            </span>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

/* ─── How It Works ─────────────────────────────────────────
   Four-step explanation of the ACES mechanism.
   Cards use grid texture overlays and radial glow accents for depth,
   inspired by the masked-gradient card pattern on v0 IRL.
   Monospace step numbers + serif titles maintain the luxury × tech feel. */

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Browse the marketplace",
      description:
        "Luxury assets — watches, art, cars, and collectibles — listed for sale through ACES with verified provenance and authenticated documentation.",
    },
    {
      number: "02",
      title: "Buy tokens, speculate on price",
      description:
        "Each listed asset has an ERC-20 token trading on Aerodrome DEX. Buy tokens to speculate on the asset's future sale price. You don't own the asset — you trade the market.",
    },
    {
      number: "03",
      title: "Trading fees reward the seller",
      description:
        "Every trade generates fees that flow directly to the asset lister — incentivizing high-quality listings and real liquidity on every asset.",
    },
    {
      number: "04",
      title: "Holders earn community rewards",
      description:
        "The lister puts up a community reward pool distributed pro-rata to all token holders (excluding the LP pool). Hold longer, earn more.",
    },
  ];

  return (
    <section
      id="how-it-works"
      className="border-t border-golden-beige/6 bg-deep-charcoal"
    >
      <div className="px-6 py-20 sm:py-28 lg:px-10">
        {/* Section header */}
        <div className="mb-16">
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease }}
            className="font-mono text-xs uppercase tracking-widest text-deep-emerald mb-4"
          >
            How it works
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, filter: "blur(8px)", y: 12 }}
            whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease }}
            className="font-heading text-3xl text-golden-beige sm:text-4xl lg:text-5xl"
          >
            How ACES works
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
            className="mt-4 text-lg text-platinum-grey/40 font-heading italic"
          >
            Speculate. Hold. Earn.
          </motion.p>
        </div>

        {/* Step cards — 2×2 grid on desktop, stacked on mobile */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
          {steps.map((step, i) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease }}
              className="relative rounded-lg bg-card-surface overflow-hidden glow-border-hover card-glow"
            >
              {/* Grid texture overlay — adds tactile depth to the card surface */}
              <div className="absolute inset-0 grid-pattern" />
              {/* Corner radial glow — creates a subtle light source in the top-right */}
              <div className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-deep-emerald/8 blur-3xl" />

              <div className="relative p-6 sm:p-8">
                {/* Step number in monospace — small and muted, acts as a label */}
                <span className="block font-mono text-sm text-golden-beige/15 tracking-widest">
                  {step.number}
                </span>
                <h3 className="mt-4 font-heading text-xl text-platinum-grey/90">
                  {step.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-platinum-grey/45">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Tech stack tags removed — too generic, cluttered the section */}
      </div>
    </section>
  );
}

/* ─── CTA ──────────────────────────────────────────────────
   Final conversion section with atmospheric gradient background.
   Grid texture + glow blob create depth. Blur-in headline
   matches the hero animation language for visual consistency. */

function CtaSection() {
  return (
    <section className="border-t border-golden-beige/6">
      <div className="px-4 py-10 sm:px-8 sm:py-16 lg:px-10">
        <div className="relative overflow-hidden rounded-lg glow-border luxury-gradient px-6 py-16 text-center sm:px-16 sm:py-24">
          {/* Decorative top line — thin gradient accent */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-1/2 bg-gradient-to-r from-transparent via-golden-beige/25 to-transparent" />
          {/* Glow blob — soft light behind the headline */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-48 w-96 bg-golden-beige/5 blur-3xl rounded-full" />
          {/* Grid texture for consistency with other sections */}
          <div className="absolute inset-0 grid-pattern opacity-50" />

          <motion.h2
            initial={{ opacity: 0, filter: "blur(8px)", y: 12 }}
            whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, ease }}
            className="relative font-heading text-3xl text-golden-beige sm:text-4xl lg:text-5xl"
          >
            Start speculating on real-world assets
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1, ease }}
            className="relative mt-5 text-platinum-grey/50 sm:text-lg"
          >
            Connect your wallet. Browse luxury assets. Trade tokens and earn
            community rewards.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2, ease }}
            className="relative mt-10 flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              to="/drops"
              className="rounded bg-golden-beige px-8 py-3.5 text-sm font-medium text-deep-charcoal transition-all hover:bg-highlight-gold hover:shadow-gold-glow"
            >
              Browse Drops
            </Link>
            <Link
              to="/portfolio"
              className="rounded border border-golden-beige/15 px-8 py-3.5 text-sm font-medium text-golden-beige/50 transition-all hover:border-golden-beige/30 hover:text-golden-beige/80"
            >
              View Portfolio
            </Link>
            {/* Apply to List CTA — encourages asset owners to submit listings */}
            <Link
              to="/apply"
              className="rounded border border-golden-beige/15 px-8 py-3.5 text-sm font-medium text-golden-beige/50 transition-all hover:border-golden-beige/30 hover:text-golden-beige/80"
            >
              Apply to List
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
