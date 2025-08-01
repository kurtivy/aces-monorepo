import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['three'],

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
