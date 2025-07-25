"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"

export default function SeesawAnimation() {
  const [isUp, setIsUp] = useState(true)
  const [isHovered, setIsHovered] = useState(false)

  // Auto-animate the seesaw
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHovered) {
        setIsUp((prev) => !prev)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [isHovered])

  const handleClick = () => {
    setIsUp((prev) => !prev)
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 space-y-8">
      {/* Title */}
      <div className="text-center">
        <h3 className="text-[#D0B284] text-lg font-bold mb-2 tracking-wider">TOKEN DYNAMICS</h3>
        <p className="text-[#DCDDCC] text-sm">Interactive Balance</p>
      </div>

      {/* Seesaw Container */}
      <div
        className="relative w-full max-w-xs h-48 cursor-pointer"
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Fulcrum (Triangle Base) */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="w-0 h-0 border-l-[20px] border-r-[20px] border-b-[35px] border-l-transparent border-r-transparent border-b-[#D0B284]" />
          <div className="w-8 h-4 bg-[#D0B284] mx-auto rounded-b-lg" />
        </div>

        {/* Seesaw Plank */}
        <motion.div
          className="absolute bottom-[75px] left-1/2 w-64 h-3 bg-gradient-to-r from-[#D0B284] to-[#D7BF75] rounded-full shadow-lg origin-center"
          style={{ transformOrigin: "center center" }}
          animate={{
            rotate: isUp ? -15 : 15,
          }}
          transition={{
            duration: 1.2,
            ease: "easeInOut",
          }}
          initial={{ x: "-50%" }}
        >
          {/* Left Side (Reward) */}
          <motion.div
            className="absolute -top-8 left-4 w-16 h-16 bg-[#184D37] rounded-full border-4 border-[#D0B284] flex items-center justify-center shadow-xl"
            animate={{
              y: isUp ? -20 : 20,
              scale: isUp ? 1.1 : 0.9,
            }}
            transition={{
              duration: 1.2,
              ease: "easeInOut",
            }}
          >
            <div className="text-white text-xs font-bold text-center">
              <div>💰</div>
            </div>
          </motion.div>

          {/* Right Side (Price) */}
          <motion.div
            className="absolute -top-8 right-4 w-16 h-16 bg-[#8B4513] rounded-full border-4 border-[#D0B284] flex items-center justify-center shadow-xl"
            animate={{
              y: isUp ? 20 : -20,
              scale: isUp ? 0.9 : 1.1,
            }}
            transition={{
              duration: 1.2,
              ease: "easeInOut",
            }}
          >
            <div className="text-white text-xs font-bold text-center">
              <div>💵</div>
            </div>
          </motion.div>
        </motion.div>

        {/* Floating Particles */}
        <motion.div
          className="absolute top-4 left-8 w-2 h-2 bg-[#D0B284] rounded-full opacity-60"
          animate={{
            y: [0, -20, 0],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute top-8 right-12 w-1.5 h-1.5 bg-[#D7BF75] rounded-full opacity-60"
          animate={{
            y: [0, -15, 0],
            opacity: [0.6, 1, 0.6],
          }}
          transition={{
            duration: 2.5,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
            delay: 0.5,
          }}
        />
      </div>

      {/* Labels */}
      <div className="w-full max-w-xs">
        <div className="flex justify-between items-center">
          <motion.div
            className="text-center"
            animate={{
              scale: isUp ? 1.1 : 1,
              color: isUp ? "#184D37" : "#DCDDCC",
            }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-sm font-bold">Reward per token</div>
            <div className="text-xs opacity-75">(up)</div>
          </motion.div>

          <motion.div
            className="text-center"
            animate={{
              scale: !isUp ? 1.1 : 1,
              color: !isUp ? "#8B4513" : "#DCDDCC",
            }}
            transition={{ duration: 0.6 }}
          >
            <div className="text-sm font-bold">Price per token</div>
            <div className="text-xs opacity-75">(down)</div>
          </motion.div>
        </div>
      </div>

      {/* Interactive Hint */}
      <div className="text-center">
        <p className="text-[#DCDDCC] text-xs opacity-60">Click to balance • Hover to pause</p>
      </div>
    </div>
  )
}
