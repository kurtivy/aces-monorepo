'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface HomeButtonProps {
  onClick: () => void;
}

const HomeButton: React.FC<HomeButtonProps> = ({ onClick }) => {
  return (
    <motion.button
      className="fixed top-4 right-4 z-50 p-3 rounded-full bg-black/50 border border-[#D0B264]/40 text-[#D0B264] shadow-lg hover:bg-black/70 hover:border-[#D0B264] transition-all duration-200"
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
    >
      <svg
        className="w-6 h-6"
        fill="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279L12 18.896l-7.416 3.817 1.48-8.279L.001 9.306l8.332-1.151L12 .587z" />
      </svg>
    </motion.button>
  );
};

export default HomeButton;
