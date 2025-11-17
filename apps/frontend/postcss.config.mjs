const isVitest = !!process.env.VITEST || process.env.VITE_TEST === 'true';

const config = {
  // Avoid loading Tailwind/PostCSS during unit tests (Vitest sets process.env.VITEST)
  plugins: isVitest ? [] : ['@tailwindcss/postcss'],
};

export default config;
