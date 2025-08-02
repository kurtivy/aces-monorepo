import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],

  // Security headers including CSP for Privy
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Temporarily disable CSP for testing - REMOVE IN PRODUCTION
          // {
          //   key: 'Content-Security-Policy',
          //   value: [
          //     "default-src 'self'",
          //     "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
          //     "style-src 'self' 'unsafe-inline'",
          //     "img-src 'self' data: blob: https:",
          //     "font-src 'self' data:",
          //     "object-src 'none'",
          //     "base-uri 'self'",
          //     "form-action 'self'",
          //     "frame-ancestors 'none'",
          //     'child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org',
          //     'frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://challenges.cloudflare.com',
          //     "connect-src 'self' https://auth.privy.io wss://relay.walletconnect.com wss://relay.walletconnect.org wss://www.walletlink.org https://*.rpc.privy.systems https://explorer-api.walletconnect.com https://aces-monorepo-backend-git-dev-dan-aces-fun.vercel.app",
          //     "worker-src 'self'",
          //     "manifest-src 'self'",
          //    ].join('; '),
          // },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
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

  // API proxy configuration
  async rewrites() {
    return [
      {
        source: '/submissions/:path*',
        destination: 'http://localhost:3002/submissions/:path*',
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
