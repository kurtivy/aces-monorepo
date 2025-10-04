import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],

  // Security headers - CSP commented out for development
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              // sensible baseline
              "default-src 'self'",
              "base-uri 'self'",
              "object-src 'none'",

              // scripts you load (added *.clarity.ms + va.vercel-scripts.com + Twitch + TradingView)
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://challenges.cloudflare.com https://*.clarity.ms https://www.googletagmanager.com https://va.vercel-scripts.com https://vercel.live https://auth.privy.io https://embed.twitch.tv https://charting-library.tradingview-widget.com https://*.tradingview.com",

              // mirror for script elements (prevents fallback confusion)
              "script-src-elem 'self' 'unsafe-inline' blob: https://*.clarity.ms https://www.googletagmanager.com https://va.vercel-scripts.com https://vercel.live https://auth.privy.io https://embed.twitch.tv https://charting-library.tradingview-widget.com https://*.tradingview.com",

              // styles/fonts/images
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",

              // form + embedding rules (unchanged + allow clarity iframes if any)
              "form-action 'self'",
              "frame-ancestors 'self' https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app https://aces-monorepo-git-dev-dan-aces-fun.vercel.app https://aces-monorepo-backend-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app https://aces-monorepo-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app https://aces.fun https://auth.privy.io",
              'child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org blob: data: https://*.tradingview.com',
              'frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com https://*.clarity.ms https://www.twitch.tv https://player.twitch.tv https://embed.twitch.tv blob: data: https://*.tradingview.com https://charting-library.tradingview-widget.com',

              // where your app may connect (added Supabase URL + backend localhost:8787 + WebSocket support for Next.js HMR)
              "connect-src 'self' http://localhost:3000 http://localhost:3002 ws://localhost:3000 wss://localhost:3000 https://auth.privy.io wss://relay.walletconnect.com wss://relay.walletconnect.org wss://www.walletlink.org https://*.rpc.privy.systems https://explorer-api.walletconnect.com https://aces-monorepo-backend.vercel.app https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app https://aces-monorepo-backend-git-feat-rwa-page-upgrade-dan-aces-fun.vercel.app https://pulse.walletconnect.org https://api.web3modal.org https://sepolia.base.org https://base-sepolia-rpc.publicnode.com https://base-sepolia.blockpi.network/v1/rpc/public https://base-sepolia.gateway.tenderly.co https://mainnet.base.org https://base-rpc.publicnode.com https://base.blockpi.network/v1/rpc/public https://base.gateway.tenderly.co https://1rpc.io https://min-api.cryptocompare.com https://api.thegraph.com https://api.coingecko.com https://api.coinbase.com https://api.binance.com https://www.google-analytics.com https://analytics.google.com https://vitals.vercel-insights.com https://*.clarity.ms https://api.twitch.tv https://id.twitch.tv https://fdglhdxswemqcaslsdwt.supabase.co https://saveload.tradingview.com https://dataservices.tradingview.com https://prodata.tradingview.com https://pronews.tradingview.com",

              // workers, manifest
              "worker-src 'self' blob:",
              "manifest-src 'self'",
            ].join('; '),
          },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },

  // Multi-tenant and API proxy configuration
  async rewrites() {
    return {
      // Multi-tenant rewrites come first (beforeFiles)
      beforeFiles: [
        // Rewrite admin.aces.fun requests to /admin routes (excluding static assets)
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|admin-favicon.ico|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: 'admin.aces.fun',
            },
          ],
          destination: '/admin/$1',
        },
        // Rewrite www.admin.aces.fun requests to /admin routes (excluding static assets)
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|admin-favicon.ico|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: 'www.admin.aces.fun',
            },
          ],
          destination: '/admin/$1',
        },
        // Handle localhost:3003 and local.admin.aces.fun for development
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|admin-favicon.ico|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: 'localhost:3003',
            },
          ],
          destination: '/admin/$1',
        },
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|admin-favicon.ico|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: 'local.admin.aces.fun:3000',
            },
          ],
          destination: '/admin/$1',
        },
        // Handle Vercel deployments with 'admin' in the URL
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|admin-favicon.ico|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: '(?<host>.*admin.*\\.vercel\\.app)',
            },
          ],
          destination: '/admin/$1',
        },
        // Handle admin subdomain for specific Vercel deployment
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|admin-favicon.ico|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: 'admin.aces-monorepo-git-feat-ui-updates-dan-aces-fun.vercel.app',
            },
          ],
          destination: '/admin/$1',
        },
        // Rewrite aceofbase.fun requests to /aceofbase routes (excluding static assets)
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|aceofbase-favicon.ico|aceofbase.svg|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: 'aceofbase.fun',
            },
          ],
          destination: '/aceofbase/$1',
        },
        // Rewrite www.aceofbase.fun requests to /aceofbase routes (excluding static assets)
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|aceofbase-favicon.ico|aceofbase.svg|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: 'www.aceofbase.fun',
            },
          ],
          destination: '/aceofbase/$1',
        },
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|aceofbase-favicon.ico|aceofbase.svg|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: 'local.aceofbase.fun:3000',
            },
          ],
          destination: '/aceofbase/$1',
        },
        // Handle Vercel deployments with 'aceofbase' in the URL
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|aceofbase-favicon.ico|aceofbase.svg|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: '(?<host>.*aceofbase.*\\.vercel\\.app)',
            },
          ],
          destination: '/aceofbase/$1',
        },
      ],
      // API proxy rewrites come after (afterFiles)
      afterFiles: [
        {
          source: '/api/v1/:path*',
          destination: 'http://localhost:3002/api/v1/:path*',
        },
        {
          source: '/submissions/:path*',
          destination: 'http://localhost:3002/submissions/:path*',
        },
      ],
    };
  },

  // Redirects for blocked routes on main domain
  async redirects() {
    return [
      // TEMPORARY: Block all /rwa routes
      {
        source: '/rwa/:path*',
        destination: '/404',
        permanent: false,
      },
      // Block /admin routes on main domain (aces.fun)
      {
        source: '/admin/:path*',
        has: [
          {
            type: 'host',
            value: 'aces.fun',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      // Block /aceofbase, /launch, and /profile on main domain (aces.fun)
      {
        source: '/aceofbase/:path*',
        has: [
          {
            type: 'host',
            value: 'aces.fun',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      // Enable /launch on aces.fun
      /*
      {
        source: '/launch/:path*',
        has: [
          {
            type: 'host',
            value: 'aces.fun',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      */
      // Temporarily disabled for development
      /*
      {
        source: '/profile/:path*',
        has: [
          {
            type: 'host',
            value: 'aces.fun',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      */
      // Handle localhost:3000 and local.aces.fun for development (main domain)
      {
        source: '/admin/:path*',
        has: [
          {
            type: 'host',
            value: 'localhost:3000',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      // Temporarily disabled for testing
      /*
      {
        source: '/aceofbase/:path*',
        has: [
          {
            type: 'host',
            value: 'localhost:3000',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      */
      // Enable /launch on localhost:3000
      /*
      {
        source: '/launch/:path*',
        has: [
          {
            type: 'host',
            value: 'localhost:3000',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      */
      // Temporarily disabled for development
      /*
      {
        source: '/profile/:path*',
        has: [
          {
            type: 'host',
            value: 'localhost:3000',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      */
      // Add local.aces.fun redirects for development
      {
        source: '/admin/:path*',
        has: [
          {
            type: 'host',
            value: 'local.aces.fun:3000',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      {
        source: '/aceofbase/:path*',
        has: [
          {
            type: 'host',
            value: 'local.aces.fun:3000',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      {
        source: '/launch/:path*',
        has: [
          {
            type: 'host',
            value: 'local.aces.fun:3000',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      // Temporarily disabled for development
      /*
      {
        source: '/profile/:path*',
        has: [
          {
            type: 'host',
            value: 'local.aces.fun:3000',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      */
      // Handle main Vercel deployments (without 'admin' or 'aceofbase' in URL)
      // Temporarily disabled to allow admin access on feat-ui-updates branch
      /*
      {
        source: '/admin/:path*',
        has: [
          {
            type: 'host',
            value: '(?<host>(?!.*admin).*\\.vercel\\.app)',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      */
      {
        source: '/aceofbase/:path*',
        has: [
          {
            type: 'host',
            value: '(?<host>(?!.*aceofbase).*\\.vercel\\.app)',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      // Temporarily disabled for development
      /*
      {
        source: '/launch/:path*',
        has: [
          {
            type: 'host',
            value: '(?<host>(?!.*aceofbase).*\\.vercel\\.app)',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      */
      // Temporarily disabled for development
      /*
      {
        source: '/profile/:path*',
        has: [
          {
            type: 'host',
            value: '(?<host>(?!.*aceofbase).*\\.vercel\\.app)',
          },
        ],
        destination: '/404',
        permanent: false,
      },
      */
    ];
  },

  // Image optimization configuration
  images: {
    // Enable image optimization
    formats: ['image/webp', 'image/avif'],

    // Add device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],

    // Image sizes for different breakpoints
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

    // Configure remote patterns for Google Cloud Storage and Vercel Blob Storage
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/aces-product-images/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/aces-rwa-images/**',
      },
      {
        protocol: 'https',
        hostname: 'storage.googleapis.com',
        pathname: '/aces-secure-documents/**',
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
        pathname: '/**',
      },
    ],

    // Minimize layout shift
    minimumCacheTTL: 60,

    // Disable static imports warning for canvas images
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  webpack: (config) => {
    // Shader file support
    config.module.rules.push({
      test: /\.(glsl|vs|fs|vert|frag)$/,
      exclude: /node_modules/,
      use: ['raw-loader'],
    });

    return config;
  },
};

export default nextConfig;
