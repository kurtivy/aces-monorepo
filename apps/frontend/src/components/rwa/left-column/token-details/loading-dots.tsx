'use client';

import { motion } from 'framer-motion';

interface LoadingDotsProps {
  className?: string;
}

export const LoadingDots = ({
  className = 'text-base font-semibold font-proxima-nova leading-none text-white',
}: LoadingDotsProps) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{
            y: [0, -4, 0],
          }}
          transition={{
            duration: 0.9,
            repeat: Infinity,
            delay: i * 0.15,
            ease: 'easeInOut',
          }}
          className="inline-block"
        >
          •
        </motion.span>
      ))}
    </div>
  );
};
