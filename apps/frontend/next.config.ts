import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],

  // Security headers - CSP commented out for development
  // TODO: Re-enable CSP for production deployment
  /*
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // CSP with all required domains for Privy, WalletConnect, and production
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com https://www.clarity.ms https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              "img-src 'self' data: blob: https:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'self' https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app https://aces-monorepo-git-dev-dan-aces-fun.vercel.app https://aces.fun https://auth.privy.io",
              'child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org',
              'frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com',
              "connect-src 'self' http://localhost:3000 https://auth.privy.io wss://relay.walletconnect.com wss://relay.walletconnect.org wss://www.walletlink.org https://*.rpc.privy.systems https://explorer-api.walletconnect.com https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app https://pulse.walletconnect.org https://api.web3modal.org https://sepolia.base.org https://base-sepolia-rpc.publicnode.com https://base-sepolia.blockpi.network https://base-sepolia.gateway.tenderly.co https://1rpc.io https://min-api.cryptocompare.com https://api.thegraph.com https://api.coingecko.com https://api.coinbase.com https://api.binance.com",
              "worker-src 'self'",
              "manifest-src 'self'",
            ].join('; '),
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
  */

  // Multi-tenant and API proxy configuration
  async rewrites() {
    return {
      // Multi-tenant rewrites come first (beforeFiles)
      beforeFiles: [
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
        // Handle localhost:3001 and local.aceofbase.fun for development
        {
          source:
            '/((?!_next/static|_next/image|favicon.ico|aceofbase-favicon.ico|aceofbase.svg|api|canvas-images|fonts|svg).*)',
          has: [
            {
              type: 'host',
              value: 'localhost:3001',
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
          source: '/submissions/:path*',
          destination: 'http://localhost:3002/submissions/:path*',
        },
      ],
    };
  },

  // Redirects for blocked routes on main domain
  async redirects() {
    return [
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
      // Handle localhost:3000 and local.aces.fun for development (main domain)
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
      // Add local.aces.fun redirects for development
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
      // Handle main Vercel deployments (without 'aceofbase' in URL)
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

    // Allow localhost and your domain
    domains: [],

    // Configure remote patterns if needed for external images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
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
