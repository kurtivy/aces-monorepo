'use client';

import { motion } from 'framer-motion';

interface LoadingDotsProps {
  className?: string;
}

export const LoadingDots = ({
  className = 'text-base font-semibold font-proxima-nova leading-none text-white',
}: LoadingDotsProps) => {
  const dotVariants = {
    animate: (i: number) => ({
      y: [0, -4, 0],
      transition: {
        duration: 0.9,
        repeat: Infinity,
        delay: i * 0.15,
        ease: 'easeInOut',
      },
    }),
  };

  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          custom={i}
          variants={dotVariants}
          animate="animate"
          className="inline-block"
        >
          •
        </motion.span>
      ))}
    </div>
  );
};
